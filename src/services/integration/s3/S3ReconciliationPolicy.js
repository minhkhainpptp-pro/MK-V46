'use strict';

function clampLimit(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
}

function clampPage(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

function ageSeconds(value, now = Date.now()) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((now - parsed) / 1000));
}

function healthStatus({ deadLetters = 0, failed = 0, conflicts = 0, oldestPendingAgeSeconds = 0, maxPendingAgeSeconds = 600 } = {}) {
  if (Number(deadLetters) > 0) return 'critical';
  if (Number(failed) > 0 || Number(conflicts) > 0 || Number(oldestPendingAgeSeconds || 0) > Number(maxPendingAgeSeconds)) {
    return 'degraded';
  }
  return 'healthy';
}

function prometheusEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

module.exports = { clampLimit, clampPage, ageSeconds, healthStatus, prometheusEscape };
