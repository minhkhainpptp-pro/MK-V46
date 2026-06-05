const SalesOrder = require('../models/SalesOrder');
const ReturnOrder = require('../models/ReturnOrder');
const { normalizeOrderCode } = require('../utils/normalizeCode');
const { roundMoney } = require('../utils/money.util');

function returnLinePrice(order, productCode) {
  const item = (order.items || []).find(x => String(x.productCode) === String(productCode));
  return roundMoney(item ? item.price : 0);
}

async function listDeliveryOrders(query) {
  if (!query.deliveryDate) throw Object.assign(new Error('Thiếu ngày giao'), { status: 400 });
  const filter = { deliveryDate: query.deliveryDate };
  if (query.deliveryStaffCode) filter.deliveryStaffCode = query.deliveryStaffCode;
  if (query.salesStaffCode) filter.salesStaffCode = query.salesStaffCode;
  if (query.status) filter.status = query.status;

  const orders = await SalesOrder.find(filter)
    .select('id code customerCode customerName salesStaffCode salesStaffName deliveryStaffCode deliveryStaffName deliveryDate status deliveryStatus accountingStatus totalAmount')
    .sort({ customerName: 1 })
    .limit(500)
    .lean();

  const ids = orders.map(o => o.id);
  const codes = orders.map(o => o.code);
  const returns = await ReturnOrder.aggregate([
    { $match: { status: 'active', $or: [{ salesOrderId: { $in: ids } }, { salesOrderCode: { $in: codes } }] } },
    { $group: { _id: '$salesOrderId', amount: { $sum: '$amount' }, qty: { $sum: '$returnQty' } } }
  ]);
  const returnMap = new Map(returns.map(r => [r._id, r]));
  return orders.map(o => ({ ...o, returnAmount: roundMoney(returnMap.get(o.id)?.amount || 0) }));
}

async function getDeliveryOrderDetail(id) {
  const order = await SalesOrder.findOne({ $or: [{ id }, { code: id }] }).lean();
  if (!order) throw Object.assign(new Error('Không tìm thấy đơn'), { status: 404 });
  const returnLines = await ReturnOrder.find({
    status: 'active',
    $or: [{ salesOrderId: order.id }, { salesOrderCode: order.code }],
  }).lean();
  return { order, returnLines };
}

async function confirmDelivery(input) {
  const order = await SalesOrder.findOne({ $or: [{ id: input.salesOrderId }, { code: input.salesOrderCode }] }).lean();
  if (!order) throw Object.assign(new Error('Không tìm thấy đơn giao'), { status: 404 });

  const returnLines = (input.returnLines || [])
    .map(line => ({ ...line, returnQty: Number(line.returnQty || 0) }))
    .filter(line => line.returnQty > 0);

  await ReturnOrder.deleteMany({ salesOrderId: order.id, status: 'active' });

  if (returnLines.length) {
    const docs = returnLines.map(line => {
      const price = returnLinePrice(order, line.productCode);
      const amount = roundMoney(line.returnQty * price);
      return {
        id: `RO-${order.code}-${line.productCode}`,
        code: `RO-${order.code}`,
        salesOrderId: order.id,
        salesOrderCode: order.code,
        normalizedSalesOrderCode: normalizeOrderCode(order.code),
        customerCode: order.customerCode,
        customerName: order.customerName,
        productCode: line.productCode,
        productName: line.productName,
        returnQty: line.returnQty,
        price,
        amount,
        deliveryDate: order.deliveryDate,
        deliveryStaffCode: order.deliveryStaffCode,
        salesStaffCode: order.salesStaffCode,
        status: 'active',
      };
    });
    await ReturnOrder.insertMany(docs, { ordered: false });
  }

  await SalesOrder.updateOne(
    { id: order.id },
    { $set: { deliveryStatus: 'delivered', status: 'delivered' } }
  );

  return { ok: true, salesOrderId: order.id, returnLineCount: returnLines.length };
}

module.exports = { listDeliveryOrders, getDeliveryOrderDetail, confirmDelivery };
