'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const CONFIG_PATH = require.resolve('../src/config/integrationConfig');
const POLICY_PATH = require.resolve('../src/domain/integration/S3ExecutionGuard');

function withEnv(values, callback) {
  const keys = Object.keys(values);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete require.cache[CONFIG_PATH];
  delete require.cache[POLICY_PATH];
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[CONFIG_PATH];
    delete require.cache[POLICY_PATH];
  }
}

test('integrationConfig defaults to standalone/local', () => withEnv({
  SYSTEM_MODE: undefined,
  INVENTORY_AUTHORITY: undefined,
  ORDER_AUTHORITY: undefined,
  MASTER_ORDER_AUTHORITY: undefined,
  S3_INTEGRATION_ENABLED: undefined
}, () => {
  const config = require('../src/config/integrationConfig');
  assert.equal(config.systemMode, 'STANDALONE');
  assert.equal(config.isS3Execution, false);
  assert.equal(config.inventoryAuthority, 'LOCAL');
  assert.equal(config.orderAuthority, 'LOCAL');
  assert.equal(config.masterOrderAuthority, 'LOCAL');
  assert.equal(config.s3IntegrationEnabled, false);
}));

test('S3 execution policy blocks source commands but keeps non-source master-data import available', () => withEnv({
  SYSTEM_MODE: 'S3_EXECUTION',
  INVENTORY_AUTHORITY: 'S3',
  ORDER_AUTHORITY: 'S3',
  MASTER_ORDER_AUTHORITY: 'S3',
  S3_INTEGRATION_ENABLED: 'true'
}, () => {
  const policy = require('../src/domain/integration/S3ExecutionGuard');

  assert.throws(() => policy.assertLocalOrderEnabled('tạo đơn'), (err) => err.code === 'ORDER_MANAGED_BY_S3' && err.status === 409);
  assert.throws(() => policy.assertLocalMasterOrderEnabled('tạo đơn tổng'), (err) => err.code === 'MASTER_ORDER_MANAGED_BY_S3' && err.status === 409);
  assert.throws(() => policy.assertLocalInventoryEnabled('ghi tồn'), (err) => err.code === 'INVENTORY_MANAGED_BY_S3' && err.status === 409);
  assert.throws(() => policy.assertLocalImportEnabled('salesOrders', 'import đơn'), (err) => err.code === 'SOURCE_IMPORT_MANAGED_BY_S3' && err.status === 409);
  assert.throws(() => policy.assertLocalImportEnabled('openingStock', 'import tồn'), (err) => err.code === 'SOURCE_IMPORT_MANAGED_BY_S3' && err.status === 409);
  assert.doesNotThrow(() => policy.assertLocalImportEnabled('products', 'import sản phẩm'));
  assert.doesNotThrow(() => policy.assertLocalImportEnabled('customers', 'import khách hàng'));
}));

test('invalid SYSTEM_MODE fails startup instead of silently enabling local writes', () => withEnv({
  SYSTEM_MODE: 'typo-mode'
}, () => {
  assert.throws(() => require('../src/config/integrationConfig'), /SYSTEM_MODE không hợp lệ/);
}));

test('invalid authority fails startup instead of failing open', () => withEnv({
  SYSTEM_MODE: 'S3_EXECUTION',
  INVENTORY_AUTHORITY: 'S33',
  ORDER_AUTHORITY: 'S3',
  MASTER_ORDER_AUTHORITY: 'S3'
}, () => {
  assert.throws(() => require('../src/config/integrationConfig'), /INVENTORY_AUTHORITY không hợp lệ/);
}));
