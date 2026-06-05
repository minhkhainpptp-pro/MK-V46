require('dotenv').config();
const { connectMongo } = require('../src/config/db');
const inventoryService = require('../src/services/inventory.service');
const mongoose = require('mongoose');

(async () => {
  await connectMongo();
  const result = await inventoryService.rebuildInventorySnapshots();
  await mongoose.connection.close();
  console.log(JSON.stringify(result, null, 2));
})().catch(async (err) => {
  console.error('[INVENTORY_REBUILD_ERROR]', err);
  try { await mongoose.connection.close(); } catch (e) {}
  process.exit(1);
});
