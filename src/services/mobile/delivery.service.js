const mongoose = require('mongoose');
const MasterOrder = require('../../models/MasterOrder');
const SalesOrder = require('../../models/SalesOrder');
const ReturnOrder = require('../../models/ReturnOrder');
const FundLedger = require('../../models/FundLedger');
const Journal = require('../../models/Journal');
const returnOrderService = require('../returnOrder.service');
const { roundMoney } = require('../../utils/money.util');
const { withTransaction, acquireOperation, completeOperation } = require('../../core/operationGuard');
const { writeAuditLog } = require('../../core/audit');

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value) {
  return String(value || '').trim();
}


function today() {
  return new Date().toISOString().slice(0, 10);
}

function amountOf(value) {
  return roundMoney(Number(value || 0));
}

function makeCode(prefix, sourceCode) {
  return `${prefix}-${cleanText(sourceCode) || Date.now()}`;
}

async function createFundOnce(payload, options = {}) {
  const session = options.session;
  const sourceType = cleanText(payload.sourceType);
  const sourceId = cleanText(payload.sourceId);
  const type = cleanText(payload.type);
  if (sourceType && sourceId && type) {
    const existedQuery = FundLedger.findOne({ sourceType, sourceId, type });
    if (session) existedQuery.session(session);
    const existed = await existedQuery.lean();
    if (existed) return existed;
  }
  const amount = amountOf(payload.amount);
  if (amount <= 0) return null;
  const [doc] = await FundLedger.create([{
    id: cleanText(payload.id) || makeCode('FL', `${type}-${sourceId}`),
    code: cleanText(payload.code) || makeCode(type, payload.sourceCode || sourceId),
    type,
    method: cleanText(payload.method) || (type === 'BANK_RECEIPT' ? 'bank' : 'cash'),
    amount,
    date: cleanText(payload.date) || today(),
    customerCode: cleanText(payload.customerCode),
    customerName: cleanText(payload.customerName),
    salesOrderId: cleanText(payload.salesOrderId),
    salesOrderCode: cleanText(payload.salesOrderCode),
    masterOrderId: cleanText(payload.masterOrderId),
    masterOrderCode: cleanText(payload.masterOrderCode),
    note: cleanText(payload.note),
    sourceType,
    sourceId,
    createdBy: cleanText(payload.createdBy),
  }], session ? { session } : undefined);
  return doc.toObject();
}

async function createJournalOnce(payload, options = {}) {
  const session = options.session;
  const sourceType = cleanText(payload.sourceType);
  const sourceId = cleanText(payload.sourceId);
  const type = cleanText(payload.type);
  if (sourceType && sourceId && type) {
    const existedQuery = Journal.findOne({ sourceType, sourceId, type });
    if (session) existedQuery.session(session);
    const existed = await existedQuery.lean();
    if (existed) return existed;
  }
  const amount = amountOf(payload.amount);
  if (amount <= 0) return null;
  const [doc] = await Journal.create([{
    id: cleanText(payload.id) || makeCode('JNL', `${type}-${sourceId}`),
    code: cleanText(payload.code) || makeCode(`JNL-${type}`, payload.sourceCode || sourceId),
    type,
    date: cleanText(payload.date) || today(),
    customerCode: cleanText(payload.customerCode),
    customerName: cleanText(payload.customerName),
    salesOrderId: cleanText(payload.salesOrderId),
    salesOrderCode: cleanText(payload.salesOrderCode),
    masterOrderId: cleanText(payload.masterOrderId),
    masterOrderCode: cleanText(payload.masterOrderCode),
    amount,
    lines: Array.isArray(payload.lines) ? payload.lines : [],
    sourceType,
    sourceId,
    sourceCode: cleanText(payload.sourceCode),
    note: cleanText(payload.note),
    createdBy: cleanText(payload.createdBy),
  }], session ? { session } : undefined);
  return doc.toObject();
}

function objectIdOrNull(value) {
  const key = cleanText(value);
  return mongoose.Types.ObjectId.isValid(key) ? key : null;
}

function buildOrderLookup(id) {
  const key = cleanText(id);
  const or = [{ id: key }, { code: key }];
  const objectId = objectIdOrNull(key);
  if (objectId) or.push({ _id: objectId });
  return { $or: or };
}

function normalizeStatusFilter(status) {
  const value = cleanText(status).toLowerCase();
  if (!value || value === 'all' || value === 'tat-ca' || value === 'tất cả') return null;
  if (['pending', 'assigned', 'not_delivered', 'chua-giao', 'chưa giao'].includes(value)) {
    return { $nin: ['delivered', 'accounting_confirmed', 'cancelled'] };
  }
  if (['delivered', 'done', 'da-giao', 'đã giao'].includes(value)) return 'delivered';
  return cleanText(status);
}

function normalizeSaleLine(line = {}) {
  const orderedQty = Number(line.quantity ?? line.qty ?? line.orderedQty ?? 0);
  const deliveredQty = Number(line.deliveredQty ?? orderedQty);
  const salePrice = Number(line.salePrice ?? line.price ?? 0);
  return {
    productCode: cleanText(line.productCode),
    productName: cleanText(line.productName),
    unit: cleanText(line.unit),
    orderedQty,
    deliveredQty,
    returnQty: Math.max(orderedQty - deliveredQty, 0),
    salePrice,
    returnAmount: 0,
  };
}

async function findSalesOrdersFromMasters(query) {
  const masterFilter = {
    deliveryDate: cleanText(query.deliveryDate),
    status: { $ne: 'cancelled' },
  };
  if (query.deliveryStaffCode) masterFilter.deliveryStaffCode = cleanText(query.deliveryStaffCode);

  const masters = await MasterOrder.find(masterFilter)
    .select('id code deliveryDate deliveryStaffCode deliveryStaffName salesOrderIds salesOrderCodes status deliveryStatus accountingStatus totalAmount')
    .sort({ code: 1 })
    .limit(300)
    .lean();

  const salesOrderIds = [];
  const salesOrderCodes = [];
  const masterByOrderKey = new Map();

  for (const master of masters) {
    for (const id of (master.salesOrderIds || []).map(cleanText).filter(Boolean)) {
      salesOrderIds.push(id);
      masterByOrderKey.set(id, master);
    }
    for (const code of (master.salesOrderCodes || []).map(cleanText).filter(Boolean)) {
      salesOrderCodes.push(code);
      masterByOrderKey.set(code, master);
    }
  }

  if (!salesOrderIds.length && !salesOrderCodes.length) {
    return { masters, orders: [], masterByOrderKey };
  }

  const salesFilter = {
    status: { $ne: 'cancelled' },
    $or: [
      { id: { $in: salesOrderIds } },
      { code: { $in: salesOrderCodes } },
    ],
  };
  const statusFilter = normalizeStatusFilter(query.status);
  if (statusFilter) salesFilter.status = statusFilter;
  if (query.salesStaffCode) salesFilter.salesStaffCode = cleanText(query.salesStaffCode);

  const orders = await SalesOrder.find(salesFilter)
    .select('id code customerCode customerName salesStaffCode salesStaffName deliveryStaffCode deliveryStaffName deliveryDate status deliveryStatus accountingStatus totalAmount payableAmount finalAmount masterOrderId masterOrderCode')
    .sort({ customerName: 1, code: 1 })
    .limit(500)
    .lean();

  return { masters, orders, masterByOrderKey };
}

async function listDeliveryOrders(query = {}) {
  const startedAt = Date.now();
  if (!query.deliveryDate) throw httpError('Thiếu ngày giao', 400);

  const masterStartedAt = Date.now();
  const { orders, masterByOrderKey } = await findSalesOrdersFromMasters(query);
  const masterQueryMs = Date.now() - masterStartedAt;

  const ids = orders.map((order) => cleanText(order.id || order._id)).filter(Boolean);
  const codes = orders.map((order) => cleanText(order.code)).filter(Boolean);

  const returnStartedAt = Date.now();
  const returns = ids.length || codes.length ? await ReturnOrder.find({
    status: { $nin: ['cancelled'] },
    $or: [{ salesOrderId: { $in: ids } }, { salesOrderCode: { $in: codes } }],
  }).select('salesOrderId salesOrderCode totalReturnQty totalReturnAmount amount items').lean() : [];
  const returnQueryMs = Date.now() - returnStartedAt;

  const returnMap = new Map();
  for (const ro of returns) {
    const amount = Number(ro.totalReturnAmount || ro.amount || 0);
    const qty = Number(ro.totalReturnQty || 0);
    for (const key of [ro.salesOrderId, ro.salesOrderCode].map(cleanText).filter(Boolean)) {
      const current = returnMap.get(key) || { qty: 0, amount: 0 };
      current.qty += qty;
      current.amount += amount;
      returnMap.set(key, current);
    }
  }

  const buildStartedAt = Date.now();
  const rows = orders.map((order) => {
    const orderId = cleanText(order.id || order._id);
    const orderCode = cleanText(order.code);
    const master = masterByOrderKey.get(orderId) || masterByOrderKey.get(orderCode) || {};
    const totalAmount = roundMoney(Number(order.payableAmount ?? order.finalAmount ?? order.totalAmount ?? 0));
    const ret = returnMap.get(orderId) || returnMap.get(orderCode) || { qty: 0, amount: 0 };
    const paidAmount = roundMoney(Number(order.cashAmount || 0) + Number(order.bankAmount || 0) + Number(order.bonusAmount || 0));
    return {
      id: orderId,
      code: orderCode,
      salesOrderId: orderId,
      salesOrderCode: orderCode,
      customerCode: order.customerCode || '',
      customerName: order.customerName || '',
      salesStaffCode: order.salesStaffCode || '',
      salesStaffName: order.salesStaffName || '',
      deliveryStaffCode: order.deliveryStaffCode || master.deliveryStaffCode || '',
      deliveryStaffName: order.deliveryStaffName || master.deliveryStaffName || '',
      deliveryDate: order.deliveryDate || master.deliveryDate || query.deliveryDate,
      masterOrderId: order.masterOrderId || cleanText(master.id || master._id),
      masterOrderCode: order.masterOrderCode || master.code || '',
      itemCount: Number(order.itemCount || 0),
      totalAmount,
      finalAmount: totalAmount,
      returnQty: ret.qty,
      returnAmount: roundMoney(ret.amount),
      paidAmount,
      debtAmount: roundMoney(totalAmount - ret.amount - paidAmount),
      status: order.status || '',
      deliveryStatus: order.deliveryStatus || '',
      accountingStatus: order.accountingStatus || '',
    };
  });
  const buildRowsMs = Date.now() - buildStartedAt;

  return { rows, total: rows.length, perf: { totalMs: Date.now() - startedAt, masterQueryMs, salesQueryMs: masterQueryMs, returnQueryMs, buildRowsMs } };
}

async function getDeliveryOrderDetail(id) {
  const order = await SalesOrder.findOne(buildOrderLookup(id)).lean();
  if (!order) throw httpError('Không tìm thấy đơn giao', 404);

  const returnResult = await returnOrderService.getReturnOrdersBySalesOrder(order.id || order.code);
  const returnLineMap = new Map();
  for (const returnOrder of returnResult.rows || []) {
    for (const line of returnOrder.items || []) {
      const key = cleanText(line.productCode);
      if (!key) continue;
      const current = returnLineMap.get(key) || { returnQty: 0, returnAmount: 0 };
      current.returnQty += Number(line.returnQty || 0);
      current.returnAmount += Number(line.returnAmount || 0);
      returnLineMap.set(key, current);
    }
  }

  const items = (order.items || []).map((line) => {
    const base = normalizeSaleLine(line);
    const savedReturn = returnLineMap.get(base.productCode) || { returnQty: 0, returnAmount: 0 };
    return {
      ...base,
      returnQty: savedReturn.returnQty || base.returnQty,
      returnAmount: roundMoney(savedReturn.returnAmount || ((savedReturn.returnQty || base.returnQty) * base.salePrice)),
    };
  });

  return {
    salesOrderId: cleanText(order.id || order._id),
    salesOrderCode: order.code,
    customerCode: order.customerCode,
    customerName: order.customerName,
    deliveryDate: order.deliveryDate,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    accountingStatus: order.accountingStatus,
    totalAmount: roundMoney(Number(order.finalAmount ?? order.totalAmount ?? 0)),
    items,
    returnOrders: returnResult.rows || [],
  };
}

function normalizeConfirmLines(inputItems, salesOrder) {
  const salesItems = Array.isArray(salesOrder.items) ? salesOrder.items : [];
  const salesItemMap = new Map(salesItems.map((item) => [cleanText(item.productCode), item]));
  const rawItems = Array.isArray(inputItems) ? inputItems : [];

  return rawItems.map((line, index) => {
    const productCode = cleanText(line.productCode);
    if (!productCode) throw httpError(`Dòng ${index + 1}: thiếu mã sản phẩm`, 400);
    const saleLine = salesItemMap.get(productCode) || {};
    const orderedQty = Number(line.orderedQty ?? saleLine.quantity ?? saleLine.qty ?? 0);
    const deliveredQty = Number(line.deliveredQty ?? Math.max(orderedQty - Number(line.returnQty || 0), 0));
    const returnQty = Number(line.returnQty ?? Math.max(orderedQty - deliveredQty, 0));
    const salePrice = Number(saleLine.price ?? line.salePrice ?? 0);
    if (returnQty < 0) throw httpError(`Dòng ${index + 1}: SL trả không được âm`, 400);
    if (orderedQty > 0 && returnQty > orderedQty) throw httpError(`Dòng ${index + 1}: SL trả không được lớn hơn SL đặt`, 400);
    return {
      productCode,
      productName: cleanText(line.productName || saleLine.productName),
      orderedQty,
      deliveredQty,
      returnQty,
      salePrice,
      returnAmount: roundMoney(returnQty * salePrice),
    };
  });
}

async function confirmDelivery(input = {}) {
  const salesOrderId = cleanText(input.salesOrderId || input.id || input.salesOrderCode || input.code);
  const operationId = cleanText(input.operationId) || `CONFIRM_DELIVERY:${salesOrderId}`;

  return withTransaction(async (session) => {
    await acquireOperation({
      operationId,
      type: 'CONFIRM_DELIVERY',
      referenceId: salesOrderId,
      referenceCode: cleanText(input.salesOrderCode || input.code),
      userCode: cleanText(input.createdBy || input.deliveryStaffCode || input.userCode),
    }, session);

    const result = await confirmDeliveryCore(input, { session });

    await writeAuditLog({
      module: 'SalesOrder',
      action: 'CONFIRM_DELIVERY',
      referenceId: result.salesOrderId,
      referenceCode: result.salesOrderCode,
      userCode: cleanText(input.createdBy || input.deliveryStaffCode || input.userCode),
      after: result,
    }, session);

    await completeOperation(operationId, {
      salesOrderId: result.salesOrderId,
      deliveryStatus: result.deliveryStatus,
      returnLineCount: result.returnLineCount,
    }, session);

    return result;
  });
}

async function confirmDeliveryCore(input = {}, options = {}) {
  const session = options.session;
  const salesOrderId = cleanText(input.salesOrderId || input.id);
  const salesOrderCode = cleanText(input.salesOrderCode || input.code);
  if (!salesOrderId && !salesOrderCode) throw httpError('Thiếu salesOrderId hoặc salesOrderCode', 400);

  const lookupKey = salesOrderId || salesOrderCode;
  const orderQuery = SalesOrder.findOne(buildOrderLookup(lookupKey));
  if (session) orderQuery.session(session);
  const order = await orderQuery.lean();
  if (!order) throw httpError('Không tìm thấy đơn giao', 404);
  if (order.status === 'cancelled') throw httpError('Đơn đã hủy, không thể xác nhận giao', 409);
  if (order.deliveryStatus === 'delivered' || order.status === 'delivered' || order.status === 'accounting_confirmed') {
    throw httpError('Đơn đã xác nhận giao, không được xác nhận lại', 409);
  }

  const normalizedLines = normalizeConfirmLines(input.items || input.returnLines || [], order);
  const returnLines = normalizedLines.filter((line) => Number(line.returnQty || 0) > 0);
  let returnOrder = null;

  if (returnLines.length) {
    returnOrder = await returnOrderService.createOrUpdateReturnOrder({
      salesOrderId: order.id || String(order._id),
      salesOrderCode: order.code,
      deliveryDate: input.deliveryDate || order.deliveryDate,
      items: returnLines,
      note: input.note || 'Tạo từ app giao hàng',
      createdBy: cleanText(input.createdBy || input.deliveryStaffCode || order.deliveryStaffCode),
      operationId: `RETURN_FROM_DELIVERY:${cleanText(order.id || order._id)}`,
    }, { session });
  }

  const orderId = cleanText(order.id || order._id);
  const orderCode = cleanText(order.code);
  const cashAmount = amountOf(input.cashAmount || 0);
  const bankAmount = amountOf(input.bankAmount || 0);
  const bonusAmount = amountOf(input.bonusAmount || 0);
  const confirmDate = cleanText(input.deliveryDate || order.deliveryDate) || today();
  const createdBy = cleanText(input.createdBy || input.deliveryStaffCode || order.deliveryStaffCode);
  const isFailed = input.deliveryStatus === 'failed';

  const updateOrderQuery = SalesOrder.updateOne({ _id: order._id }, {
    $set: {
      status: isFailed ? 'assigned' : 'delivered',
      deliveryStatus: isFailed ? 'failed' : 'delivered',
      deliveredAt: isFailed ? undefined : new Date(),
      cashAmount,
      bankAmount,
      bonusAmount,
      paymentDraft: {
        cashAmount,
        bankAmount,
        bonusAmount,
        note: cleanText(input.note),
        savedAt: new Date(),
      },
    },
  });
  if (session) updateOrderQuery.session(session);
  await updateOrderQuery;

  const fundLedgers = [];
  const journals = [];
  if (!isFailed && cashAmount > 0) {
    const fund = await createFundOnce({
      type: 'CASH_RECEIPT', method: 'cash', amount: cashAmount, date: confirmDate,
      customerCode: order.customerCode, customerName: order.customerName,
      salesOrderId: orderId, salesOrderCode: orderCode,
      masterOrderId: order.masterOrderId, masterOrderCode: order.masterOrderCode,
      sourceType: 'cashReceipt', sourceId: orderId, sourceCode: orderCode,
      note: 'THU TIỀN KHÁCH - app giao hàng', createdBy,
    }, { session });
    if (fund) fundLedgers.push(fund);
    const journal = await createJournalOnce({
      type: 'RECEIPT', amount: cashAmount, date: confirmDate,
      customerCode: order.customerCode, customerName: order.customerName,
      salesOrderId: orderId, salesOrderCode: orderCode,
      masterOrderId: order.masterOrderId, masterOrderCode: order.masterOrderCode,
      sourceType: 'cashReceipt', sourceId: orderId, sourceCode: orderCode,
      note: 'THU TIỀN KHÁCH - tiền mặt', createdBy,
      lines: [
        { accountCode: '111', accountName: 'Tiền mặt', debit: cashAmount, credit: 0 },
        { accountCode: 'PTKH', accountName: 'Phải thu khách hàng', debit: 0, credit: cashAmount },
      ],
    }, { session });
    if (journal) journals.push(journal);
  }
  if (!isFailed && bankAmount > 0) {
    const fund = await createFundOnce({
      type: 'BANK_RECEIPT', method: 'bank', amount: bankAmount, date: confirmDate,
      customerCode: order.customerCode, customerName: order.customerName,
      salesOrderId: orderId, salesOrderCode: orderCode,
      masterOrderId: order.masterOrderId, masterOrderCode: order.masterOrderCode,
      sourceType: 'bankReceipt', sourceId: orderId, sourceCode: orderCode,
      note: 'THU TIỀN KHÁCH - app giao hàng', createdBy,
    }, { session });
    if (fund) fundLedgers.push(fund);
    const journal = await createJournalOnce({
      type: 'RECEIPT', amount: bankAmount, date: confirmDate,
      customerCode: order.customerCode, customerName: order.customerName,
      salesOrderId: orderId, salesOrderCode: orderCode,
      masterOrderId: order.masterOrderId, masterOrderCode: order.masterOrderCode,
      sourceType: 'bankReceipt', sourceId: orderId, sourceCode: orderCode,
      note: 'THU TIỀN KHÁCH - chuyển khoản', createdBy,
      lines: [
        { accountCode: '112', accountName: 'Tiền gửi ngân hàng', debit: bankAmount, credit: 0 },
        { accountCode: 'PTKH', accountName: 'Phải thu khách hàng', debit: 0, credit: bankAmount },
      ],
    }, { session });
    if (journal) journals.push(journal);
  }

  if (order.masterOrderId || order.masterOrderCode) {
    const siblingsQuery = SalesOrder.find({
      status: { $ne: 'cancelled' },
      $or: [
        { masterOrderId: order.masterOrderId || '__none__' },
        { masterOrderCode: order.masterOrderCode || '__none__' },
      ],
    }).select('status deliveryStatus');
    if (session) siblingsQuery.session(session);
    const siblings = await siblingsQuery.lean();

    const allDelivered = siblings.length > 0 && siblings.every((row) => {
      if (String(row._id) === String(order._id)) return true;
      return row.deliveryStatus === 'delivered' || row.status === 'delivered' || row.status === 'accounting_confirmed';
    });
    if (allDelivered) {
      const masterFilter = { $or: [] };
      if (order.masterOrderId) masterFilter.$or.push({ id: order.masterOrderId }, { _id: objectIdOrNull(order.masterOrderId) || undefined });
      if (order.masterOrderCode) masterFilter.$or.push({ code: order.masterOrderCode });
      masterFilter.$or = masterFilter.$or.filter((x) => !Object.values(x).includes(undefined));
      if (masterFilter.$or.length) {
        const updateMasterQuery = MasterOrder.updateOne(masterFilter, { $set: { status: 'delivered', deliveryStatus: 'delivered', deliveredAt: new Date() } });
        if (session) updateMasterQuery.session(session);
        await updateMasterQuery;
      }
    }
  }

  return {
    ok: true,
    salesOrderId: order.id || String(order._id),
    salesOrderCode: order.code,
    status: isFailed ? 'assigned' : 'delivered',
    deliveryStatus: isFailed ? 'failed' : 'delivered',
    returnLineCount: returnLines.length,
    returnOrder,
    fundLedgers,
    journals,
    accountingStatus: order.accountingStatus || 'pending',
  };
}

module.exports = {
  listDeliveryOrders,
  getDeliveryOrderDetail,
  confirmDelivery,
};
