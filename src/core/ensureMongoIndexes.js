const Customer = require('../models/Customer');
const { indexDefinitions } = require('./indexDefinitions');

async function dropIndexIfExists(collection, indexName) {
  const indexes = await collection.indexes();
  if (indexes.some((idx) => idx.name === indexName)) {
    await collection.dropIndex(indexName);
  }
}

async function repairCustomerCatalog() {
  await Customer.deleteMany({
    customerCode: { $exists: false },
    customerName: { $exists: false },
    code: /^P\d+/i,
  });

  await Customer.deleteMany({
    $or: [{ customerCode: null }, { customerCode: { $exists: false } }, { customerCode: '' }],
    $and: [
      { $or: [{ code: { $exists: false } }, { code: '' }, { code: null }] },
      { $or: [{ name: { $exists: false } }, { name: '' }, { name: null }] },
      { $or: [{ customerName: { $exists: false } }, { customerName: '' }, { customerName: null }] },
    ],
  });

  await Customer.updateMany(
    {
      $or: [
        { customerCode: { $exists: false } },
        { customerCode: null },
        { customerCode: '' },
        { customerName: { $exists: false } },
        { customerName: null },
        { customerName: '' },
      ],
      code: { $exists: true, $ne: '' },
    },
    [
      {
        $set: {
          customerCode: {
            $cond: [
              { $or: [{ $eq: ['$customerCode', null] }, { $eq: ['$customerCode', ''] }] },
              '$code',
              '$customerCode',
            ],
          },
          customerName: {
            $cond: [
              { $or: [{ $eq: ['$customerName', null] }, { $eq: ['$customerName', ''] }] },
              { $ifNull: ['$name', '$code'] },
              '$customerName',
            ],
          },
          code: { $ifNull: ['$code', '$customerCode'] },
          name: { $ifNull: ['$name', '$customerName'] },
          isActive: { $ifNull: ['$isActive', true] },
        },
      },
    ]
  );
}

async function safeCreateIndex(collection, keys, options = {}) {
  try {
    return await collection.createIndex(keys, options);
  } catch (err) {
    if (err && (
      err.code === 85 ||
      err.code === 86 ||
      err.codeName === 'IndexOptionsConflict' ||
      err.codeName === 'IndexKeySpecsConflict'
    )) {
      console.warn('[INDEX_SKIP_CONFLICT]', collection.collectionName, options.name || JSON.stringify(keys));
      return null;
    }
    throw err;
  }
}

async function ensureMongoIndexes() {
  await dropIndexIfExists(Customer.collection, 'customerCode_1');
  await repairCustomerCatalog();

  const results = [];
  for (const def of indexDefinitions) {
    if (!def || !def.model || !def.model.collection) continue;
    results.push(await safeCreateIndex(def.model.collection, def.keys, def.options || {}));
  }
  console.log(`[DB] Indexes ensured: ${results.filter(Boolean).length}/${indexDefinitions.length}`);
}

module.exports = { ensureMongoIndexes, safeCreateIndex };
