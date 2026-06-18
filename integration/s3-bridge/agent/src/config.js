'use strict';

function text(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function bool(name, fallback = false) {
  const value = text(name, fallback ? 'true' : 'false').toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function integer(name, fallback, min, max) {
  const parsed = Number.parseInt(text(name, fallback), 10);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, value));
}

function requireValue(name, options = {}) {
  const value = text(name);
  if (!value) throw new Error(`Thiếu cấu hình ${name}`);
  if (options.minLength && value.length < options.minLength) {
    throw new Error(`${name} phải có tối thiểu ${options.minLength} ký tự`);
  }
  return value;
}

function loadConfig() {
  const returnEnabled = bool('BRIDGE_RETURN_ENABLED', false);
  const masterOrderEnabled = bool('BRIDGE_MASTER_ORDER_ENABLED', false);
  const base = {
    agentId: requireValue('BRIDGE_AGENT_ID'),
    integrationKey: requireValue('BRIDGE_INTEGRATION_KEY'),
    integrationSecret: requireValue('BRIDGE_INTEGRATION_SECRET', { minLength: 32 }),
    v45BaseUrl: requireValue('V45_BASE_URL').replace(/\/+$/, ''),
    returnEnabled,
    masterOrderEnabled,
    masterOrderPollMs: integer('BRIDGE_MASTER_ORDER_POLL_MS', 10000, 1000, 3600000),
    masterOrderBatchSize: integer('BRIDGE_MASTER_ORDER_BATCH_SIZE', 20, 1, 100),
    returnClaimLimit: integer('BRIDGE_RETURN_CLAIM_LIMIT', 10, 1, 50),
    returnLeaseSeconds: integer('BRIDGE_RETURN_LEASE_SECONDS', 120, 30, 900),
    returnPollMs: integer('BRIDGE_RETURN_POLL_MS', 10000, 1000, 3600000),
    stagedRetrySeconds: integer('BRIDGE_STAGED_RETRY_SECONDS', 300, 30, 86400),
    shutdownTimeoutMs: integer('BRIDGE_SHUTDOWN_TIMEOUT_MS', 30000, 1000, 120000)
  };

  if (returnEnabled || masterOrderEnabled) {
    base.sql = {
      server: requireValue('S3_SQL_SERVER'),
      port: integer('S3_SQL_PORT', 1433, 1, 65535),
      database: requireValue('S3_SQL_DATABASE'),
      user: requireValue('S3_SQL_USER'),
      password: requireValue('S3_SQL_PASSWORD'),
      options: {
        encrypt: bool('S3_SQL_ENCRYPT', true),
        trustServerCertificate: bool('S3_SQL_TRUST_SERVER_CERTIFICATE', false)
      },
      pool: {
        max: integer('S3_SQL_POOL_MAX', 5, 1, 50),
        min: 0,
        idleTimeoutMillis: 30000
      },
      connectionTimeout: integer('S3_SQL_CONNECTION_TIMEOUT_MS', 15000, 1000, 120000),
      requestTimeout: integer('S3_SQL_REQUEST_TIMEOUT_MS', 120000, 1000, 600000)
    };
  }

  return Object.freeze(base);
}

module.exports = { loadConfig, bool, integer };
