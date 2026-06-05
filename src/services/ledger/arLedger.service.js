const ArLedger = require('../../models/ArLedger');

async function createArLedger(doc, session) {
  const [created] = await ArLedger.create([doc], session ? { session } : undefined);
  return created;
}

async function listArLedgers(query = {}, options = {}) {
  const limit = Math.min(Number(options.limit || 100), 500);
  return ArLedger.find(query).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
}

module.exports = { createArLedger, listArLedgers };
