const inventoryService = require('../services/inventory.service');

async function post(input = {}, options = {}) {
  return inventoryService.addInventoryEntry(input, options);
}

async function rebuildSnapshots() {
  return inventoryService.rebuildInventorySnapshots();
}

module.exports = { post, rebuildSnapshots };
