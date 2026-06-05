const mongoose = require('mongoose');
const ArLedgerSchema = new mongoose.Schema({
  id: { type: String, index: true },
  code: { type: String, index: true },
  type: { type: String, index: true },
  date: { type: String, index: true },
  customerCode: { type: String, index: true },
  customerName: String,
  salesOrderId: { type: String, index: true },
  salesOrderCode: String,
  masterOrderId: { type: String, index: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  note: String,
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('ArLedger', ArLedgerSchema);
