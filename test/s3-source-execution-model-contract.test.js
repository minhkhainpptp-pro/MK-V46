'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('SalesOrder separates S3 source metadata from V45 execution state', () => {
  const source = read('src/models/SalesOrder.js');
  for (const field of ['sourceSystem', 'sourceOrderId', 'sourceMasterOrderId', 'sourceHash', 'sourceReadOnly', 'executionStatus', 'executionVersion', 'syncConflict']) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
});

test('MasterOrder declares canonical source identity and delivery execution fields', () => {
  const source = read('src/models/MasterOrder.js');
  for (const field of ['sourceMasterOrderId', 'sourceVersion', 'sourceHash', 'deliveryStaffCode', 'executionStatus', 'syncConflict']) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
});

test('ReturnOrder keeps S3 sync state separate from return state machine', () => {
  const source = read('src/models/ReturnOrder.js');
  for (const field of ['returnState', 's3SyncStatus', 's3SyncEventId', 's3ReceiptCode', 's3PostedAt']) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
});

test('managed indexes protect S3 source identities and return sync events', () => {
  const source = read('src/services/mongoIndexService.js');
  assert.match(source, /uniq_orders_source_order/);
  assert.match(source, /uniq_master_orders_source_master/);
  assert.match(source, /uniq_return_orders_s3_sync_event/);
});
