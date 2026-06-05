const SalesOrder = require('../../models/SalesOrder');
const ReturnOrder = require('../../models/ReturnOrder');
const ArLedger = require('../../models/ArLedger');
const { roundMoney } = require('../../utils/money.util');

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value) {
  return String(value || '').trim();
}

function amountOf(value) {
  return roundMoney(Number(value || 0));
}

async function getDeliveryReport(query = {}) {
  if (!query.deliveryDate && !query.date) throw httpError('Thiếu ngày báo cáo', 400);
  const date = cleanText(query.deliveryDate || query.date);

  const salesFilter = { deliveryDate: date, status: { $ne: 'cancelled' } };
  const returnFilter = { deliveryDate: date, status: { $ne: 'cancelled' } };
  const receiptFilter = { date, type: 'AR_RECEIPT' };

  if (query.deliveryStaffCode) {
    salesFilter.deliveryStaffCode = cleanText(query.deliveryStaffCode);
    returnFilter.deliveryStaffCode = cleanText(query.deliveryStaffCode);
    // arLedgers intentionally has no deliveryStaffCode in core schema; filter receipts by createdBy when app sends deliveryStaffCode.
    receiptFilter.createdBy = cleanText(query.deliveryStaffCode);
  }
  if (query.salesStaffCode) {
    salesFilter.salesStaffCode = cleanText(query.salesStaffCode);
    returnFilter.salesStaffCode = cleanText(query.salesStaffCode);
  }

  const [salesOrders, returnOrders, receiptRows] = await Promise.all([
    SalesOrder.find(salesFilter)
      .select('id code customerCode customerName deliveryDate deliveryStaffCode deliveryStaffName salesStaffCode salesStaffName status deliveryStatus totalAmount finalAmount')
      .limit(1000)
      .lean(),
    ReturnOrder.find(returnFilter)
      .select('id code salesOrderId salesOrderCode customerCode customerName deliveryDate deliveryStaffCode deliveryStaffName totalReturnQty totalReturnAmount status')
      .limit(1000)
      .lean(),
    ArLedger.find(receiptFilter)
      .select('id code customerCode customerName salesOrderId salesOrderCode credit amount date createdBy')
      .limit(1000)
      .lean(),
  ]);

  const deliveredOrders = salesOrders.filter((order) => order.deliveryStatus === 'delivered' || order.status === 'delivered' || order.status === 'accounting_confirmed');
  const undeliveredOrders = salesOrders.filter((order) => !(order.deliveryStatus === 'delivered' || order.status === 'delivered' || order.status === 'accounting_confirmed'));

  const deliveredAmount = deliveredOrders.reduce((sum, order) => sum + amountOf(order.finalAmount ?? order.totalAmount), 0);
  const totalReturnAmount = returnOrders.reduce((sum, order) => sum + amountOf(order.totalReturnAmount), 0);
  const totalReceiptAmount = receiptRows.reduce((sum, row) => sum + amountOf(row.credit || row.amount), 0);

  return {
    deliveryDate: date,
    summary: {
      orderCount: salesOrders.length,
      deliveredCount: deliveredOrders.length,
      undeliveredCount: undeliveredOrders.length,
      deliveredAmount: amountOf(deliveredAmount),
      returnOrderCount: returnOrders.length,
      totalReturnAmount: amountOf(totalReturnAmount),
      receiptCount: receiptRows.length,
      totalReceiptAmount: amountOf(totalReceiptAmount),
    },
    deliveredOrders,
    undeliveredOrders,
    returnOrders,
    receipts: receiptRows,
  };
}

module.exports = { getDeliveryReport };
