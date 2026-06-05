const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  method: { type: String, required: true },
  url: { type: String, required: true },
  path: { type: String, default: '' },
  statusCode: { type: Number, default: 0 },
  ms: { type: Number, default: 0 },
  queryCount: { type: Number, default: 0 },
  userCode: { type: String, default: '' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  requestId: { type: String, default: '' },
});

schema.index({ createdAt: -1 }, { name: 'idx_api_log_created_at' });
schema.index({ path: 1, createdAt: -1 }, { name: 'idx_api_log_path_created' });
schema.index({ statusCode: 1, createdAt: -1 }, { name: 'idx_api_log_status_created' });
schema.index({ ms: -1, createdAt: -1 }, { name: 'idx_api_log_ms_created' });

module.exports = mongoose.models.ApiLog || mongoose.model('ApiLog', schema, 'apiLogs');
