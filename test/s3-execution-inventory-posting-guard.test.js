'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const CONFIG_PATH = require.resolve('../src/config/integrationConfig');
const POSTING_PATH = require.resolve('../src/domain/posting/InventoryPostingService');
const INVENTORY_SERVICE_PATH = require.resolve('../src/services/inventoryService');

function loadS3PostingService() {
  process.env.SYSTEM_MODE = 'S3_EXECUTION';
  process.env.INVENTORY_AUTHORITY = 'S3';
  delete require.cache[CONFIG_PATH];
  delete require.cache[POSTING_PATH];

  // The guard must execute before any stock adapter method. Stub the adapter so
  // this boundary test does not require Mongo/Mongoose or a database connection.
  require.cache[INVENTORY_SERVICE_PATH] = {
    id: INVENTORY_SERVICE_PATH,
    filename: INVENTORY_SERVICE_PATH,
    loaded: true,
    exports: new Proxy({}, {
      get() {
        return async () => {
          throw new Error('Inventory adapter must not be called in S3 execution mode');
        };
      }
    })
  };

  return require('../src/domain/posting/InventoryPostingService');
}

function restore(previous, previousInventoryModule) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete require.cache[CONFIG_PATH];
  delete require.cache[POSTING_PATH];
  if (previousInventoryModule) require.cache[INVENTORY_SERVICE_PATH] = previousInventoryModule;
  else delete require.cache[INVENTORY_SERVICE_PATH];
}

test('all centralized inventory write paths fail loudly in S3 execution mode', async () => {
  const previous = {
    SYSTEM_MODE: process.env.SYSTEM_MODE,
    INVENTORY_AUTHORITY: process.env.INVENTORY_AUTHORITY
  };
  const previousInventoryModule = require.cache[INVENTORY_SERVICE_PATH];

  try {
    const service = loadS3PostingService();
    const calls = [
      () => service.postImportIn({ id: 'IN-1' }),
      () => service.postSaleOut({ id: 'SO-1' }),
      () => service.postSalesOrdersBulkOut([{ id: 'SO-1' }]),
      () => service.postSaleEditDelta({ id: 'SO-1' }, [], 'OUT'),
      () => service.postReturnIn({ id: 'RO-1' }),
      () => service.reverseMovement({ id: 'SO-1' }, {}),
      () => service.reconcileInventory()
    ];

    for (const call of calls) {
      await assert.rejects(Promise.resolve().then(call), (err) => {
        assert.equal(err.code, 'INVENTORY_MANAGED_BY_S3');
        assert.equal(err.status, 409);
        return true;
      });
    }
  } finally {
    restore(previous, previousInventoryModule);
  }
});
