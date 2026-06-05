const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const ReturnItemSchema = new mongoose.Schema({
  productCode: { type: String, required: true, index: true },
  productName: { type: String, default: '' },
  orderedQty: { type: Number, default: 0 },
  deliveredQty: { type: Number, default: 0 },
  returnQty: { type: Number, required: true, min: 0 },
  price: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  returnAmount: { type: Number, default: 0 },
}, { _id: false });

const schema = createBaseSchema({
  code: { type: String, required: true, index: true },
  salesOrderId: { type: String, required: true, index: true },
  salesOrderCode: { type: String, required: true, index: true },
  normalizedSalesOrderCode: { type: String, default: '', index: true },
  masterOrderId: { type: String, default: '', index: true },
  masterOrderCode: { type: String, default: '', index: true },

  customerCode: { type: String, default: '', index: true },
  customerName: { type: String, default: '' },
  productCode: { type: String, default: '', index: true },
  productName: { type: String, default: '' },
  returnQty: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },

  items: { type: [ReturnItemSchema], default: [] },
  totalReturnQty: { type: Number, default: 0 },
  totalReturnAmount: { type: Number, default: 0 },

  deliveryDate: { type: String, default: '', index: true },
  deliveryStaffCode: { type: String, default: '', index: true },
  deliveryStaffName: { type: String, default: '' },
  salesStaffCode: { type: String, default: '', index: true },
  salesStaffName: { type: String, default: '' },

  status: { type: String, enum: ['pending', 'active', 'cancelled', 'posted', 'confirmed'], default: 'active', index: true },
  accountingStatus: { type: String, enum: ['pending', 'posted', 'cancelled', 'confirmed'], default: 'pending', index: true },
  cancelledAt: { type: Date },
  cancelReason: { type: String, default: '' },
  confirmedAt: { type: Date },
  confirmedBy: { type: String, default: '' },
  arPosted: { type: Boolean, default: false },
  note: { type: String, default: '' },
});

schema.index({ salesOrderId: 1, status: 1 }, { name: 'idx_ro_so_status' });
schema.index({ salesOrderCode: 1, status: 1 }, { name: 'idx_ro_code_status' });
schema.index({ deliveryDate: 1, deliveryStaffCode: 1 }, { name: 'idx_ro_delivery_staff' });

module.exports = mongoose.models.ReturnOrder || mongoose.model('ReturnOrder', schema, 'returnOrders');
