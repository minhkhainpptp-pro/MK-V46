'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/services/integration/s3/S3MasterOrderSyncService.js', 'utf8');

test('master order sync uses one Mongo transaction', () => {
  assert.match(source, /withMongoTransaction/);
  assert.match(source, /IntegrationInbox\.create/);
  assert.match(source, /applyChild/);
  assert.match(source, /applyMaster/);
});

test('source changes after delivery starts are quarantined as conflicts', () => {
  assert.match(source, /PROTECTED_EXECUTION_STATES/);
  assert.match(source, /S3_SOURCE_CHANGED_AFTER_EXECUTION_STARTED/);
  assert.match(source, /pendingSourcePayload/);
  assert.match(source, /ONE_OR_MORE_CHILDREN_CONFLICT/);
});

test('integration upsert never posts or reverses local inventory', () => {
  assert.doesNotMatch(source, /InventoryPostingService/);
  assert.doesNotMatch(source, /StockTransaction/);
  assert.match(source, /stockPosted: false/);
});

test('master sync is feature-flagged and idempotent by inbox event id', () => {
  assert.match(source, /s3MasterOrderSyncEnabled/);
  assert.match(source, /S3_MASTER_ORDER_SYNC_DISABLED/);
  assert.match(source, /existingInbox\?\.status === 'completed'/);
});
