const SalesOrder = require('../models/SalesOrder');
const { normalizeOrderCode } = require('../utils/normalizeCode');
const { roundMoney } = require('../utils/money.util');

function calcOrderTotal(items) {
  return (items || []).reduce((sum, item) => sum + roundMoney(item.amount || item.qty * item.price), 0);
}

async function createSalesOrder(input) {
  const code = String(input.code || input.id || '').trim();
  if (!code) throw Object.assign(new Error('Thiếu mã đơn'), { status: 400 });
  const normalizedCode = normalizeOrderCode(code);
  const duplicated = await SalesOrder.exists({ normalizedCode });
  if (duplicated) throw Object.assign(new Error(`Đơn đã tồn tại: ${code}`), { status: 409 });
  const items = (input.items || []).map(item => ({
    ...item,
    qty: Number(item.qty || 0),
    price: Number(item.price || 0),
    amount: roundMoney(item.amount || item.qty * item.price),
  }));
  const doc = await SalesOrder.create({
    id: input.id || `SO${Date.now()}`,
    code,
    normalizedCode,
    customerCode: input.customerCode,
    customerName: input.customerName,
    salesStaffCode: input.salesStaffCode,
    salesStaffName: input.salesStaffName,
    deliveryStaffCode: input.deliveryStaffCode,
    deliveryStaffName: input.deliveryStaffName,
    deliveryDate: input.deliveryDate,
    status: 'pending',
    deliveryStatus: 'pending',
    accountingStatus: 'pending',
    items,
    totalAmount: calcOrderTotal(items),
    note: input.note,
  });
  return doc.toObject();
}

async function listSalesOrders(query) {
  const filter = {};
  if (query.deliveryDate) filter.deliveryDate = query.deliveryDate;
  if (query.deliveryStaffCode) filter.deliveryStaffCode = query.deliveryStaffCode;
  if (query.salesStaffCode) filter.salesStaffCode = query.salesStaffCode;
  if (query.status) filter.status = query.status;
  const limit = Math.min(Number(query.limit || 100), 500);
  return SalesOrder.find(filter)
    .select('id code customerCode customerName salesStaffCode salesStaffName deliveryStaffCode deliveryStaffName deliveryDate status deliveryStatus accountingStatus totalAmount masterOrderId')
    .sort({ deliveryDate: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = { createSalesOrder, listSalesOrders };
