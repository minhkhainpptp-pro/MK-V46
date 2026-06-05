const mongoose = require('mongoose');
const ReturnOrder = require('../models/ReturnOrder');
const SalesOrder = require('../models/SalesOrder');
const { normalizeOrderCode } = require('../utils/normalizeCode');
const { roundMoney } = require('../utils/money.util');
const { createArOnce, createInventoryOnce, createJournalOnce } = require('./accountingService');
const { validateReturnPayload } = require('../utils/validation.util');
const { withTransaction, acquireOperation, completeOperation } = require('../core/operationGuard');
const { writeAuditLog } = require('../core/audit');

const EDITABLE_STATUS = ['pending'];

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value) {
  return String(value || '').trim();
}

function buildReturnOrderCode(salesOrderCode) {
  return `RO-${cleanText(salesOrderCode) || Date.now()}`;
}

function calculateReturnLine(item) {
  return roundMoney(Number(item.returnQty || 0) * Number(item.salePrice || 0));
}

function calculateReturnOrderTotals(items) {
  return items.reduce((acc, item) => {
    acc.qty += Number(item.returnQty || 0);
    acc.amount += calculateReturnLine(item);
    return acc;
  }, { qty: 0, amount: 0 });
}

function findSalesOrderFilter(key) {
  const value = cleanText(key);
  if (!value) return null;
  const or = [{ id: value }, { code: value }];
  if (mongoose.Types.ObjectId.isValid(value)) or.push({ _id: value });
  return { $or: or };
}

async function findSalesOrderOrThrow(input, options = {}) {
  const session = options.session;
  const key = input.salesOrderId || input.salesOrderCode || input.id || input.code;
  const filter = findSalesOrderFilter(key);
  if (!filter) throw httpError('Thiếu salesOrderId hoặc salesOrderCode', 400);
  const orderQuery = SalesOrder.findOne(filter);
  if (session) orderQuery.session(session);
  const order = await orderQuery.lean();
  if (!order) throw httpError('Không tìm thấy đơn bán để tạo hàng trả', 404);
  return order;
}

async function findReturnOrderOrThrow(id, options = {}) {
  const session = options.session;
  const key = cleanText(id);
  const or = [{ id: key }, { code: key }];
  if (mongoose.Types.ObjectId.isValid(key)) or.push({ _id: key });
  const query = ReturnOrder.findOne({ $or: or });
  if (session) query.session(session);
  const order = await query.lean();
  if (!order) throw httpError('Không tìm thấy phiếu trả hàng', 404);
  return order;
}

function normalizeReturnItems(rawItems, salesOrder) {
  const salesItems = Array.isArray(salesOrder.items) ? salesOrder.items : [];
  const salesItemMap = new Map(salesItems.map(item => [cleanText(item.productCode), item]));
  const inputItems = Array.isArray(rawItems) ? rawItems : [];

  const rows = inputItems.map((line, index) => {
    const productCode = cleanText(line.productCode);
    if (!productCode) throw httpError(`Dòng ${index + 1}: thiếu mã sản phẩm`, 400);

    const saleLine = salesItemMap.get(productCode) || {};
    const orderedQty = Number(line.orderedQty ?? saleLine.quantity ?? saleLine.qty ?? 0);
    const deliveredQty = Number(line.deliveredQty ?? Math.max(orderedQty - Number(line.returnQty || 0), 0));
    const returnQty = Number(line.returnQty || 0);
    const salePrice = Number(saleLine.price ?? line.salePrice ?? 0);

    if (returnQty < 0) throw httpError(`Dòng ${index + 1}: số lượng trả không được âm`, 400);
    if (returnQty > orderedQty && orderedQty > 0) {
      throw httpError(`Dòng ${index + 1}: số lượng trả không được lớn hơn số lượng đặt`, 400);
    }

    return {
      productCode,
      productName: cleanText(line.productName) || saleLine.productName || '',
      orderedQty,
      deliveredQty,
      returnQty,
      salePrice,
      returnAmount: calculateReturnLine({ returnQty, salePrice }),
    };
  }).filter(line => Number(line.returnQty || 0) > 0);

  if (!rows.length) throw httpError('Phiếu trả phải có ít nhất 1 sản phẩm có returnQty > 0', 400);
  return rows;
}

function buildFilter(query = {}) {
  const filter = {};
  if (query.deliveryDate) filter.deliveryDate = cleanText(query.deliveryDate);
  if (query.customerCode) filter.customerCode = cleanText(query.customerCode);
  if (query.salesStaffCode) filter.salesStaffCode = cleanText(query.salesStaffCode);
  if (query.deliveryStaffCode) filter.deliveryStaffCode = cleanText(query.deliveryStaffCode);
  if (query.status) filter.status = cleanText(query.status);
  if (query.accountingStatus) filter.accountingStatus = cleanText(query.accountingStatus);
  if (query.salesOrderId) filter.salesOrderId = cleanText(query.salesOrderId);
  if (query.salesOrderCode) filter.salesOrderCode = cleanText(query.salesOrderCode);
  if (query.keyword) {
    const keyword = cleanText(query.keyword);
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { code: regex },
      { salesOrderCode: regex },
      { customerCode: regex },
      { customerName: regex },
      { salesStaffCode: regex },
      { salesStaffName: regex },
      { deliveryStaffCode: regex },
      { deliveryStaffName: regex },
    ];
  }
  return filter;
}

async function createOrUpdateReturnOrder(input, options = {}) {
  validateReturnPayload(input);
  if (options.session) return createOrUpdateReturnOrderCore(input, options);

  const operationId = cleanText(input.operationId) || `RETURN:${cleanText(input.salesOrderId || input.salesOrderCode || input.id || input.code)}`;
  return withTransaction(async (session) => {
    await acquireOperation({
      operationId,
      type: 'CREATE_RETURN_ORDER',
      referenceId: cleanText(input.salesOrderId || input.salesOrderCode || input.id || input.code),
      referenceCode: cleanText(input.salesOrderCode || input.code),
      userCode: cleanText(input.createdBy || input.userCode),
    }, session);
    const result = await createOrUpdateReturnOrderCore(input, { session });
    await writeAuditLog({
      module: 'ReturnOrder',
      action: 'CREATE_OR_UPDATE_RETURN',
      referenceId: result.id,
      referenceCode: result.code,
      userCode: cleanText(input.createdBy || input.userCode),
      after: result,
    }, session);
    await completeOperation(operationId, { returnOrderId: result.id, returnOrderCode: result.code }, session);
    return result;
  });
}

async function createOrUpdateReturnOrderCore(input, options = {}) {
  const session = options.session;
  const salesOrder = await findSalesOrderOrThrow(input, { session });
  const salesOrderId = cleanText(salesOrder.id || salesOrder._id);
  const salesOrderCode = cleanText(salesOrder.code);
  const items = normalizeReturnItems(input.items || input.returnLines, salesOrder);
  const totals = calculateReturnOrderTotals(items);

  const existedQuery = ReturnOrder.findOne({
    status: { $ne: 'cancelled' },
    $or: [{ salesOrderId }, { salesOrderCode }],
  });
  if (session) existedQuery.session(session);
  const existed = await existedQuery.lean();

  const payload = {
    id: cleanText(input.id) || buildReturnOrderCode(salesOrderCode),
    code: cleanText(input.code) || (existed && existed.code) || buildReturnOrderCode(salesOrderCode),
    salesOrderId,
    salesOrderCode,
    normalizedSalesOrderCode: normalizeOrderCode(salesOrderCode),
    masterOrderId: salesOrder.masterOrderId || '',
    masterOrderCode: salesOrder.masterOrderCode || '',
    customerCode: salesOrder.customerCode || '',
    customerName: salesOrder.customerName || '',
    salesStaffCode: salesOrder.salesStaffCode || '',
    salesStaffName: salesOrder.salesStaffName || '',
    deliveryStaffCode: salesOrder.deliveryStaffCode || '',
    deliveryStaffName: salesOrder.deliveryStaffName || '',
    deliveryDate: cleanText(input.deliveryDate) || salesOrder.deliveryDate || '',
    items,
    totalReturnQty: totals.qty,
    totalReturnAmount: totals.amount,
    status: 'pending',
    accountingStatus: 'pending',
    note: cleanText(input.note),
  };

  if (existed) {
    if (!EDITABLE_STATUS.includes(existed.status)) {
      throw httpError('Phiếu trả đã xác nhận hoặc đã hủy, không được cập nhật', 409);
    }
    const updateQuery = ReturnOrder.findByIdAndUpdate(existed._id, { $set: payload }, { new: true });
    if (session) updateQuery.session(session);
    return updateQuery.lean();
  }

  const [doc] = await ReturnOrder.create([payload], session ? { session } : undefined);
  return doc.toObject();
}

async function listReturnOrders(query = {}) {
  const filter = buildFilter(query);
  const limit = Math.min(Number(query.limit || 100), 500);
  const rows = await ReturnOrder.find(filter)
    .sort({ deliveryDate: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  return { rows, total: rows.length };
}

async function getReturnOrder(id) {
  return findReturnOrderOrThrow(id);
}

async function getReturnOrdersBySalesOrder(salesOrderId) {
  const key = cleanText(salesOrderId);
  const normalized = normalizeOrderCode(key);
  const rows = await ReturnOrder.find({
    status: { $ne: 'cancelled' },
    $or: [
      { salesOrderId: key },
      { salesOrderCode: key },
      { normalizedSalesOrderCode: normalized },
    ],
  }).sort({ createdAt: -1 }).lean();
  return { rows, total: rows.length };
}

async function updateReturnOrder(id, input) {
  const existing = await findReturnOrderOrThrow(id);
  if (!EDITABLE_STATUS.includes(existing.status)) {
    throw httpError('Chỉ được sửa phiếu trả đang ở trạng thái pending', 409);
  }
  const salesOrder = await findSalesOrderOrThrow({ salesOrderId: existing.salesOrderId || existing.salesOrderCode });
  const items = Array.isArray(input.items) || Array.isArray(input.returnLines)
    ? normalizeReturnItems(input.items || input.returnLines, salesOrder)
    : existing.items;
  const totals = calculateReturnOrderTotals(items);

  const update = {
    items,
    totalReturnQty: totals.qty,
    totalReturnAmount: totals.amount,
  };
  if (input.note !== undefined) update.note = cleanText(input.note);
  if (input.deliveryDate !== undefined) update.deliveryDate = cleanText(input.deliveryDate);

  return ReturnOrder.findByIdAndUpdate(existing._id, { $set: update }, { new: true }).lean();
}

async function cancelReturnOrder(id, reason = '') {
  const existing = await findReturnOrderOrThrow(id);
  if (existing.accountingStatus === 'confirmed' || existing.status === 'confirmed') {
    throw httpError('Phiếu trả đã kế toán xác nhận, không được hủy thường', 409);
  }
  if (existing.status === 'cancelled') return existing;
  return ReturnOrder.findByIdAndUpdate(existing._id, {
    $set: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: cleanText(reason),
    },
  }, { new: true }).lean();
}

async function accountingConfirmReturnOrder(id, confirmedBy = '', options = {}) {
  if (options.session) return accountingConfirmReturnOrderCore(id, confirmedBy, options);

  const operationId = cleanText(options.operationId) || `ACCOUNTING_RETURN:${cleanText(id)}`;
  return withTransaction(async (session) => {
    await acquireOperation({
      operationId,
      type: 'ACCOUNTING_CONFIRM_RETURN',
      referenceId: cleanText(id),
      userCode: cleanText(confirmedBy),
    }, session);
    const result = await accountingConfirmReturnOrderCore(id, confirmedBy, { session });
    await writeAuditLog({
      module: 'ReturnOrder',
      action: 'ACCOUNTING_CONFIRM_RETURN',
      referenceId: result.id,
      referenceCode: result.code,
      userCode: cleanText(confirmedBy),
      after: result,
    }, session);
    await completeOperation(operationId, { returnOrderId: result.id, returnOrderCode: result.code }, session);
    return result;
  });
}

async function accountingConfirmReturnOrderCore(id, confirmedBy = '', options = {}) {
  const session = options.session;
  const existing = await findReturnOrderOrThrow(id, { session });
  if (['confirmed', 'posted'].includes(existing.accountingStatus) || ['confirmed', 'posted'].includes(existing.status)) {
    throw httpError('Phiếu trả đã được kế toán xác nhận', 409);
  }
  if (existing.status === 'cancelled') {
    throw httpError('Phiếu trả đã hủy, không thể xác nhận', 409);
  }

  const roId = cleanText(existing.id || existing._id);
  const amount = roundMoney(Number(existing.totalReturnAmount || existing.amount || 0));
  const arLedger = amount > 0 ? await createArOnce({
    type: 'AR-RETURN',
    date: existing.deliveryDate || new Date().toISOString().slice(0, 10),
    customerCode: existing.customerCode,
    customerName: existing.customerName,
    salesOrderId: existing.salesOrderId,
    salesOrderCode: existing.salesOrderCode,
    masterOrderId: existing.masterOrderId,
    masterOrderCode: existing.masterOrderCode,
    debit: 0,
    credit: amount,
    amount,
    note: 'Giảm công nợ do hàng trả',
    sourceType: 'returnOrder',
    sourceId: roId,
    sourceCode: existing.code,
    createdBy: confirmedBy,
  }, { session }) : null;

  const inventoryLedgers = [];
  const journals = [];
  for (const line of existing.items || []) {
    const qty = Math.abs(Number(line.returnQty || 0));
    if (!qty) continue;
    const inv = await createInventoryOnce({
      transactionType: 'IN_RETURN',
      productId: line.productCode,
      productCode: line.productCode,
      productName: line.productName,
      warehouseId: line.warehouseCode || 'DEFAULT',
      warehouseCode: line.warehouseCode || 'DEFAULT',
      warehouseName: line.warehouseName,
      qty,
      unit: line.unit,
      referenceType: 'returnOrder',
      referenceId: `${roId}:${line.productCode}`,
      referenceCode: existing.code,
      note: 'Nhập kho hàng trả khi kế toán xác nhận phiếu trả',
      createdBy: confirmedBy,
    }, { session });
    if (inv) inventoryLedgers.push(inv);
  }

  if (amount > 0) {
    const journal = await createJournalOnce({
      type: 'RETURN',
      date: existing.deliveryDate || new Date().toISOString().slice(0, 10),
      amount,
      customerCode: existing.customerCode,
      customerName: existing.customerName,
      salesOrderId: existing.salesOrderId,
      salesOrderCode: existing.salesOrderCode,
      masterOrderId: existing.masterOrderId,
      masterOrderCode: existing.masterOrderCode,
      sourceType: 'returnOrder',
      sourceId: roId,
      sourceCode: existing.code,
      note: 'Journal phiếu trả hàng',
      createdBy: confirmedBy,
      lines: [
        { accountCode: 'HANGTRA', accountName: 'Hàng bán bị trả lại', debit: amount, credit: 0 },
        { accountCode: 'PTKH', accountName: 'Phải thu khách hàng', debit: 0, credit: amount },
      ],
    }, { session });
    if (journal) journals.push(journal);
  }

  const updateQuery = ReturnOrder.findByIdAndUpdate(existing._id, {
    $set: {
      status: 'posted',
      accountingStatus: 'posted',
      confirmedAt: new Date(),
      confirmedBy: cleanText(confirmedBy),
      arPosted: !!arLedger,
    },
  }, { new: true });
  if (session) updateQuery.session(session);
  const updated = await updateQuery.lean();
  return { ...updated, arLedger, inventoryLedgers, journals };
}

module.exports = {
  calculateReturnLine,
  calculateReturnOrderTotals,
  createOrUpdateReturnOrder,
  listReturnOrders,
  getReturnOrder,
  getReturnOrdersBySalesOrder,
  updateReturnOrder,
  cancelReturnOrder,
  accountingConfirmReturnOrder,
};
