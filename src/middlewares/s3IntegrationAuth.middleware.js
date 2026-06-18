'use strict';

const S3IntegrationNonce = require('../models/S3IntegrationNonce');
const integrationConfig = require('../config/integrationConfig');
const {
  sha256,
  requestBodyBuffer,
  requestPath,
  createSignature,
  safeEqualHex
} = require('../security/s3IntegrationSignature');

function unauthorized(res, message, code = 'S3_INTEGRATION_UNAUTHORIZED', status = 401) {
  return res.status(status).json({ ok: false, success: false, code, message });
}

function parseTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return NaN;
  return numeric < 1e12 ? numeric * 1000 : numeric;
}

function allowedAgent(agentId) {
  const configured = String(process.env.S3_INTEGRATION_AGENT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length === 0 || configured.includes(agentId);
}

async function s3IntegrationAuth(req, res, next) {
  if (!integrationConfig.s3IntegrationEnabled) {
    return unauthorized(res, 'Tích hợp S3 chưa được bật', 'S3_INTEGRATION_DISABLED', 503);
  }

  const configuredKey = String(process.env.S3_INTEGRATION_KEY || '').trim();
  const secret = String(process.env.S3_INTEGRATION_SECRET || '').trim();
  if (!configuredKey || secret.length < 32) {
    return unauthorized(res, 'Tích hợp S3 chưa được cấu hình an toàn', 'S3_INTEGRATION_MISCONFIGURED', 503);
  }

  const integrationKey = String(req.get('x-integration-key') || '').trim();
  const agentId = String(req.get('x-agent-id') || '').trim();
  const timestampHeader = String(req.get('x-timestamp') || '').trim();
  const nonce = String(req.get('x-nonce') || '').trim();
  const actualSignature = String(req.get('x-signature') || '').trim().toLowerCase();

  if (!integrationKey || !agentId || !timestampHeader || !nonce || !actualSignature) {
    return unauthorized(res, 'Thiếu header xác thực Bridge');
  }
  if (!safeEqualHex(sha256(integrationKey), sha256(configuredKey))) {
    return unauthorized(res, 'Integration key không hợp lệ');
  }
  if (!allowedAgent(agentId)) {
    return unauthorized(res, 'Bridge Agent không được cấp quyền', 'S3_AGENT_NOT_ALLOWED', 403);
  }
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(nonce)) {
    return unauthorized(res, 'Nonce không hợp lệ');
  }

  const timestampMs = parseTimestamp(timestampHeader);
  const maxSkewMs = Math.max(1000, Number(process.env.S3_INTEGRATION_MAX_SKEW_MS || 60000));
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > maxSkewMs) {
    return unauthorized(res, 'Request Bridge đã hết hạn', 'S3_REQUEST_EXPIRED');
  }

  const body = requestBodyBuffer(req);
  const expectedSignature = createSignature({
    method: req.method,
    path: requestPath(req),
    timestamp: timestampHeader,
    nonce,
    body,
    secret
  });
  if (!safeEqualHex(actualSignature, expectedSignature)) {
    return unauthorized(res, 'Chữ ký Bridge không hợp lệ');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(maxSkewMs * 2, 5 * 60 * 1000));
  try {
    await S3IntegrationNonce.create({
      agentId,
      nonce,
      requestHash: sha256(Buffer.concat([Buffer.from(expectedSignature), body])),
      usedAt: now,
      expiresAt
    });
  } catch (err) {
    if (err?.code === 11000) {
      return unauthorized(res, 'Nonce đã được sử dụng', 'S3_REQUEST_REPLAYED', 409);
    }
    return next(err);
  }

  req.integrationAgent = { agentId, authenticatedAt: now.toISOString() };
  return next();
}

module.exports = {
  s3IntegrationAuth,
  parseTimestamp,
  allowedAgent
};
