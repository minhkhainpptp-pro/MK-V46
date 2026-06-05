const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  code: { type: String, required: true, index: true },
  type: { type: String, enum: ['CASH_RECEIPT', 'BANK_RECEIPT', 'CASH_PAYMENT', 'BANK_DEPOSIT', 'BONUS_PAYMENT'], required: true, index: true },
  method: { type: String, enum: ['cash', 'bank', 'other'], default: 'cash', index: true },
  amount: { type: Number, required: true, default: 0 },
  date: { type: String, required: true, index: true },
  customerCode: { type: String, default: '', index: true },
  customerName: { type: String, default: '' },
  salesOrderId: { type: String, default: '', index: true },
  salesOrderCode: { type: String, default: '' },
  masterOrderId: { type: String, default: '', index: true },
  masterOrderCode: { type: String, default: '' },
  note: { type: String, default: '' },
  sourceType: { type: String, default: '', index: true },
  sourceId: { type: String, default: '', index: true },
});

schema.index({ date: 1, type: 1 }, { name: 'idx_fund_date_type' });
schema.index({ masterOrderId: 1 }, { name: 'idx_fund_master_order_id' });
schema.index({ sourceType: 1, sourceId: 1, type: 1 }, { name: 'idx_fund_source_unique', unique: true, partialFilterExpression: { sourceType: { $type: 'string' }, sourceId: { $type: 'string' }, type: { $type: 'string' } } });

module.exports = mongoose.models.FundLedger || mongoose.model('FundLedger', schema, 'fundLedgers');
