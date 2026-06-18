'use strict';

const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requestBodyBuffer(req = {}) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  if (req.body === undefined || req.body === null) return Buffer.alloc(0);
  return Buffer.from(JSON.stringify(req.body), 'utf8');
}

function requestPath(req = {}) {
  return String(req.originalUrl || req.url || '').split('?')[0];
}

function canonicalRequest({ method, path, timestamp, nonce, bodyHash }) {
  return [
    String(method || '').toUpperCase(),
    String(path || ''),
    String(timestamp || ''),
    String(nonce || ''),
    String(bodyHash || '')
  ].join('\n');
}

function createSignature({ method, path, timestamp, nonce, body, secret }) {
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body || '');
  const canonical = canonicalRequest({
    method,
    path,
    timestamp,
    nonce,
    bodyHash: sha256(bodyBuffer)
  });
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

function safeEqualHex(actual = '', expected = '') {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

module.exports = {
  sha256,
  requestBodyBuffer,
  requestPath,
  canonicalRequest,
  createSignature,
  safeEqualHex
};
