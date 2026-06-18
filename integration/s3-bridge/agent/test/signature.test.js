'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSignature, payloadHash } = require('../src/signature');

test('HMAC is deterministic for exact body bytes', () => {
  const input = {
    method: 'POST',
    path: '/api/integrations/s3/return-commands/claim',
    timestamp: '1781754000000',
    nonce: 'nonce-1234567890123456',
    bodyBuffer: Buffer.from('{"limit":10}', 'utf8'),
    secret: '12345678901234567890123456789012'
  };
  assert.equal(createSignature(input), createSignature(input));
  assert.notEqual(createSignature(input), createSignature({ ...input, path: '/other' }));
});

test('payload hash is stable across object key order', () => {
  assert.equal(payloadHash({ b: 2, a: { d: 4, c: 3 } }), payloadHash({ a: { c: 3, d: 4 }, b: 2 }));
});
