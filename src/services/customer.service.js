const Customer = require('../models/Customer');

function buildCustomerFilter(query = {}) {
  const filter = {};
  if (query.isActive !== undefined) filter.isActive = String(query.isActive) !== 'false';
  if (query.salesStaffCode) filter.salesStaffCode = String(query.salesStaffCode).trim();
  if (query.deliveryStaffCode) filter.deliveryStaffCode = String(query.deliveryStaffCode).trim();
  if (query.routeCode) filter.routeCode = String(query.routeCode).trim();
  if (query.q) {
    const q = String(query.q).trim();
    filter.$or = [
      { code: new RegExp(q, 'i') },
      { name: new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') },
      { address: new RegExp(q, 'i') },
    ];
  }
  return filter;
}

async function listCustomers(query = {}) {
  const limit = Math.min(Number(query.limit || 100), 500);
  const filter = buildCustomerFilter(query);
  const rows = await Customer.find(filter).sort({ code: 1 }).limit(limit).lean();
  const total = await Customer.countDocuments(filter);
  return { rows, total };
}

async function getCustomer(id) {
  const doc = await Customer.findById(id).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy khách hàng'), { status: 404 });
  return doc;
}

async function createCustomer(input = {}) {
  const payload = {
    code: String(input.code || '').trim(),
    name: String(input.name || '').trim(),
    phone: String(input.phone || '').trim(),
    address: String(input.address || '').trim(),
    routeCode: String(input.routeCode || '').trim(),
    salesStaffCode: String(input.salesStaffCode || '').trim(),
    deliveryStaffCode: String(input.deliveryStaffCode || '').trim(),
    isActive: input.isActive !== false,
  };
  if (!payload.code) throw Object.assign(new Error('Thiếu mã khách hàng'), { status: 400 });
  if (!payload.name) throw Object.assign(new Error('Thiếu tên khách hàng'), { status: 400 });
  const duplicated = await Customer.exists({ code: payload.code });
  if (duplicated) throw Object.assign(new Error(`Khách hàng đã tồn tại: ${payload.code}`), { status: 409 });
  return Customer.create(payload);
}

async function updateCustomer(id, input = {}) {
  const payload = { ...input };
  delete payload._id;
  const doc = await Customer.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy khách hàng'), { status: 404 });
  return doc;
}

async function deleteCustomer(id) {
  const doc = await Customer.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy khách hàng'), { status: 404 });
  return doc;
}

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
