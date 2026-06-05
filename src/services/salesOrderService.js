const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const MasterOrder = require('../models/MasterOrder');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const User = require('../models/User');
const { normalizeOrderCode } = require('../utils/normalizeCode');
const { roundMoney } = require('../utils/money.util');

const EDITABLE_STATUS = ['pending'];
const MAX_LIMIT = 200;

function httpError(message, status = 400) { return Object.assign(new Error(message), { status }); }
function cleanText(value) { return String(value || '').trim(); }
function safeRegex(text) { return new RegExp(cleanText(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
function todayCompact() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; }
function buildOrderCode() { return `SO${todayCompact()}${String(Date.now()).slice(-6)}`; }
function amountOf(value) { return roundMoney(Number(value || 0)); }

async function resolveCustomer(customerCode) {
  const code = cleanText(customerCode);
  if (!code) throw httpError('Thiếu mã khách hàng', 400);
  const customer = await Customer.findOne({ $or: [{ code }, { customerCode: code }] }).lean();
  if (!customer) throw httpError(`Không tìm thấy khách hàng: ${code}`, 404);
  return customer;
}

async function resolveStaffName(code, fallbackName) {
  const staffCode = cleanText(code);
  if (!staffCode) return cleanText(fallbackName);
  const user = await User.findOne({ $or: [{ code: staffCode }, { username: staffCode }] }).select('name fullName code username').lean();
  return cleanText(fallbackName) || cleanText(user && (user.name || user.fullName)) || '';
}

async function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw httpError('Đơn hàng phải có ít nhất 1 sản phẩm', 400);

  const productCodes = [...new Set(rawItems.map((item) => cleanText(item.productCode || item.code)).filter(Boolean))];
  if (!productCodes.length) throw httpError('Danh sách sản phẩm thiếu mã sản phẩm', 400);
  const products = await Product.find({ code: { $in: productCodes } }).lean();
  const productMap = new Map(products.map((product) => [cleanText(product.code), product]));

  return rawItems.map((item, index) => {
    const productCode = cleanText(item.productCode || item.code);
    if (!productCode) throw httpError(`Dòng ${index + 1}: thiếu mã sản phẩm`, 400);
    const product = productMap.get(productCode);
    if (!product) throw httpError(`Dòng ${index + 1}: không tìm thấy sản phẩm ${productCode}`, 404);

    const quantity = Number(item.quantity ?? item.qty ?? 0);
    const price = Number(item.price ?? item.salePrice ?? product.salePrice ?? 0);
    const discount = Number(item.discount ?? 0);
    if (quantity <= 0) throw httpError(`Dòng ${index + 1}: số lượng phải lớn hơn 0`, 400);
    if (price < 0) throw httpError(`Dòng ${index + 1}: đơn giá không được âm`, 400);
    const amount = amountOf(quantity * price - discount);

    return {
      productId: cleanText(product.id || product._id),
      productCode,
      productName: cleanText(item.productName) || product.name || '',
      unit: cleanText(item.unit) || product.baseUnit || '',
      quantity,
      qty: quantity,
      price,
      discount,
      amount,
      warehouseCode: cleanText(item.warehouseCode) || product.defaultWarehouse || product.defaultWarehouseCode || '',
      warehouseName: cleanText(item.warehouseName),
      isPromotion: Boolean(item.isPromotion),
    };
  });
}

function calcTotals(items) {
  return items.reduce((acc, item) => {
    acc.totalAmount += amountOf(Number(item.quantity || 0) * Number(item.price || 0));
    acc.discountAmount += amountOf(item.discount || 0);
    acc.payableAmount += amountOf(item.amount || 0);
    return acc;
  }, { totalAmount: 0, discountAmount: 0, payableAmount: 0 });
}

function buildFindFilter(id) {
  const key = cleanText(id);
  if (!key) return null;
  const or = [{ id: key }, { code: key }, { normalizedCode: normalizeOrderCode(key) }];
  if (mongoose.Types.ObjectId.isValid(key)) or.push({ _id: key });
  return { $or: or };
}

async function findSalesOrderOrThrow(id) {
  const filter = buildFindFilter(id);
  if (!filter) throw httpError('Thiếu mã đơn bán', 400);
  const order = await SalesOrder.findOne(filter).lean();
  if (!order) throw httpError('Không tìm thấy đơn bán', 404);
  return order;
}

async function createSalesOrder(input = {}) {
  const code = cleanText(input.code || buildOrderCode());
  const normalizedCode = normalizeOrderCode(code);
  const duplicated = await SalesOrder.exists({ $or: [{ code }, { normalizedCode }] });
  if (duplicated) throw httpError(`Đơn đã tồn tại: ${code}`, 409);

  const customer = await resolveCustomer(input.customerCode || input.customerId);
  const items = await normalizeItems(input.items);
  const totals = calcTotals(items);
  const salesStaffCode = cleanText(input.salesStaffCode || customer.salesStaffCode);
  const deliveryStaffCode = cleanText(input.deliveryStaffCode || customer.deliveryStaffCode);

  const doc = await SalesOrder.create({
    id: cleanText(input.id) || code,
    code,
    normalizedCode,
    source: cleanText(input.source || 'MANUAL').toUpperCase(),
    customerId: cleanText(customer.id || customer._id),
    customerCode: cleanText(customer.code || customer.customerCode),
    customerName: cleanText(input.customerName) || customer.name || customer.customerName || '',
    customerPhone: cleanText(input.customerPhone || customer.phone),
    customerAddress: cleanText(input.customerAddress) || customer.address || '',
    salesStaffCode,
    salesStaffName: await resolveStaffName(salesStaffCode, input.salesStaffName || customer.salesStaffName),
    deliveryStaffCode,
    deliveryStaffName: await resolveStaffName(deliveryStaffCode, input.deliveryStaffName || customer.deliveryStaffName),
    deliveryDate: cleanText(input.deliveryDate),
    items,
    itemCount: items.length,
    totalAmount: amountOf(totals.totalAmount),
    discountAmount: amountOf(totals.discountAmount),
    payableAmount: amountOf(totals.payableAmount),
    finalAmount: amountOf(totals.payableAmount),
    status: 'pending',
    deliveryStatus: 'pending',
    accountingStatus: 'pending',
    masterOrderId: '',
    masterOrderCode: '',
    note: cleanText(input.note),
  });
  return doc.toObject();
}

function buildListFilter(query = {}) {
  const filter = {};
  if (query.deliveryDate) filter.deliveryDate = cleanText(query.deliveryDate);
  if (query.dateFrom || query.dateTo) {
    filter.deliveryDate = {};
    if (query.dateFrom) filter.deliveryDate.$gte = cleanText(query.dateFrom);
    if (query.dateTo) filter.deliveryDate.$lte = cleanText(query.dateTo);
  }
  if (query.customerCode) filter.customerCode = cleanText(query.customerCode);
  if (query.salesStaffCode) filter.salesStaffCode = cleanText(query.salesStaffCode);
  if (query.deliveryStaffCode) filter.deliveryStaffCode = cleanText(query.deliveryStaffCode);
  if (query.status) filter.status = cleanText(query.status);
  if (query.deliveryStatus) filter.deliveryStatus = cleanText(query.deliveryStatus);
  if (query.accountingStatus) filter.accountingStatus = cleanText(query.accountingStatus);
  if (query.masterOrderId) filter.masterOrderId = cleanText(query.masterOrderId);
  if (query.masterOrderCode) filter.masterOrderCode = cleanText(query.masterOrderCode);
  const keyword = cleanText(query.q || query.keyword);
  if (keyword) {
    const regex = safeRegex(keyword);
    filter.$or = [
      { code: regex }, { customerCode: regex }, { customerName: regex },
      { salesStaffCode: regex }, { salesStaffName: regex }, { deliveryStaffCode: regex },
      { deliveryStaffName: regex }, { masterOrderCode: regex },
    ];
  }
  if (!Object.keys(filter).length) {
    // Professional guard: list API defaults to recent rows and never scans huge tables unbounded.
    filter.createdAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  }
  return filter;
}

async function listSalesOrders(query = {}) {
  const filter = buildListFilter(query);
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), MAX_LIMIT);
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    SalesOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SalesOrder.countDocuments(filter),
  ]);
  return { rows, total, page, limit };
}

async function getSalesOrder(id) { return findSalesOrderOrThrow(id); }

async function updateSalesOrder(id, input = {}) {
  const existing = await findSalesOrderOrThrow(id);
  if (!EDITABLE_STATUS.includes(existing.status) || existing.accountingStatus !== 'pending') {
    throw httpError('Chỉ được sửa đơn đang pending và chưa xác nhận kế toán', 409);
  }
  const update = {};
  if (input.deliveryDate !== undefined) update.deliveryDate = cleanText(input.deliveryDate);
  if (input.note !== undefined) update.note = cleanText(input.note);
  if (input.salesStaffCode !== undefined) {
    update.salesStaffCode = cleanText(input.salesStaffCode);
    update.salesStaffName = await resolveStaffName(update.salesStaffCode, input.salesStaffName);
  }
  if (input.deliveryStaffCode !== undefined) {
    update.deliveryStaffCode = cleanText(input.deliveryStaffCode);
    update.deliveryStaffName = await resolveStaffName(update.deliveryStaffCode, input.deliveryStaffName);
  }
  if (Array.isArray(input.items)) {
    const items = await normalizeItems(input.items);
    const totals = calcTotals(items);
    update.items = items;
    update.itemCount = items.length;
    update.totalAmount = amountOf(totals.totalAmount);
    update.discountAmount = amountOf(totals.discountAmount);
    update.payableAmount = amountOf(totals.payableAmount);
    update.finalAmount = amountOf(totals.payableAmount);
  }
  return SalesOrder.findByIdAndUpdate(existing._id, { $set: update }, { new: true }).lean();
}

async function cancelSalesOrder(id, reason = '') {
  const existing = await findSalesOrderOrThrow(id);
  if (['posted', 'confirmed'].includes(existing.accountingStatus)) throw httpError('Đơn đã kế toán xác nhận, không được hủy thường', 409);

  if (existing.masterOrderId || existing.masterOrderCode) {
    await MasterOrder.updateOne(
      { $or: [{ id: existing.masterOrderId || '__none__' }, { code: existing.masterOrderCode || '__none__' }] },
      { $pull: { salesOrderIds: existing.id || String(existing._id), salesOrderCodes: existing.code } }
    );
  }

  return SalesOrder.findByIdAndUpdate(existing._id, {
    $set: {
      status: 'cancelled',
      deliveryStatus: 'cancelled',
      accountingStatus: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: cleanText(reason),
      masterOrderId: '',
      masterOrderCode: '',
    },
  }, { new: true }).lean();
}

function normalizeImportRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    orderCode: cleanText(row.orderCode || row.code || row.salesOrderCode),
    customerCode: cleanText(row.customerCode),
    customerName: cleanText(row.customerName),
    deliveryDate: cleanText(row.deliveryDate),
    salesStaffCode: cleanText(row.salesStaffCode),
    deliveryStaffCode: cleanText(row.deliveryStaffCode),
    productCode: cleanText(row.productCode),
    productName: cleanText(row.productName),
    quantity: Number(row.quantity ?? row.qty ?? 0),
    price: Number(row.price ?? row.salePrice ?? 0),
    unit: cleanText(row.unit),
    warehouseCode: cleanText(row.warehouseCode),
    source: cleanText(row.source || 'DMS').toUpperCase(),
  })).filter((row) => row.orderCode || row.customerCode || row.productCode);
}

async function importPreview(input = {}) {
  const rows = normalizeImportRows(input.rows || input.data || []);
  const grouped = new Map();
  for (const row of rows) {
    const key = row.orderCode;
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, { orderCode: key, customerCode: row.customerCode, customerName: row.customerName, deliveryDate: row.deliveryDate, source: row.source, items: [] });
    grouped.get(key).items.push(row);
  }

  const orderCodes = [...grouped.keys()];
  const customerCodes = [...new Set([...grouped.values()].map((x) => x.customerCode).filter(Boolean))];
  const productCodes = [...new Set(rows.map((x) => x.productCode).filter(Boolean))];
  const [duplicates, customers, products] = await Promise.all([
    SalesOrder.find({ $or: [{ code: { $in: orderCodes } }, { normalizedCode: { $in: orderCodes.map(normalizeOrderCode) } }] }).select('code normalizedCode').lean(),
    Customer.find({ $or: [{ code: { $in: customerCodes } }, { customerCode: { $in: customerCodes } }] }).select('code customerCode customerName name').lean(),
    Product.find({ code: { $in: productCodes } }).select('code name salePrice').lean(),
  ]);
  const duplicateSet = new Set(duplicates.flatMap((x) => [cleanText(x.code), cleanText(x.normalizedCode)]));
  const customerSet = new Set(customers.flatMap((x) => [cleanText(x.code), cleanText(x.customerCode)]));
  const productSet = new Set(products.map((x) => cleanText(x.code)));

  const previewRows = [...grouped.values()].map((group) => {
    const messages = [];
    if (!group.customerCode || !customerSet.has(group.customerCode)) messages.push(`Không tìm thấy khách hàng ${group.customerCode || '(trống)'}`);
    if (duplicateSet.has(group.orderCode) || duplicateSet.has(normalizeOrderCode(group.orderCode))) messages.push(`Trùng đơn ${group.orderCode}`);
    for (const [idx, item] of group.items.entries()) {
      if (!item.productCode || !productSet.has(item.productCode)) messages.push(`Dòng ${idx + 1}: không tìm thấy sản phẩm ${item.productCode || '(trống)'}`);
      if (item.quantity <= 0) messages.push(`Dòng ${idx + 1}: số lượng phải lớn hơn 0`);
    }
    const totalAmount = amountOf(group.items.reduce((sum, item) => sum + item.quantity * item.price, 0));
    return { ...group, totalAmount, status: messages.length ? 'error' : 'ok', messages };
  });
  return { rows: previewRows, total: previewRows.length };
}

async function importConfirm(input = {}) {
  const preview = input.previewRows ? { rows: input.previewRows } : await importPreview(input);
  const valid = preview.rows.filter((row) => row.status === 'ok');
  const docs = [];
  for (const row of valid) {
    const order = await createSalesOrder({
      code: row.orderCode,
      customerCode: row.customerCode,
      customerName: row.customerName,
      deliveryDate: row.deliveryDate,
      source: row.source || 'DMS',
      items: row.items,
    });
    docs.push(order);
  }
  return { inserted: docs.length, rows: docs };
}

module.exports = {
  createSalesOrder,
  listSalesOrders,
  getSalesOrder,
  updateSalesOrder,
  cancelSalesOrder,
  importPreview,
  importConfirm,
  findSalesOrderOrThrow,
};
