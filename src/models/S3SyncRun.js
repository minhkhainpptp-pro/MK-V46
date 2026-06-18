'use strict';

const mongoose = require('mongoose');
const flexModel = require('./_flexModel');

const Mixed = mongoose.Schema.Types.Mixed;

module.exports = flexModel('S3SyncRun', 's3SyncRuns', {
  runId: String,
  syncMode: String,
  entityTypes: Array,
  status: String,
  startedAt: String,
  completedAt: String,
  failedAt: String,
  sourceSnapshotAt: String,
  expectedCounts: Mixed,
  processedCounts: Mixed,
  rejectedCounts: Mixed,
  sourceHashes: Mixed,
  publishedAt: String,
  error: Mixed,
  createdByAgent: String,
  createdAt: String,
  updatedAt: String
});
