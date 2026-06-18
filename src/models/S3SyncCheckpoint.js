'use strict';

const mongoose = require('mongoose');
const flexModel = require('./_flexModel');

const Mixed = mongoose.Schema.Types.Mixed;

module.exports = flexModel('S3SyncCheckpoint', 's3SyncCheckpoints', {
  stream: String,
  cursor: Mixed,
  overlapCursor: Mixed,
  lastRunId: String,
  lastSuccessfulAt: String,
  lastAttemptAt: String,
  lastError: Mixed,
  sourceSystem: { type: String, default: 'S3' },
  createdAt: String,
  updatedAt: String
});
