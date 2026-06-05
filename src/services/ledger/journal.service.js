const Journal = require('../../models/Journal');

async function createJournal(doc, session) {
  const [created] = await Journal.create([doc], session ? { session } : undefined);
  return created;
}

async function listJournals(query = {}, options = {}) {
  const limit = Math.min(Number(options.limit || 100), 500);
  return Journal.find(query).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
}

module.exports = { createJournal, listJournals };
