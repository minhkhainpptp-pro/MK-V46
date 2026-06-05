const mongoose = require('mongoose');
const FundLedgerSchema = new mongoose.Schema({
  id: { type: String, index: true },
  type: { type: String, index: true },
  date: { type: String, index: true },
  customerCode: String,
  customerName: String,
  salesOrderId: String,
  masterOrderId: { type: String, index: true },
  cashAmount: { type: Number, default: 0 },
  bankAmount: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  note: String,
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('FundLedger', FundLedgerSchema);
