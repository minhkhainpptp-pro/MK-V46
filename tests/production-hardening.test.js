const assert = require('assert');

const { indexDefinitions } = require('../src/core/indexDefinitions');
const DeliveryEngine = require('../src/engines/DeliveryEngine');
const DeliveryConfirmEngine = require('../src/engines/DeliveryConfirmEngine');
const DeliveryPaymentEngine = require('../src/engines/DeliveryPaymentEngine');
const DeliveryReturnEngine = require('../src/engines/DeliveryReturnEngine');
const InventoryEngine = require('../src/engines/InventoryEngine');
const arService = require('../src/services/arLedger.service');
const deliveryClosingService = require('../src/services/deliveryClosing.service');
const permission = require('../src/middlewares/permission.middleware');

assert(Array.isArray(indexDefinitions), 'indexDefinitions must be an array');
assert(indexDefinitions.length >= 20, 'indexDefinitions must centralize production indexes');

for (const def of indexDefinitions) {
  assert(def.model && def.model.collection, 'index definition must include model');
  assert(def.keys && typeof def.keys === 'object', 'index definition must include keys');
  assert(def.options && def.options.name, 'index definition must include stable index name');
}

assert.strictEqual(typeof DeliveryEngine.listOrders, 'function');
assert.strictEqual(typeof DeliveryConfirmEngine.confirm, 'function');
assert.strictEqual(typeof DeliveryPaymentEngine.normalizePayment, 'function');
assert.strictEqual(typeof DeliveryReturnEngine.normalizeReturnLines, 'function');
assert.strictEqual(typeof InventoryEngine.post, 'function');
assert.strictEqual(typeof InventoryEngine.rebuildSnapshots, 'function');
assert.strictEqual(typeof arService.getCustomerStatement, 'function');
assert.strictEqual(typeof deliveryClosingService.closeDay, 'function');
assert.strictEqual(typeof permission.requireRole, 'function');

console.log('[PRODUCTION_HARDENING_CHECK_OK]');
