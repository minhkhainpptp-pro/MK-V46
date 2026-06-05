const MasterOrder = require('../models/MasterOrder');

async function getAssignment(masterOrderIdOrCode) {
  const key = String(masterOrderIdOrCode || '').trim();
  if (!key) throw Object.assign(new Error('Thiếu mã đơn tổng'), { status: 400 });
  return MasterOrder.findOne({ $or: [{ id: key }, { code: key }] }).lean();
}

module.exports = { getAssignment };
