const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  // Catalog customer fields - single canonical naming.
  customerCode: { type: String, required: true, trim: true },
  customerName: { type: String, required: true, trim: true },

  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },

  routeCode: { type: String, default: '', trim: true },
  routeName: { type: String, default: '', trim: true },

  salesStaffCode: { type: String, default: '', trim: true },
  salesStaffName: { type: String, default: '', trim: true },

  deliveryStaffCode: { type: String, default: '', trim: true },
  deliveryStaffName: { type: String, default: '', trim: true },

  isActive: { type: Boolean, default: true, index: true },
});

// Keep base `code` as a compatibility/business alias, but customerCode is the canonical key.
schema.pre('validate', function normalizeCustomerFields() {
  if (!this.customerCode && this.code) this.customerCode = this.code;
  if (!this.customerName && this.name) this.customerName = this.name;

  this.customerCode = String(this.customerCode || '').trim();
  this.customerName = String(this.customerName || '').trim();

  if (!this.code && this.customerCode) this.code = this.customerCode;
  this.code = String(this.code || this.customerCode || '').trim();

  if (this.name !== undefined || this.customerName) {
    this.name = String(this.customerName || this.name || '').trim();
  }
});

schema.index(
  { customerCode: 1 },
  {
    unique: true,
    name: 'idx_customer_customer_code_unique',
    partialFilterExpression: { customerCode: { $type: 'string', $gt: '' } },
  }
);
schema.index({ salesStaffCode: 1 }, { name: 'idx_customer_sales_staff_code' });
schema.index({ deliveryStaffCode: 1 }, { name: 'idx_customer_delivery_staff_code' });
schema.index({ routeCode: 1 }, { name: 'idx_customer_route_code' });
schema.index({ customerName: 'text', customerCode: 'text', phone: 'text' }, { name: 'idx_customer_search_text' });

module.exports = mongoose.models.Customer || mongoose.model('Customer', schema);
