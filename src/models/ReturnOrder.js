const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const ReturnItemSchema = new mongoose.Schema({
  productCode: { type: String, required: true },
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
  code: { type: String, required: true },
  salesOrderId: { type: String, required: true },
  salesOrderCode: { type: String, required: true },
  normalizedSalesOrderCode: { type: String, default: '' },
  masterOrderId: { type: String, default: '' },
  masterOrderCode: { type: String, default: '' },

  customerCode: { type: String, default: '' },
  customerName: { type: String, default: '' },
  productCode: { type: String, default: '' },
  productName: { type: String, default: '' },
  returnQty: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },

  items: { type: [ReturnItemSchema], default: [] },
  totalReturnQty: { type: Number, default: 0 },
  totalReturnAmount: { type: Number, default: 0 },

  deliveryDate: { type: String, default: '' },
  deliveryStaffCode: { type: String, default: '' },
  deliveryStaffName: { type: String, default: '' },
  salesStaffCode: { type: String, default: '' },
  salesStaffName: { type: String, default: '' },

  status: { type: String, enum: ['pending', 'active', 'cancelled', 'posted', 'confirmed'], default: 'active' },
  accountingStatus: { type: String, enum: ['pending', 'posted', 'cancelled', 'confirmed'], default: 'pending' },
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
