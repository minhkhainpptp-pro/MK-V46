const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  fullName: { type: String, default: '', trim: true },
  name: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  code: { type: String, default: '', trim: true },
  role: {
    type: String,
    enum: ['admin', 'manager', 'sales', 'warehouse', 'accountant', 'delivery'],
    default: 'sales'
  },
  staffCode: { type: String, default: '', trim: true },
  isActive: { type: Boolean, default: true },
  sourceSystem: { type: String, default: '', trim: true },
  sourceId: { type: String, default: '', trim: true },
  sourceVersion: { type: String, default: '', trim: true },
  sourceUpdatedAt: { type: String, default: '', trim: true },
  sourceHash: { type: String, default: '', trim: true },
  sourceSyncRunId: { type: String, default: '', trim: true },
  sourceActive: { type: Boolean, default: true },
  sourceReadOnly: { type: Boolean, default: false }
}, { timestamps: true, strict: false });

// Index được chuẩn hoá tập trung tại src/services/mongoIndexService.js.
// Giữ unique username ở schema field, các index truy vấn khác không khai báo lặp tại model.

module.exports = mongoose.model('User', userSchema);
