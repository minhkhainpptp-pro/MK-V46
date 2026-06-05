const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  barcode: { type: String, trim: true, default: '', index: true },
  brand: { type: String, trim: true, default: '' },
  baseUnit: { type: String, trim: true, default: '' },
  salePrice: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 1 },
  defaultWarehouseCode: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Product', ProductSchema);
