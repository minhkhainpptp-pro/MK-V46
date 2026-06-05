const mongoose = require('mongoose');
const MasterOrderSchema = new mongoose.Schema({
  id: { type: String, index: true },
  code: { type: String, index: true },
  deliveryDate: { type: String, index: true },
  deliveryStaffCode: { type: String, index: true },
  deliveryStaffName: String,
  salesOrderIds: [String],
  salesOrderCodes: [String],
  status: { type: String, default: 'assigned', index: true },
  accountingConfirmed: { type: Boolean, default: false, index: true },
  accountingStatus: { type: String, default: 'pending', index: true },
  totalAmount: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('MasterOrder', MasterOrderSchema);
