const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  phone: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  routeCode: { type: String, trim: true, default: '', index: true },
  salesStaffCode: { type: String, trim: true, default: '', index: true },
  deliveryStaffCode: { type: String, trim: true, default: '', index: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Customer', CustomerSchema);
