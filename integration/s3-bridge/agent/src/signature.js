'use strict';

const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createNonce() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(24).toString('hex')}`;
}

function canonicalRequest({ method, path, timestamp, nonce, bodyHash }) {
  return [String(method).toUpperCase(), path, String(timestamp), nonce, bodyHash].join('\n');
}

function createSignature({ method, path, timestamp, nonce, bodyBuffer, secret }) {
  const canonical = canonicalRequest({
    method,
    path,
    timestamp,
    nonce,
    bodyHash: sha256(bodyBuffer)
  });
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function payloadHash(value) {
  return sha256(Buffer.from(JSON.stringify(stableValue(value)), 'utf8'));
}

module.exports = { sha256, createNonce, canonicalRequest, createSignature, stableValue, payloadHash };
