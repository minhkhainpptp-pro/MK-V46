'use strict';

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function leaseSeconds(value) {
  return clampInteger(value, 30, 15 * 60, 120);
}

function claimLimit(value) {
  return clampInteger(value, 1, 50, 10);
}

function maxAttempts(value = process.env.S3_RETURN_MAX_ATTEMPTS) {
  return clampInteger(value, 1, 100, 8);
}

function retryDelaySeconds(attemptCount, requestedSeconds) {
  if (requestedSeconds != null) return clampInteger(requestedSeconds, 30, 24 * 60 * 60, 60);
  const attempt = clampInteger(attemptCount, 1, 30, 1);
  const schedule = [30, 120, 600, 1800, 3600, 7200, 14400, 28800];
  return schedule[Math.min(attempt - 1, schedule.length - 1)];
}

function isoAfter(seconds, now = new Date()) {
  return new Date(now.getTime() + Number(seconds || 0) * 1000).toISOString();
}

function shouldDeadLetter({ retryable = true, attemptCount = 0, configuredMaxAttempts } = {}) {
  return !retryable || Number(attemptCount || 0) >= maxAttempts(configuredMaxAttempts);
}

function normalizeError(body = {}) {
  const message = String(body.message || body.errorMessage || 'Bridge xử lý hàng trả thất bại').trim();
  return {
    code: String(body.code || body.errorCode || 'S3_RETURN_BRIDGE_ERROR').trim(),
    message: message.slice(0, 2000),
    retryable: body.retryable !== false,
    details: body.details && typeof body.details === 'object' ? body.details : undefined,
    occurredAt: new Date().toISOString()
  };
}

module.exports = {
  clampInteger,
  leaseSeconds,
  claimLimit,
  maxAttempts,
  retryDelaySeconds,
  isoAfter,
  shouldDeadLetter,
  normalizeError
};
