const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  code: { type: String, required: true },
  type: { type: String, enum: ['AR-SALE', 'AR-RETURN', 'AR-RECEIPT', 'AR-BONUS', 'AR-SALE-REV', 'AR_SALE', 'AR_RETURN', 'AR_RECEIPT', 'AR_DISCOUNT', 'AR_SALE_REVERSAL'], required: true },
  date: { type: String, required: true },
  customerCode: { type: String, required: true },
  customerName: { type: String, default: '' },
  salesOrderId: { type: String, default: '' },
  salesOrderCode: { type: String, default: '' },
  masterOrderId: { type: String, default: '' },
  masterOrderCode: { type: String, default: '' },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  note: { type: String, default: '' },
  sourceType: { type: String, default: '' },
  sourceId: { type: String, default: '' },
  sourceCode: { type: String, default: '' },
});

schema.index({ customerCode: 1, date: 1 }, { name: 'idx_ar_customer_date' });
schema.index({ salesOrderId: 1 }, { name: 'idx_ar_sales_order_id' });
schema.index({ masterOrderId: 1 }, { name: 'idx_ar_master_order_id' });
schema.index({ sourceType: 1, sourceId: 1, type: 1 }, { name: 'idx_ar_source_unique', unique: true, partialFilterExpression: { sourceType: { $type: 'string' }, sourceId: { $type: 'string' }, type: { $type: 'string' } } });

module.exports = mongoose.models.ArLedger || mongoose.model('ArLedger', schema, 'arLedgers');
