const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  module: { type: String, required: true },
  action: { type: String, required: true },
  referenceId: { type: String, default: '' },
  referenceCode: { type: String, default: '' },
  userCode: { type: String, default: '' },
  before: { type: Object, default: undefined },
  after: { type: Object, default: undefined },
  metadata: { type: Object, default: undefined },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
});

schema.index({ module: 1, action: 1, createdAt: -1 }, { name: 'idx_audit_module_action_created' });
schema.index({ referenceId: 1 }, { name: 'idx_audit_reference_id' });
schema.index({ userCode: 1, createdAt: -1 }, { name: 'idx_audit_user_created' });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', schema, 'auditLogs');
