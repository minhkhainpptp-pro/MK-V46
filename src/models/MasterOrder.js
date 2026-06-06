const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  code: { type: String, required: true, unique: true },
  deliveryDate: { type: String, required: true },
  deliveryStaffCode: { type: String, required: true },
  deliveryStaffName: { type: String, default: '' },

  salesOrderIds: { type: [String], default: [] },
  salesOrderCodes: { type: [String], default: [] },

  customerCount: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },

  status: { type: String, enum: ['active', 'created', 'delivered', 'cancelled', 'accounting_confirmed'], default: 'active' },
  deliveryStatus: { type: String, enum: ['pending', 'delivered', 'cancelled'], default: 'pending' },
  accountingStatus: { type: String, enum: ['pending', 'posted', 'cancelled', 'confirmed'], default: 'pending' },
  accountingConfirmed: { type: Boolean, default: false },
  accountingConfirmedAt: { type: Date },
  accountingConfirmedBy: { type: String, default: '' },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String, default: '' },
  note: { type: String, default: '' },
});

schema.index({ deliveryDate: 1, deliveryStaffCode: 1 }, { name: 'idx_mo_delivery_staff' });
schema.index({ deliveryDate: 1, status: 1 }, { name: 'idx_mo_delivery_status' });
schema.index({ deliveryDate: 1, salesOrderIds: 1 }, { name: 'idx_mo_delivery_sales_order_ids' });
schema.index({ deliveryDate: 1, salesOrderCodes: 1 }, { name: 'idx_mo_delivery_sales_order_codes' });
schema.index({ accountingStatus: 1, deliveryDate: 1 }, { name: 'idx_mo_accounting_date' });

module.exports = mongoose.models.MasterOrder || mongoose.model('MasterOrder', schema, 'masterOrders');
