const mongoose = require('mongoose');
const MasterOrder = require('../models/MasterOrder');
const SalesOrder = require('../models/SalesOrder');
const User = require('../models/User');
const { roundMoney } = require('../utils/money.util');

function httpError(message, status = 400) { return Object.assign(new Error(message), { status }); }
function cleanText(value) { return String(value || '').trim(); }
function amountOf(value) { return roundMoney(Number(value || 0)); }
function buildMasterCode() { return `MO${new Date().toISOString().slice(0,10).replace(/-/g,'')}${String(Date.now()).slice(-6)}`; }
function uniqClean(values = []) { return [...new Set((Array.isArray(values) ? values : []).map(cleanText).filter(Boolean))]; }
function objectIds(values = []) { return values.filter((x) => mongoose.Types.ObjectId.isValid(x)); }

async function resolveDeliveryStaffName(code, fallbackName) {
  const deliveryStaffCode = cleanText(code);
  if (!deliveryStaffCode) return cleanText(fallbackName);
  const user = await User.findOne({ $or: [{ code: deliveryStaffCode }, { username: deliveryStaffCode }] }).select('name fullName').lean();
  return cleanText(fallbackName) || cleanText(user && (user.name || user.fullName));
}

function buildFindFilter(id) {
  const key = cleanText(id);
  if (!key) return null;
  const or = [{ id: key }, { code: key }];
  if (mongoose.Types.ObjectId.isValid(key)) or.push({ _id: key });
  return { $or: or };
}

async function findMasterOrderOrThrow(id) {
  const filter = buildFindFilter(id);
  if (!filter) throw httpError('Thiếu mã đơn tổng', 400);
  const master = await MasterOrder.findOne(filter).lean();
  if (!master) throw httpError('Không tìm thấy đơn tổng', 404);
  return master;
}

async function resolveSalesOrdersByIds(salesOrderIds) {
  const ids = uniqClean(salesOrderIds);
  if (!ids.length) throw httpError('Chưa chọn đơn con', 400);
  const orders = await SalesOrder.find({
    $or: [
      { id: { $in: ids } },
      { code: { $in: ids } },
      ...(objectIds(ids).length ? [{ _id: { $in: objectIds(ids) } }] : []),
    ],
  }).lean();
  const foundKeys = new Set(orders.flatMap((order) => [cleanText(order.id), cleanText(order.code), cleanText(order._id)]));
  const missing = ids.filter((id) => !foundKeys.has(id));
  if (missing.length) throw httpError(`Có đơn con không tồn tại: ${missing.join(', ')}`, 404);
  return orders;
}

function assertOrdersCanMerge(orders) {
  for (const order of orders) {
    if (order.status !== 'pending') throw httpError(`Đơn ${order.code || order.id} không còn ở trạng thái pending`, 409);
    if (order.accountingStatus !== 'pending') throw httpError(`Đơn ${order.code || order.id} đã liên quan kế toán`, 409);
    if (order.masterOrderId || order.masterOrderCode) throw httpError(`Đơn ${order.code || order.id} đã nằm trong đơn tổng`, 409);
  }
}

async function createMasterOrder(input = {}) {
  const orders = await resolveSalesOrdersByIds(input.salesOrderIds || input.orderIds || []);
  assertOrdersCanMerge(orders);

  const deliveryDate = cleanText(input.deliveryDate) || cleanText(orders[0].deliveryDate);
  const deliveryStaffCode = cleanText(input.deliveryStaffCode) || cleanText(orders[0].deliveryStaffCode);
  if (!deliveryDate) throw httpError('Thiếu ngày giao', 400);
  if (!deliveryStaffCode) throw httpError('Thiếu nhân viên giao hàng', 400);
  const deliveryStaffName = await resolveDeliveryStaffName(deliveryStaffCode, input.deliveryStaffName || orders[0].deliveryStaffName);
  const code = cleanText(input.code) || buildMasterCode();
  if (await MasterOrder.exists({ code })) throw httpError(`Đơn tổng đã tồn tại: ${code}`, 409);

  const salesOrderIds = orders.map((order) => cleanText(order.id || order._id));
  const salesOrderCodes = orders.map((order) => cleanText(order.code));
  const totalAmount = amountOf(orders.reduce((sum, order) => sum + Number(order.payableAmount ?? order.finalAmount ?? order.totalAmount ?? 0), 0));
  const customerCount = new Set(orders.map((order) => cleanText(order.customerCode)).filter(Boolean)).size;

  const master = await MasterOrder.create({
    id: cleanText(input.id) || code,
    code,
    deliveryDate,
    deliveryStaffCode,
    deliveryStaffName,
    salesOrderIds,
    salesOrderCodes,
    customerCount,
    orderCount: orders.length,
    totalAmount,
    status: 'active',
    deliveryStatus: 'pending',
    accountingStatus: 'pending',
    note: cleanText(input.note),
  });

  const result = await SalesOrder.updateMany(
    { _id: { $in: orders.map((order) => order._id) }, status: 'pending', accountingStatus: 'pending' },
    { $set: { status: 'assigned', deliveryStatus: 'assigned', masterOrderId: master.id, masterOrderCode: master.code, deliveryStaffCode, deliveryStaffName, deliveryDate } }
  );
  if (result.modifiedCount !== orders.length) {
    await MasterOrder.deleteOne({ _id: master._id });
    throw httpError('Gộp đơn không hoàn tất do có đơn vừa bị thay đổi trạng thái', 409);
  }
  return master.toObject();
}

function buildListFilter(query = {}) {
  const filter = {};
  if (query.deliveryDate) filter.deliveryDate = cleanText(query.deliveryDate);
  if (query.deliveryStaffCode) filter.deliveryStaffCode = cleanText(query.deliveryStaffCode);
  if (query.status) filter.status = cleanText(query.status);
  if (query.accountingStatus) filter.accountingStatus = cleanText(query.accountingStatus);
  const keyword = cleanText(query.q || query.keyword);
  if (keyword) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ code: regex }, { deliveryStaffCode: regex }, { deliveryStaffName: regex }, { salesOrderCodes: regex }];
  }
  if (!Object.keys(filter).length) filter.createdAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  return filter;
}

async function listMasterOrders(query = {}) {
  const filter = buildListFilter(query);
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200);
  const page = Math.max(Number(query.page || 1), 1);
  const [rows, total] = await Promise.all([
    MasterOrder.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    MasterOrder.countDocuments(filter),
  ]);
  return { rows, total, page, limit };
}

async function getMasterWithChildren(masterOrderId) {
  const master = await findMasterOrderOrThrow(masterOrderId);
  const orders = await SalesOrder.find({
    $or: [{ masterOrderId: master.id }, { masterOrderCode: master.code }, { id: { $in: master.salesOrderIds || [] } }, { code: { $in: master.salesOrderCodes || [] } }],
  }).sort({ customerName: 1, code: 1 }).lean();
  return { master, orders };
}

async function updateMasterOrder(id, input = {}) {
  const master = await findMasterOrderOrThrow(id);
  if (['posted', 'confirmed'].includes(master.accountingStatus)) throw httpError('Đơn tổng đã kế toán xác nhận, không được sửa', 409);
  if (master.deliveryStatus === 'delivered') throw httpError('Đơn tổng đã giao hàng, không được sửa thông tin gộp', 409);

  const update = {};
  if (input.deliveryDate !== undefined) update.deliveryDate = cleanText(input.deliveryDate);
  if (input.deliveryStaffCode !== undefined) {
    update.deliveryStaffCode = cleanText(input.deliveryStaffCode);
    update.deliveryStaffName = await resolveDeliveryStaffName(update.deliveryStaffCode, input.deliveryStaffName);
  }
  if (input.note !== undefined) update.note = cleanText(input.note);
  const updated = await MasterOrder.findByIdAndUpdate(master._id, { $set: update }, { new: true }).lean();
  if (update.deliveryStaffCode !== undefined || update.deliveryDate !== undefined) {
    await SalesOrder.updateMany(
      { masterOrderId: master.id },
      { $set: {
        ...(update.deliveryStaffCode !== undefined ? { deliveryStaffCode: updated.deliveryStaffCode, deliveryStaffName: updated.deliveryStaffName } : {}),
        ...(update.deliveryDate !== undefined ? { deliveryDate: updated.deliveryDate } : {}),
      } }
    );
  }
  return updated;
}

async function cancelMasterOrder(id, reason = '') {
  const master = await findMasterOrderOrThrow(id);
  if (['posted', 'confirmed'].includes(master.accountingStatus)) throw httpError('Đơn tổng đã kế toán xác nhận, không được hủy thường', 409);
  if (master.deliveryStatus === 'delivered') throw httpError('Đơn tổng đã giao hàng, không được hủy thường', 409);

  const cancelled = await MasterOrder.findByIdAndUpdate(master._id, {
    $set: { status: 'cancelled', deliveryStatus: 'cancelled', accountingStatus: 'cancelled', cancelledAt: new Date(), cancelReason: cleanText(reason) },
  }, { new: true }).lean();
  await SalesOrder.updateMany(
    { $or: [{ masterOrderId: master.id }, { masterOrderCode: master.code }] },
    { $set: { status: 'pending', deliveryStatus: 'pending', masterOrderId: '', masterOrderCode: '' } }
  );
  return cancelled;
}

async function deliverMasterOrder(id) {
  const master = await findMasterOrderOrThrow(id);
  if (master.status === 'cancelled') throw httpError('Đơn tổng đã hủy, không thể giao hàng', 409);
  if (['posted', 'confirmed'].includes(master.accountingStatus)) throw httpError('Đơn tổng đã kế toán xác nhận', 409);
  const now = new Date();
  const updated = await MasterOrder.findByIdAndUpdate(master._id, { $set: { status: 'delivered', deliveryStatus: 'delivered', deliveredAt: now } }, { new: true }).lean();
  await SalesOrder.updateMany({ masterOrderId: master.id, status: 'assigned' }, { $set: { status: 'delivered', deliveryStatus: 'delivered', deliveredAt: now } });
  return updated;
}

async function accountingConfirmMasterOrder(id, confirmedBy = '') {
  const accountingService = require('./accountingService');
  return accountingService.confirmMasterOrderAccounting(id, [], confirmedBy);
}

module.exports = { createMasterOrder, listMasterOrders, getMasterWithChildren, updateMasterOrder, cancelMasterOrder, deliverMasterOrder, accountingConfirmMasterOrder, findMasterOrderOrThrow };
