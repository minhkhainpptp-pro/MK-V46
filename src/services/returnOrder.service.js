const mongoose = require('mongoose');
const ReturnOrder = require('../models/ReturnOrder');
const SalesOrder = require('../models/SalesOrder');
const { normalizeOrderCode } = require('../utils/normalizeCode');
const { roundMoney } = require('../utils/money.util');
const arLedgerService = require('./arLedger.service');

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

async function findSalesOrderOrThrow(input) {
  const key = input.salesOrderId || input.salesOrderCode || input.id || input.code;
  const filter = findSalesOrderFilter(key);
  if (!filter) throw httpError('Thiếu salesOrderId hoặc salesOrderCode', 400);
  const order = await SalesOrder.findOne(filter).lean();
  if (!order) throw httpError('Không tìm thấy đơn bán để tạo hàng trả', 404);
  return order;
}

async function findReturnOrderOrThrow(id) {
  const key = cleanText(id);
  const or = [{ id: key }, { code: key }];
  if (mongoose.Types.ObjectId.isValid(key)) or.push({ _id: key });
  const order = await ReturnOrder.findOne({ $or: or }).lean();
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

async function createOrUpdateReturnOrder(input) {
  const salesOrder = await findSalesOrderOrThrow(input);
  const salesOrderId = cleanText(salesOrder.id || salesOrder._id);
  const salesOrderCode = cleanText(salesOrder.code);
  const items = normalizeReturnItems(input.items || input.returnLines, salesOrder);
  const totals = calculateReturnOrderTotals(items);

  const existed = await ReturnOrder.findOne({
    status: { $ne: 'cancelled' },
    $or: [{ salesOrderId }, { salesOrderCode }],
  }).lean();

  const payload = {
    id: cleanText(input.id) || buildReturnOrderCode(salesOrderCode),
    code: cleanText(input.code) || (existed && existed.code) || buildReturnOrderCode(salesOrderCode),
    salesOrderId,
    salesOrderCode,
    normalizedSalesOrderCode: normalizeOrderCode(salesOrderCode),
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
    return ReturnOrder.findByIdAndUpdate(existed._id, { $set: payload }, { new: true }).lean();
  }

  const doc = await ReturnOrder.create(payload);
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

async function accountingConfirmReturnOrder(id, confirmedBy = '') {
  const existing = await findReturnOrderOrThrow(id);
  if (existing.accountingStatus === 'confirmed' || existing.status === 'confirmed') {
    throw httpError('Phiếu trả đã được kế toán xác nhận', 409);
  }
  if (existing.status === 'cancelled') {
    throw httpError('Phiếu trả đã hủy, không thể xác nhận', 409);
  }

  const arLedger = await arLedgerService.postReturnAr(existing, confirmedBy);
  const updated = await ReturnOrder.findByIdAndUpdate(existing._id, {
    $set: {
      status: 'confirmed',
      accountingStatus: 'confirmed',
      confirmedAt: new Date(),
      confirmedBy: cleanText(confirmedBy),
      arPosted: !!arLedger,
    },
  }, { new: true }).lean();
  return { ...updated, arLedger };
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
