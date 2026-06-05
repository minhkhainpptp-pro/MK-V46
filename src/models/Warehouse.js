const mongoose = require('mongoose');

const WarehouseSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Warehouse', WarehouseSchema);
