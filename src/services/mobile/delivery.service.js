const mongoose = require('mongoose');
const MasterOrder = require('../../models/MasterOrder');
const SalesOrder = require('../../models/SalesOrder');
const ReturnOrder = require('../../models/ReturnOrder');
const FundLedger = require('../../models/FundLedger');
const returnOrderService = require('../returnOrder.service');
const { roundMoney } = require('../../utils/money.util');

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value) {
  return String(value || '').trim();
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
  const salesOrderId = cleanText(input.salesOrderId || input.id);
  const salesOrderCode = cleanText(input.salesOrderCode || input.code);
  if (!salesOrderId && !salesOrderCode) throw httpError('Thiếu salesOrderId hoặc salesOrderCode', 400);

  const lookupKey = salesOrderId || salesOrderCode;
  const order = await SalesOrder.findOne(buildOrderLookup(lookupKey)).lean();
  if (!order) throw httpError('Không tìm thấy đơn giao', 404);
  if (order.status === 'cancelled') throw httpError('Đơn đã hủy, không thể xác nhận giao', 409);

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
    });
  }

  await SalesOrder.updateOne({ _id: order._id }, {
    $set: {
      status: input.deliveryStatus === 'failed' ? 'assigned' : 'delivered',
      deliveryStatus: input.deliveryStatus === 'failed' ? 'failed' : 'delivered',
      deliveredAt: new Date(),
      cashAmount: Number(input.cashAmount || 0),
      bankAmount: Number(input.bankAmount || 0),
      bonusAmount: Number(input.bonusAmount || 0),
      paymentDraft: {
        cashAmount: Number(input.cashAmount || 0),
        bankAmount: Number(input.bankAmount || 0),
        bonusAmount: Number(input.bonusAmount || 0),
        note: cleanText(input.note),
        savedAt: new Date(),
      },
    },
  });

  if (order.masterOrderId || order.masterOrderCode) {
    const siblings = await SalesOrder.find({
      status: { $ne: 'cancelled' },
      $or: [
        { masterOrderId: order.masterOrderId || '__none__' },
        { masterOrderCode: order.masterOrderCode || '__none__' },
      ],
    }).select('status deliveryStatus').lean();
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
        await MasterOrder.updateOne(masterFilter, { $set: { status: 'delivered', deliveryStatus: 'delivered', deliveredAt: new Date() } });
      }
    }
  }

  return {
    ok: true,
    salesOrderId: order.id || String(order._id),
    salesOrderCode: order.code,
    status: 'delivered',
    deliveryStatus: 'delivered',
    returnLineCount: returnLines.length,
    returnOrder,
  };
}

module.exports = {
  listDeliveryOrders,
  getDeliveryOrderDetail,
  confirmDelivery,
};
