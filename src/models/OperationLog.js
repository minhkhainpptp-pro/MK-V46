const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  operationId: { type: String, required: true },
  type: { type: String, required: true },
  referenceId: { type: String, default: '' },
  referenceCode: { type: String, default: '' },
  status: { type: String, enum: ['started', 'completed', 'failed'], default: 'started' },
  resultSummary: { type: Object, default: undefined },
  errorMessage: { type: String, default: '' },
  userCode: { type: String, default: '' },
});

schema.index({ operationId: 1 }, { name: 'idx_operation_id_unique', unique: true });
schema.index({ type: 1, referenceId: 1 }, { name: 'idx_operation_type_reference' });
schema.index({ createdAt: -1 }, { name: 'idx_operation_created_at' });

module.exports = mongoose.models.OperationLog || mongoose.model('OperationLog', schema, 'operationLogs');
