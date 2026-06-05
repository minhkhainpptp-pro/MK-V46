const Inventory = require('../../models/Inventory');

async function createInventoryLedger(doc, session) {
  const [created] = await Inventory.create([doc], session ? { session } : undefined);
  return created;
}

async function listInventoryLedgers(query = {}, options = {}) {
  const limit = Math.min(Number(options.limit || 100), 500);
  return Inventory.find(query).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
}

module.exports = { createInventoryLedger, listInventoryLedgers };
