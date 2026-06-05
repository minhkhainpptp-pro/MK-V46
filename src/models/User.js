const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  phone: { type: String, trim: true, default: '' },
  username: { type: String, required: true, trim: true, unique: true, index: true },
  password: { type: String, required: true, select: false },
  roleCode: { type: String, required: true, trim: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('User', UserSchema);
