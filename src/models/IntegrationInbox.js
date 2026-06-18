'use strict';

const mongoose = require('mongoose');
const flexModel = require('./_flexModel');

const Mixed = mongoose.Schema.Types.Mixed;

module.exports = flexModel('IntegrationInbox', 'integrationInboxes', {
  eventId: String,
  eventType: String,
  sourceSystem: String,
  sourceEntityType: String,
  sourceEntityId: String,
  sourceVersion: String,
  payloadHash: String,
  payload: Mixed,
  status: String,
  attemptCount: { type: Number, default: 0 },
  receivedAt: String,
  processingStartedAt: String,
  completedAt: String,
  failedAt: String,
  error: Mixed,
  result: Mixed,
  correlationId: String,
  createdAt: String,
  updatedAt: String
});
