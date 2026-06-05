const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const JournalLineSchema = new mongoose.Schema({
  accountCode: { type: String, default: '' },
  accountName: { type: String, default: '' },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  note: { type: String, default: '' },
}, { _id: false });

const schema = createBaseSchema({
  code: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['SALE', 'RETURN', 'RECEIPT', 'PAYMENT', 'INVENTORY_OUT', 'INVENTORY_IN', 'BONUS'],
    required: true,
    index: true,
  },
  date: { type: String, required: true, index: true },

  customerCode: { type: String, default: '', index: true },
  customerName: { type: String, default: '' },

  salesOrderId: { type: String, default: '', index: true },
  salesOrderCode: { type: String, default: '', index: true },
  masterOrderId: { type: String, default: '', index: true },
  masterOrderCode: { type: String, default: '', index: true },

  amount: { type: Number, default: 0 },
  lines: { type: [JournalLineSchema], default: [] },

  sourceType: { type: String, default: '', index: true },
  sourceId: { type: String, default: '', index: true },
  sourceCode: { type: String, default: '' },
  note: { type: String, default: '' },
});

schema.index({ date: 1, type: 1 }, { name: 'idx_journal_date_type' });
schema.index({ sourceType: 1, sourceId: 1, type: 1 }, {
  name: 'idx_journal_source_unique',
  unique: true,
  partialFilterExpression: {
    sourceType: { $type: 'string' },
    sourceId: { $type: 'string' },
    type: { $type: 'string' },
  },
});

module.exports = mongoose.models.Journal || mongoose.model('Journal', schema, 'journals');
