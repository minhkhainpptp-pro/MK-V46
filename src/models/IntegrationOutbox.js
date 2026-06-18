'use strict';

const mongoose = require('mongoose');
const flexModel = require('./_flexModel');

const Mixed = mongoose.Schema.Types.Mixed;

module.exports = flexModel('IntegrationOutbox', 'integrationOutboxes', {
  eventId: String,
  eventType: String,
  destinationSystem: String,
  aggregateType: String,
  aggregateId: String,
  aggregateCode: String,
  payloadHash: String,
  payload: Mixed,
  status: String,
  attemptCount: { type: Number, default: 0 },
  nextAttemptAt: String,
  leasedBy: String,
  leaseUntil: String,
  lastAttemptAt: String,
  completedAt: String,
  failedAt: String,
  deadLetteredAt: String,
  result: Mixed,
  error: Mixed,
  correlationId: String,
  createdAt: String,
  updatedAt: String
});
