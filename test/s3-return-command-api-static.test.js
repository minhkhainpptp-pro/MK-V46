'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routes = fs.readFileSync(path.join(root, 'src/routes/s3IntegrationRoutes.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/services/integration/s3/S3ReturnCommandService.js'), 'utf8');

test('return command API exposes claim, complete, defer, fail and renew', () => {
  for (const suffix of ['claim', ':eventId/complete', ':eventId/defer', ':eventId/fail', ':eventId/renew']) {
    assert.match(routes, new RegExp(`return-commands/${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
});

test('claim uses atomic findOneAndUpdate lease', () => {
  assert.match(service, /findOneAndUpdate[\s\S]*status: 'leased'/);
  assert.match(service, /leaseUntil/);
  assert.match(service, /\$inc: \{ attemptCount: 1 \}/);
});

test('complete updates outbox and return order in one Mongo transaction', () => {
  assert.match(service, /completeCommand[\s\S]*withMongoTransaction/);
  assert.match(service, /status: 'completed'/);
  assert.match(service, /s3SyncStatus: 'completed'/);
});

test('defer does not falsely complete a staged S3 receipt', () => {
  assert.match(service, /deferCommand/);
  assert.match(service, /sqlStatus: text\(body\.sqlStatus \|\| 'staged'\)/);
  assert.match(service, /s3SyncStatus: 'pending'/);
});
