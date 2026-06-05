const mongoose = require('mongoose');
const SalesOrderItemSchema = new mongoose.Schema({
  productCode: String,
  productName: String,
  unit: String,
  qty: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  warehouseCode: String,
}, { _id: false });
const SalesOrderSchema = new mongoose.Schema({
  id: { type: String, index: true },
  code: { type: String, index: true },
  normalizedCode: { type: String, index: true },
  customerCode: { type: String, index: true },
  customerName: String,
  salesStaffCode: { type: String, index: true },
  salesStaffName: String,
  deliveryStaffCode: { type: String, index: true },
  deliveryStaffName: String,
  deliveryDate: { type: String, index: true },
  status: { type: String, default: 'pending', index: true },
  deliveryStatus: { type: String, default: 'pending', index: true },
  accountingStatus: { type: String, default: 'pending', index: true },
  masterOrderId: { type: String, index: true },
  masterOrderCode: String,
  items: [SalesOrderItemSchema],
  totalAmount: { type: Number, default: 0 },
  note: String,
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('SalesOrder', SalesOrderSchema);
