'use strict';

const SYSTEM_MODES = Object.freeze({
  STANDALONE: 'STANDALONE',
  S3_EXECUTION: 'S3_EXECUTION'
});

const AUTHORITIES = Object.freeze({
  LOCAL: 'LOCAL',
  S3: 'S3'
});

function normalized(value, fallback = '') {
  return String(value || fallback).trim().toUpperCase();
}

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

const systemMode = normalized(
  process.env.SYSTEM_MODE,
  SYSTEM_MODES.STANDALONE
);

if (!Object.values(SYSTEM_MODES).includes(systemMode)) {
  throw new Error(`SYSTEM_MODE không hợp lệ: ${systemMode}`);
}

const inventoryAuthority = normalized(process.env.INVENTORY_AUTHORITY, AUTHORITIES.LOCAL);
const orderAuthority = normalized(process.env.ORDER_AUTHORITY, AUTHORITIES.LOCAL);
const masterOrderAuthority = normalized(process.env.MASTER_ORDER_AUTHORITY, AUTHORITIES.LOCAL);

for (const [key, value] of Object.entries({
  INVENTORY_AUTHORITY: inventoryAuthority,
  ORDER_AUTHORITY: orderAuthority,
  MASTER_ORDER_AUTHORITY: masterOrderAuthority
})) {
  if (!Object.values(AUTHORITIES).includes(value)) {
    throw new Error(`${key} không hợp lệ: ${value}`);
  }
}

module.exports = Object.freeze({
  SYSTEM_MODES,
  AUTHORITIES,
  systemMode,
  isS3Execution: systemMode === SYSTEM_MODES.S3_EXECUTION,
  inventoryAuthority,
  orderAuthority,
  masterOrderAuthority,
  s3IntegrationEnabled: enabled(process.env.S3_INTEGRATION_ENABLED),
  s3MasterOrderSyncEnabled: enabled(process.env.S3_MASTER_ORDER_SYNC_ENABLED),
  s3ReturnSyncEnabled: enabled(process.env.S3_RETURN_SYNC_ENABLED),
  s3ReturnAutoPostEnabled: enabled(process.env.S3_RETURN_AUTO_POST_ENABLED)
});
