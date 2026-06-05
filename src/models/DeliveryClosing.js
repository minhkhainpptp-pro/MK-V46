const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  date: { type: String, required: true },
  deliveryStaffCode: { type: String, required: true },
  deliveryStaffName: { type: String, default: '' },
  expectedCash: { type: Number, default: 0 },
  actualCash: { type: Number, default: 0 },
  expectedBank: { type: Number, default: 0 },
  actualBank: { type: Number, default: 0 },
  expectedReturn: { type: Number, default: 0 },
  actualReturn: { type: Number, default: 0 },
  variance: { type: Number, default: 0 },
  note: { type: String, default: '' },
  closedBy: { type: String, default: '' },
  closedAt: { type: Date },
});

schema.index({ date: 1, deliveryStaffCode: 1 }, { name: 'idx_delivery_closing_date_staff_unique', unique: true });
schema.index({ deliveryStaffCode: 1, date: -1 }, { name: 'idx_delivery_closing_staff_date' });

module.exports = mongoose.models.DeliveryClosing || mongoose.model('DeliveryClosing', schema, 'deliveryClosings');
