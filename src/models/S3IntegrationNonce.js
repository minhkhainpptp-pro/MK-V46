'use strict';

const flexModel = require('./_flexModel');

module.exports = flexModel('S3IntegrationNonce', 's3IntegrationNonces', {
  agentId: String,
  nonce: String,
  requestHash: String,
  usedAt: Date,
  expiresAt: Date
});
