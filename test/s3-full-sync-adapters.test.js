'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/services/integration/s3/S3FullSyncService.js', 'utf8');

test('full sync never deletes source collections', () => {
  assert.doesNotMatch(source, /deleteMany\s*\(/);
  assert.doesNotMatch(source, /drop\s*\(/);
});

test('full sync isolates inventory into S3InventoryBalance', () => {
  assert.match(source, /S3InventoryBalance/);
  assert.doesNotMatch(source, /StockTransaction/);
  assert.doesNotMatch(source, /InventoryPostingService/);
});

test('order adapter does not update V45 execution or return evidence fields', () => {
  const orderBlock = source.slice(source.indexOf('function orderOperation'), source.indexOf('const ADAPTERS'));
  assert.match(orderBlock, /\$setOnInsert:[\s\S]*executionStatus/);
  assert.doesNotMatch(orderBlock, /executionCompletedAt:/);
  assert.doesNotMatch(orderBlock, /photos:/);
  assert.doesNotMatch(orderBlock, /gps:/);
});

test('batch is idempotent through IntegrationInbox eventId', () => {
  assert.match(source, /IntegrationInbox\.create/);
  assert.match(source, /existing\?\.status === 'completed'/);
  assert.match(source, /duplicate: true/);
});

test('full run refuses publish when expected counts mismatch', () => {
  assert.match(source, /S3_SYNC_COUNT_MISMATCH/);
  assert.match(source, /deactivateMissing/);
});
