'use strict';

const mongoose = require('mongoose');
const flexModel = require('./_flexModel');

const Mixed = mongoose.Schema.Types.Mixed;

module.exports = flexModel('S3IntegrationError', 's3IntegrationErrors', {
  errorId: String,
  stream: String,
  direction: String,
  eventId: String,
  entityType: String,
  entityId: String,
  entityCode: String,
  severity: String,
  errorCode: String,
  message: String,
  details: Mixed,
  payloadHash: String,
  retryable: Boolean,
  status: String,
  attemptCount: { type: Number, default: 0 },
  firstOccurredAt: String,
  lastOccurredAt: String,
  nextAttemptAt: String,
  resolvedAt: String,
  resolvedBy: String,
  resolutionNote: String,
  correlationId: String,
  createdAt: String,
  updatedAt: String
});
