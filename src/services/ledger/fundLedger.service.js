const FundLedger = require('../../models/FundLedger');

async function createFundLedger(doc, session) {
  const [created] = await FundLedger.create([doc], session ? { session } : undefined);
  return created;
}

async function listFundLedgers(query = {}, options = {}) {
  const limit = Math.min(Number(options.limit || 100), 500);
  return FundLedger.find(query).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
}

module.exports = { createFundLedger, listFundLedgers };
