const MasterOrder = require('../models/MasterOrder');
const SalesOrder = require('../models/SalesOrder');
const { uniqClean } = require('../utils/normalizeCode');

async function createMasterOrder(input) {
  const salesOrderIds = uniqClean(input.salesOrderIds);
  if (!salesOrderIds.length) throw Object.assign(new Error('Chưa chọn đơn con'), { status: 400 });
  const orders = await SalesOrder.find({ id: { $in: salesOrderIds }, status: 'pending' }).lean();
  if (orders.length !== salesOrderIds.length) throw Object.assign(new Error('Có đơn không tồn tại hoặc đã được gộp'), { status: 409 });

  const id = input.id || `MO${Date.now()}`;
  const code = input.code || `DT${String(Date.now()).slice(-6)}`;
  const totalAmount = orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const master = await MasterOrder.create({
    id, code,
    deliveryDate: input.deliveryDate || orders[0].deliveryDate,
    deliveryStaffCode: input.deliveryStaffCode || orders[0].deliveryStaffCode,
    deliveryStaffName: input.deliveryStaffName || orders[0].deliveryStaffName,
    salesOrderIds,
    salesOrderCodes: orders.map(o => o.code),
    totalAmount,
  });
  await SalesOrder.updateMany(
    { id: { $in: salesOrderIds } },
    { $set: { status: 'assigned', masterOrderId: id, masterOrderCode: code } }
  );
  return master.toObject();
}

async function getMasterWithChildren(masterOrderId) {
  const master = await MasterOrder.findOne({ id: masterOrderId }).lean();
  if (!master) throw Object.assign(new Error('Không tìm thấy đơn tổng'), { status: 404 });
  const orders = await SalesOrder.find({ id: { $in: master.salesOrderIds || [] } }).lean();
  return { master, orders };
}

module.exports = { createMasterOrder, getMasterWithChildren };
