'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sha256,
  canonicalRequest,
  createSignature,
  safeEqualHex
} = require('../src/security/s3IntegrationSignature');

const secret = '0123456789abcdef0123456789abcdef';

test('S3 signature is deterministic and binds method/path/body/timestamp/nonce', () => {
  const base = {
    method: 'POST',
    path: '/api/integrations/s3/products/batch',
    timestamp: '1781754000000',
    nonce: 'nonce-1234567890123456',
    body: Buffer.from('{"records":[]}'),
    secret
  };
  const signature = createSignature(base);
  assert.match(signature, /^[a-f0-9]{64}$/);
  assert.equal(signature, createSignature(base));
  assert.notEqual(signature, createSignature({ ...base, path: '/api/integrations/s3/customers/batch' }));
  assert.notEqual(signature, createSignature({ ...base, body: Buffer.from('{"records":[1]}') }));
});

test('constant-time hex comparison rejects malformed signatures', () => {
  const digest = sha256('value');
  assert.equal(safeEqualHex(digest, digest), true);
  assert.equal(safeEqualHex(digest, sha256('other')), false);
  assert.equal(safeEqualHex('bad', digest), false);
});

test('canonical request has a stable five-line contract', () => {
  assert.equal(canonicalRequest({ method: 'post', path: '/x', timestamp: '1', nonce: 'n', bodyHash: 'h' }), 'POST\n/x\n1\nn\nh');
});
