const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  code: { type: String, required: true },
  type: { type: String, enum: ['CASH_RECEIPT', 'BANK_RECEIPT', 'CASH_PAYMENT', 'BANK_DEPOSIT', 'BONUS_PAYMENT'], required: true },
  method: { type: String, enum: ['cash', 'bank', 'other'], default: 'cash' },
  amount: { type: Number, required: true, default: 0 },
  date: { type: String, required: true },
  customerCode: { type: String, default: '' },
  customerName: { type: String, default: '' },
  salesOrderId: { type: String, default: '' },
  salesOrderCode: { type: String, default: '' },
  masterOrderId: { type: String, default: '' },
  masterOrderCode: { type: String, default: '' },
  note: { type: String, default: '' },
  sourceType: { type: String, default: '' },
  sourceId: { type: String, default: '' },
});

schema.index({ date: 1, type: 1 }, { name: 'idx_fund_date_type' });
schema.index({ masterOrderId: 1 }, { name: 'idx_fund_master_order_id' });
schema.index({ sourceType: 1, sourceId: 1, type: 1 }, { name: 'idx_fund_source_unique', unique: true, partialFilterExpression: { sourceType: { $type: 'string' }, sourceId: { $type: 'string' }, type: { $type: 'string' } } });

module.exports = mongoose.models.FundLedger || mongoose.model('FundLedger', schema, 'fundLedgers');
