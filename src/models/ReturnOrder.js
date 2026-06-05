const mongoose = require('mongoose');
const ReturnOrderSchema = new mongoose.Schema({
  id: { type: String, index: true },
  code: { type: String, index: true },
  salesOrderId: { type: String, index: true },
  salesOrderCode: { type: String, index: true },
  normalizedSalesOrderCode: { type: String, index: true },
  customerCode: { type: String, index: true },
  customerName: String,
  productCode: { type: String, index: true },
  productName: String,
  returnQty: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  deliveryDate: { type: String, index: true },
  deliveryStaffCode: { type: String, index: true },
  salesStaffCode: { type: String, index: true },
  status: { type: String, default: 'active', index: true },
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('ReturnOrder', ReturnOrderSchema);
