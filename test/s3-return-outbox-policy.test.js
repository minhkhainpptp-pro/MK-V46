'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }

const outbox = read('src/services/integration/s3/S3ReturnOutboxService.js');
const legacy = read('src/services/returnOrderLegacy.service.js');
const masterReturn = read('src/services/masterReturnOrderService.js');
const masterOrder = read('src/services/master-order/masterOrderLegacy.service.js');

test('return command has deterministic identity and only positive base quantities', () => {
  assert.match(outbox, /V45:RETURN:/);
  assert.match(outbox, /baseQuantity/);
  assert.match(outbox, /item\.baseQuantity > 0/);
  assert.match(outbox, /S3_RETURN_DEFAULT_SITE_ID/);
});

test('S3 execution receive confirms physical count without local stock posting', () => {
  assert.match(legacy, /if \(integrationConfig\.isS3Execution\) \{[\s\S]*stockReceiveStatus: 'pending_s3'[\s\S]*return \{ returnOrder: toClient\(executionReceived\)/);
  assert.match(legacy, /await returnOrderRepository\.upsert\(received, \{ session \}\);\s*await InventoryPostingService\.postReturnIn\(received, \{ session \}\);/);
  assert.match(legacy, /stockReceiveStatus: 'pending_s3'/);
  assert.match(masterReturn, /stockPosted: !s3Execution/);
});

test('S3 accounting confirmation creates outbox in the same transaction and does not post AR', () => {
  assert.match(legacy, /S3ReturnOutboxService\.createReturnCommand/);
  assert.match(legacy, /accountingConfirmedPatch/);
  assert.match(legacy, /withMongoTransaction\(work\)/);
  assert.match(legacy, /RETURN_AR_MANAGED_BY_S3/);
});

test('master accounting route queues real returnOrders instead of synthetic AR-RETURN in S3 mode', () => {
  assert.match(masterOrder, /integrationConfig\.isS3Execution && hydratedReturnRows\.length/);
  assert.match(masterOrder, /S3ReturnOutboxService\.createReturnCommand/);
  assert.match(masterOrder, /else if \(!integrationConfig\.isS3Execution\)/);
});
