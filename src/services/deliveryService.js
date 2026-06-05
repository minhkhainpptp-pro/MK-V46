const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const ReturnOrder = require('../models/ReturnOrder');
const returnOrderService = require('./returnOrder.service');
const { roundMoney } = require('../utils/money.util');

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value) {
  return String(value || '').trim();
}

async function listDeliveryOrders(query) {
  if (!query.deliveryDate) throw httpError('Thiếu ngày giao', 400);
  const filter = { deliveryDate: query.deliveryDate };
  if (query.deliveryStaffCode) filter.deliveryStaffCode = query.deliveryStaffCode;
  if (query.salesStaffCode) filter.salesStaffCode = query.salesStaffCode;
  if (query.status) filter.status = query.status;

  const orders = await SalesOrder.find(filter)
    .select('id code customerCode customerName salesStaffCode salesStaffName deliveryStaffCode deliveryStaffName deliveryDate status deliveryStatus accountingStatus totalAmount finalAmount')
    .sort({ customerName: 1 })
    .limit(500)
    .lean();

  const ids = orders.map(o => cleanText(o.id || o._id)).filter(Boolean);
  const codes = orders.map(o => cleanText(o.code)).filter(Boolean);

  const returns = await ReturnOrder.find({
    status: { $ne: 'cancelled' },
    $or: [{ salesOrderId: { $in: ids } }, { salesOrderCode: { $in: codes } }],
  }).select('salesOrderId salesOrderCode totalReturnQty totalReturnAmount items').lean();

  const returnMap = new Map();
  for (const ro of returns) {
    const keys = [ro.salesOrderId, ro.salesOrderCode].map(cleanText).filter(Boolean);
    for (const key of keys) {
      const current = returnMap.get(key) || { qty: 0, amount: 0 };
      current.qty += Number(ro.totalReturnQty || 0);
      current.amount += Number(ro.totalReturnAmount || 0);
      returnMap.set(key, current);
    }
  }

  return orders.map(o => {
    const key1 = cleanText(o.id || o._id);
    const key2 = cleanText(o.code);
    const ret = returnMap.get(key1) || returnMap.get(key2) || { qty: 0, amount: 0 };
    return {
      ...o,
      returnQty: ret.qty,
      returnAmount: roundMoney(ret.amount),
    };
  });
}

async function getDeliveryOrderDetail(id) {
  const order = await SalesOrder.findOne({ $or: [{ id }, { code: id }] }).lean();
  if (!order) throw httpError('Không tìm thấy đơn', 404);
  const result = await returnOrderService.getReturnOrdersBySalesOrder(order.id || order.code);
  return { order, returnOrders: result.rows, returnLines: result.rows };
}

async function confirmDelivery(input) {
  const salesOrderId = cleanText(input.salesOrderId || input.id);
  const salesOrderCode = cleanText(input.salesOrderCode || input.code);
  const orderFilter = [];
  if (salesOrderId) {
    orderFilter.push({ id: salesOrderId });
    if (mongoose.Types.ObjectId.isValid(salesOrderId)) orderFilter.push({ _id: salesOrderId });
  }
  if (salesOrderCode) orderFilter.push({ code: salesOrderCode });
  const order = await SalesOrder.findOne({ $or: orderFilter }).lean();
  if (!order) throw httpError('Không tìm thấy đơn giao', 404);

  const returnLines = (input.returnLines || input.items || [])
    .map(line => ({ ...line, returnQty: Number(line.returnQty || 0) }))
    .filter(line => line.returnQty > 0);

  let returnOrder = null;
  if (returnLines.length) {
    returnOrder = await returnOrderService.createOrUpdateReturnOrder({
      salesOrderId: order.id || String(order._id),
      salesOrderCode: order.code,
      items: returnLines,
      note: input.note || '',
    });
  }

  await SalesOrder.updateOne(
    { _id: order._id },
    { $set: { deliveryStatus: 'delivered', status: 'delivered', deliveredAt: new Date() } }
  );

  return {
    ok: true,
    salesOrderId: order.id || String(order._id),
    salesOrderCode: order.code,
    returnLineCount: returnLines.length,
    returnOrder,
  };
}

module.exports = { listDeliveryOrders, getDeliveryOrderDetail, confirmDelivery };
