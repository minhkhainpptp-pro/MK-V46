require('dotenv').config();
const { connectMongo } = require('../src/config/db');
const { ensureMongoIndexes } = require('../src/core/ensureMongoIndexes');
const mongoose = require('mongoose');

(async () => {
  await connectMongo();
  await ensureMongoIndexes();
  await mongoose.connection.close();
  console.log('[DB] db:indexes completed');
})().catch(async (err) => {
  console.error('[DB_INDEX_ERROR]', err);
  try { await mongoose.connection.close(); } catch (e) {}
  process.exit(1);
});
