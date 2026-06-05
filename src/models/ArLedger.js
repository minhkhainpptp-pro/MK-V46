const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  code: { type: String, required: true, index: true },
  type: { type: String, enum: ['AR-SALE', 'AR-RETURN', 'AR-RECEIPT', 'AR-BONUS', 'AR-SALE-REV', 'AR_SALE', 'AR_RETURN', 'AR_RECEIPT', 'AR_DISCOUNT', 'AR_SALE_REVERSAL'], required: true, index: true },
  date: { type: String, required: true, index: true },
  customerCode: { type: String, required: true, index: true },
  customerName: { type: String, default: '' },
  salesOrderId: { type: String, default: '', index: true },
  salesOrderCode: { type: String, default: '', index: true },
  masterOrderId: { type: String, default: '', index: true },
  masterOrderCode: { type: String, default: '', index: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  note: { type: String, default: '' },
  sourceType: { type: String, default: '', index: true },
  sourceId: { type: String, default: '', index: true },
  sourceCode: { type: String, default: '' },
});

schema.index({ customerCode: 1, date: 1 }, { name: 'idx_ar_customer_date' });
schema.index({ salesOrderId: 1 }, { name: 'idx_ar_sales_order_id' });
schema.index({ masterOrderId: 1 }, { name: 'idx_ar_master_order_id' });
schema.index({ sourceType: 1, sourceId: 1, type: 1 }, { name: 'idx_ar_source_unique', unique: true, partialFilterExpression: { sourceType: { $type: 'string' }, sourceId: { $type: 'string' }, type: { $type: 'string' } } });

module.exports = mongoose.models.ArLedger || mongoose.model('ArLedger', schema, 'arLedgers');
