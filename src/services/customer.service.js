const Customer = require('../models/Customer');
const { validateCustomerPayload } = require('../utils/validation.util');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCustomerPayload(input = {}, options = {}) {
  const customerCode = String(
    input.customerCode || input.code || ''
  ).trim();

  const customerName = String(
    input.customerName || input.name || ''
  ).trim();

  const payload = {
    customerCode,
    customerName,

    // `code` remains as compatibility alias for old UI/API payloads.
    code: customerCode,
    name: customerName,

    phone: String(input.phone || '').trim(),
    address: String(input.address || '').trim(),

    routeCode: String(input.routeCode || '').trim(),
    routeName: String(input.routeName || '').trim(),

    salesStaffCode: String(input.salesStaffCode || '').trim(),
    salesStaffName: String(input.salesStaffName || '').trim(),

    deliveryStaffCode: String(input.deliveryStaffCode || '').trim(),
    deliveryStaffName: String(input.deliveryStaffName || '').trim(),

    status: String(input.status || 'active').trim() || 'active',
    isActive: input.isActive !== false && input.status !== 'inactive',
  };

  if (options.partial) {
    Object.keys(payload).forEach((key) => {
      const raw = input[key];
      const aliasProvided =
        (key === 'customerCode' && (input.customerCode !== undefined || input.code !== undefined)) ||
        (key === 'customerName' && (input.customerName !== undefined || input.name !== undefined)) ||
        (key === 'code' && (input.customerCode !== undefined || input.code !== undefined)) ||
        (key === 'name' && (input.customerName !== undefined || input.name !== undefined));

      if (raw === undefined && !aliasProvided && key !== 'isActive' && key !== 'status') {
        delete payload[key];
      }
    });

    if (input.isActive === undefined && input.status === undefined) delete payload.isActive;
    if (input.status === undefined) delete payload.status;
  }

  return payload;
}

function buildCustomerFilter(query = {}) {
  const filter = {};

  if (query.isActive !== undefined) filter.isActive = String(query.isActive) !== 'false';
  if (query.status) filter.status = String(query.status).trim();
  if (query.salesStaffCode) filter.salesStaffCode = String(query.salesStaffCode).trim();
  if (query.deliveryStaffCode) filter.deliveryStaffCode = String(query.deliveryStaffCode).trim();
  if (query.routeCode) filter.routeCode = String(query.routeCode).trim();

  const keyword = String(query.q || query.keyword || '').trim();
  if (keyword) {
    const rx = new RegExp(escapeRegex(keyword), 'i');
    filter.$or = [
      { customerCode: rx },
      { customerName: rx },
      { phone: rx },
    ];
  }

  return filter;
}

async function listCustomers(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500);
  const filter = buildCustomerFilter(query);
  const rows = await Customer.find(filter)
    .sort({ customerCode: 1 })
    .limit(limit)
    .lean();
  const total = await Customer.countDocuments(filter);
  return { rows, total };
}

async function getCustomer(id) {
  const doc = await Customer.findById(id).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy khách hàng'), { status: 404 });
  return doc;
}

async function createCustomer(input = {}) {
  validateCustomerPayload(input);
  const payload = normalizeCustomerPayload(input);

  if (!payload.customerCode) throw Object.assign(new Error('Thiếu mã khách hàng'), { status: 400 });
  if (!payload.customerName) throw Object.assign(new Error('Thiếu tên khách hàng'), { status: 400 });

  const duplicated = await Customer.exists({
    $or: [
      { customerCode: payload.customerCode },
      { code: payload.customerCode },
    ],
  });
  if (duplicated) throw Object.assign(new Error(`Khách hàng đã tồn tại: ${payload.customerCode}`), { status: 409 });

  return Customer.create(payload);
}

async function updateCustomer(id, input = {}) {
  const payload = normalizeCustomerPayload(input, { partial: true });
  delete payload._id;
  delete payload.id;

  if (payload.customerCode !== undefined && !payload.customerCode) {
    throw Object.assign(new Error('Thiếu mã khách hàng'), { status: 400 });
  }
  if (payload.customerName !== undefined && !payload.customerName) {
    throw Object.assign(new Error('Thiếu tên khách hàng'), { status: 400 });
  }

  if (payload.customerCode) {
    const duplicated = await Customer.exists({
      _id: { $ne: id },
      $or: [
        { customerCode: payload.customerCode },
        { code: payload.customerCode },
      ],
    });
    if (duplicated) throw Object.assign(new Error(`Khách hàng đã tồn tại: ${payload.customerCode}`), { status: 409 });
  }

  const doc = await Customer.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy khách hàng'), { status: 404 });
  return doc;
}

async function deleteCustomer(id) {
  const doc = await Customer.findByIdAndUpdate(
    id,
    { isActive: false, status: 'inactive' },
    { new: true }
  ).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy khách hàng'), { status: 404 });
  return doc;
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  buildCustomerFilter,
  normalizeCustomerPayload,
};
