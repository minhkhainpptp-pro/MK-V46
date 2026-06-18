'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../src/services/integration/s3/S3ReturnCommandPolicy');

test('claim limit and lease are clamped', () => {
  assert.equal(policy.claimLimit(0), 1);
  assert.equal(policy.claimLimit(1000), 50);
  assert.equal(policy.leaseSeconds(1), 30);
  assert.equal(policy.leaseSeconds(999999), 900);
});

test('retry schedule increases and is bounded', () => {
  assert.equal(policy.retryDelaySeconds(1), 30);
  assert.equal(policy.retryDelaySeconds(2), 120);
  assert.equal(policy.retryDelaySeconds(4), 1800);
  assert.equal(policy.retryDelaySeconds(99), 28800);
  assert.equal(policy.retryDelaySeconds(1, 1), 30);
  assert.equal(policy.retryDelaySeconds(1, 999999), 86400);
});

test('dead-letter policy respects retryable and maximum attempts', () => {
  assert.equal(policy.shouldDeadLetter({ retryable: false, attemptCount: 1 }), true);
  assert.equal(policy.shouldDeadLetter({ retryable: true, attemptCount: 7, configuredMaxAttempts: 8 }), false);
  assert.equal(policy.shouldDeadLetter({ retryable: true, attemptCount: 8, configuredMaxAttempts: 8 }), true);
});

test('error payload is normalized and bounded', () => {
  const result = policy.normalizeError({ errorCode: 'SQL', errorMessage: 'x'.repeat(3000), retryable: false });
  assert.equal(result.code, 'SQL');
  assert.equal(result.message.length, 2000);
  assert.equal(result.retryable, false);
  assert.match(result.occurredAt, /^\d{4}-\d{2}-\d{2}T/);
});
