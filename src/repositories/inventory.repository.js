const Inventory = require('../models/Inventory');
const InventorySnapshot = require('../models/InventorySnapshot');

function toLimit(value, fallback = 100, max = 1000) {
  const n = Number(value || fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function toSkip(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

async function create(payload, options = {}) {
  const doc = new Inventory(payload);
  return doc.save(options);
}

async function find(filter = {}, options = {}) {
  const limit = toLimit(options.limit, 100, 1000);
  const skip = toSkip(options.skip);
  const sort = options.sort || { createdAt: -1 };
  return Inventory.find(filter).sort(sort).skip(skip).limit(limit).lean();
}

async function count(filter = {}) {
  return Inventory.countDocuments(filter);
}

async function aggregateStock(filter = {}) {
  return Inventory.aggregate([
    { $match: filter },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: {
          productId: '$productId',
          warehouseId: '$warehouseId',
        },
        productId: { $last: '$productId' },
        productCode: { $last: '$productCode' },
        productName: { $last: '$productName' },
        warehouseId: { $last: '$warehouseId' },
        warehouseCode: { $last: '$warehouseCode' },
        warehouseName: { $last: '$warehouseName' },
        qty: { $sum: '$qty' },
        unit: { $last: '$unit' },
      },
    },
    { $sort: { productCode: 1, warehouseCode: 1 } },
  ]);
}

async function getSnapshot(productId, warehouseId) {
  return InventorySnapshot.findOne({ productId, warehouseId }).lean();
}

async function findSnapshots(filter = {}, options = {}) {
  const limit = toLimit(options.limit, 500, 5000);
  const skip = toSkip(options.skip);
  const sort = options.sort || { productCode: 1, warehouseCode: 1 };
  return InventorySnapshot.find(filter).sort(sort).skip(skip).limit(limit).lean();
}

async function countSnapshots(filter = {}) {
  return InventorySnapshot.countDocuments(filter);
}

async function clearSnapshots(options = {}) {
  return InventorySnapshot.deleteMany({}, options);
}

async function bulkWriteSnapshots(ops = [], options = {}) {
  if (!Array.isArray(ops) || !ops.length) return { modifiedCount: 0, upsertedCount: 0 };
  return InventorySnapshot.bulkWrite(ops, { ordered: false, ...options });
}

async function auditSnapshots() {
  return Inventory.aggregate([
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: {
          productId: '$productId',
          warehouseId: '$warehouseId',
        },
        productId: { $last: '$productId' },
        productCode: { $last: '$productCode' },
        productName: { $last: '$productName' },
        warehouseId: { $last: '$warehouseId' },
        warehouseCode: { $last: '$warehouseCode' },
        warehouseName: { $last: '$warehouseName' },
        ledgerQty: { $sum: '$qty' },
        unit: { $last: '$unit' },
      },
    },
    {
      $lookup: {
        from: 'inventorySnapshots',
        let: { productId: '$productId', warehouseId: '$warehouseId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$productId', '$$productId'] },
                  { $eq: ['$warehouseId', '$$warehouseId'] },
                ],
              },
            },
          },
          { $project: { _id: 0, qty: 1 } },
        ],
        as: 'snapshot',
      },
    },
    {
      $addFields: {
        snapshotQty: { $ifNull: [{ $first: '$snapshot.qty' }, 0] },
      },
    },
    {
      $addFields: {
        diff: { $subtract: ['$ledgerQty', '$snapshotQty'] },
      },
    },
    { $match: { diff: { $ne: 0 } } },
    {
      $project: {
        _id: 0,
        productId: 1,
        productCode: 1,
        productName: 1,
        warehouseId: 1,
        warehouseCode: 1,
        warehouseName: 1,
        ledgerQty: 1,
        snapshotQty: 1,
        diff: 1,
        unit: 1,
      },
    },
    { $sort: { productCode: 1, warehouseCode: 1 } },
  ]);
}

module.exports = {
  create,
  find,
  count,
  aggregateStock,
  getSnapshot,
  findSnapshots,
  countSnapshots,
  clearSnapshots,
  bulkWriteSnapshots,
  auditSnapshots,
};
