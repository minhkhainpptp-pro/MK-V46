const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  code: { type: String, required: true, unique: true, index: true },
  deliveryDate: { type: String, required: true, index: true },
  deliveryStaffCode: { type: String, required: true, index: true },
  deliveryStaffName: { type: String, default: '' },

  salesOrderIds: { type: [String], default: [], index: true },
  salesOrderCodes: { type: [String], default: [], index: true },

  customerCount: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },

  status: { type: String, enum: ['active', 'created', 'delivered', 'cancelled', 'accounting_confirmed'], default: 'active', index: true },
  deliveryStatus: { type: String, enum: ['pending', 'delivered', 'cancelled'], default: 'pending', index: true },
  accountingStatus: { type: String, enum: ['pending', 'posted', 'cancelled', 'confirmed'], default: 'pending', index: true },
  accountingConfirmed: { type: Boolean, default: false },
  accountingConfirmedAt: { type: Date },
  accountingConfirmedBy: { type: String, default: '' },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String, default: '' },
  note: { type: String, default: '' },
});

schema.index({ deliveryDate: 1, deliveryStaffCode: 1 }, { name: 'idx_mo_delivery_staff' });
schema.index({ accountingStatus: 1, deliveryDate: 1 }, { name: 'idx_mo_accounting_date' });

module.exports = mongoose.models.MasterOrder || mongoose.model('MasterOrder', schema, 'masterOrders');
