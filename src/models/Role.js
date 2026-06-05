const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  permissions: { type: [String], default: [] },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Role', RoleSchema);
