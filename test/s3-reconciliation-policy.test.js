'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../src/services/integration/s3/S3ReconciliationPolicy');

test('health status prioritizes dead letter as critical', () => {
  assert.equal(policy.healthStatus({ deadLetters: 1 }), 'critical');
  assert.equal(policy.healthStatus({ failed: 1 }), 'degraded');
  assert.equal(policy.healthStatus({ conflicts: 1 }), 'degraded');
  assert.equal(policy.healthStatus({ oldestPendingAgeSeconds: 601, maxPendingAgeSeconds: 600 }), 'degraded');
  assert.equal(policy.healthStatus({}), 'healthy');
});

test('pagination is bounded', () => {
  assert.equal(policy.clampLimit(0), 1);
  assert.equal(policy.clampLimit(999), 200);
  assert.equal(policy.clampPage(-5), 1);
});

test('age seconds handles invalid and future values', () => {
  assert.equal(policy.ageSeconds('bad'), null);
  assert.equal(policy.ageSeconds(new Date(2000).toISOString(), 1000), 0);
  assert.equal(policy.ageSeconds(new Date(0).toISOString(), 10000), 10);
});
