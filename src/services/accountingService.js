const MasterOrder = require('../models/MasterOrder');
const SalesOrder = require('../models/SalesOrder');
const { postAccountingForMaster } = require('../core/postingEngine');

async function confirmMasterOrderAccounting(masterOrderId, paymentDrafts = []) {
  const master = await MasterOrder.findOne({ id: masterOrderId }).lean();
  if (!master) throw Object.assign(new Error('Không tìm thấy đơn tổng'), { status: 404 });
  if (master.accountingConfirmed) return { ok: true, skipped: true, reason: 'already_confirmed' };

  const orders = await SalesOrder.find({ id: { $in: master.salesOrderIds || [] }, deliveryStatus: 'delivered' }).lean();
  if (!orders.length) throw Object.assign(new Error('Chưa có đơn nào đã giao để xác nhận'), { status: 400 });

  const result = await postAccountingForMaster({ masterOrder: master, salesOrders: orders, paymentDrafts });
  await MasterOrder.updateOne({ id: master.id }, { $set: { accountingConfirmed: true, accountingStatus: 'posted' } });
  await SalesOrder.updateMany({ id: { $in: orders.map(o => o.id) } }, { $set: { accountingStatus: 'posted' } });
  return { ok: true, ...result };
}

module.exports = { confirmMasterOrderAccounting };
