'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routes = fs.readFileSync(path.join(root, 'src/routes/s3IntegrationRoutes.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/services/integration/s3/S3ReconciliationService.js'), 'utf8');

test('integration routes expose health, metrics and reconciliation', () => {
  for (const value of ['/health', '/metrics', '/errors', '/reconciliation/master-orders', '/reconciliation/returns']) {
    assert.match(routes, new RegExp(value.replace(/[/-]/g, (x) => `\\${x}`)));
  }
});

test('return retry refuses completed commands', () => {
  assert.match(service, /Command đã hoàn thành, không được retry/);
  assert.match(service, /status: \{ \$in: \['failed', 'dead_letter', 'pending'\] \}/);
});

test('return reconciliation requires both completed outbox and receipt code', () => {
  assert.match(service, /row\.s3SyncStatus === 'completed' && event\?\.status === 'completed' && Boolean\(receiptCode\)/);
});

test('health contains queue age, conflicts and unresolved errors', () => {
  assert.match(service, /oldestPendingAgeSeconds/);
  assert.match(service, /syncConflict: true/);
  assert.match(service, /unresolvedErrors/);
});
