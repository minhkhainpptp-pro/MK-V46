const inventoryRepository = require('../repositories/inventory.repository');
const { updateSnapshot } = require('./snapshot.service');

const VALID_TRANSACTION_TYPES = new Set([
  'IN_IMPORT',
  'OUT_SALE',
  'IN_RETURN',
  'ADJUSTMENT',
]);

function toCleanString(value) {
  return String(value || '').trim();
}

function normalizeQty(transactionType, qty) {
  const n = Number(qty || 0);
  if (!Number.isFinite(n) || n === 0) {
    throw Object.assign(new Error('Số lượng tồn kho phải khác 0'), { status: 400 });
  }

  if (transactionType === 'OUT_SALE') return -Math.abs(n);
  if (transactionType === 'IN_IMPORT' || transactionType === 'IN_RETURN') return Math.abs(n);
  return n;
}

function buildLedgerFilter(query = {}) {
  const filter = {};
  if (query.transactionType) filter.transactionType = toCleanString(query.transactionType);
  if (query.productId) filter.productId = toCleanString(query.productId);
  if (query.productCode) filter.productCode = toCleanString(query.productCode);
  if (query.warehouseId) filter.warehouseId = toCleanString(query.warehouseId);
  if (query.warehouseCode) filter.warehouseCode = toCleanString(query.warehouseCode);
  if (query.referenceType) filter.referenceType = toCleanString(query.referenceType);
  if (query.referenceId) filter.referenceId = toCleanString(query.referenceId);
  if (query.referenceCode) filter.referenceCode = toCleanString(query.referenceCode);
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }
  return filter;
}

function buildSnapshotFilter(query = {}) {
  const filter = {};
  if (query.warehouseId) filter.warehouseId = toCleanString(query.warehouseId);
  if (query.warehouseCode) filter.warehouseCode = toCleanString(query.warehouseCode);
  if (query.productId) filter.productId = toCleanString(query.productId);
  if (query.productCode) filter.productCode = toCleanString(query.productCode);
  if (query.onlyPositive === '1' || query.onlyPositive === true) filter.qty = { $gt: 0 };
  return filter;
}

async function addInventoryEntry(input = {}, options = {}) {
  const transactionType = toCleanString(input.transactionType);
  if (!VALID_TRANSACTION_TYPES.has(transactionType)) {
    throw Object.assign(new Error(`Loại giao dịch kho không hợp lệ: ${transactionType}`), { status: 400 });
  }

  const productId = toCleanString(input.productId);
  const warehouseId = toCleanString(input.warehouseId);
  if (!productId) throw Object.assign(new Error('Thiếu productId'), { status: 400 });
  if (!warehouseId) throw Object.assign(new Error('Thiếu warehouseId'), { status: 400 });

  const qty = normalizeQty(transactionType, input.qty);
  const payload = {
    transactionType,
    productId,
    productCode: toCleanString(input.productCode),
    productName: toCleanString(input.productName),
    warehouseId,
    warehouseCode: toCleanString(input.warehouseCode),
    warehouseName: toCleanString(input.warehouseName),
    qty,
    unit: toCleanString(input.unit),
    referenceType: toCleanString(input.referenceType),
    referenceId: toCleanString(input.referenceId),
    referenceCode: toCleanString(input.referenceCode),
    note: toCleanString(input.note),
    createdBy: toCleanString(input.createdBy),
    updatedBy: toCleanString(input.updatedBy || input.createdBy),
  };

  const entry = await inventoryRepository.create(payload, options);
  await updateSnapshot(entry, options);
  return entry;
}

async function getSnapshotStock(productId, warehouseId) {
  const cleanProductId = toCleanString(productId);
  const cleanWarehouseId = toCleanString(warehouseId);
  if (!cleanProductId) throw Object.assign(new Error('Thiếu productId'), { status: 400 });
  if (!cleanWarehouseId) throw Object.assign(new Error('Thiếu warehouseId'), { status: 400 });

  const snapshot = await inventoryRepository.getSnapshot(cleanProductId, cleanWarehouseId);
  return {
    productId: cleanProductId,
    warehouseId: cleanWarehouseId,
    qty: Number(snapshot && snapshot.qty ? snapshot.qty : 0),
    snapshot: snapshot || null,
    source: 'inventorySnapshots',
    canonicalSource: 'inventories',
  };
}

async function getProductStock(productId, warehouseId) {
  return getSnapshotStock(productId, warehouseId);
}

async function getManySnapshotStocks(productIds = [], warehouseId = '') {
  const ids = [...new Set((Array.isArray(productIds) ? productIds : String(productIds || '').split(','))
    .map(toCleanString)
    .filter(Boolean))];
  const cleanWarehouseId = toCleanString(warehouseId);

  if (!ids.length) return {};
  if (!cleanWarehouseId) throw Object.assign(new Error('Thiếu warehouseId'), { status: 400 });

  const rows = await inventoryRepository.findSnapshots(
    { productId: { $in: ids }, warehouseId: cleanWarehouseId },
    { limit: ids.length }
  );
  const map = {};
  ids.forEach((id) => { map[id] = 0; });
  rows.forEach((row) => { map[row.productId] = Number(row.qty || 0); });
  return map;
}

async function getManyStocks(productIds = [], warehouseId = '') {
  return getManySnapshotStocks(productIds, warehouseId);
}

async function getWarehouseSnapshotStocks(query = {}) {
  const filter = buildSnapshotFilter(query);
  const limit = Math.min(Number(query.limit || 500), 5000);
  const rows = await inventoryRepository.findSnapshots(filter, { limit });
  const total = await inventoryRepository.countSnapshots(filter);
  return {
    rows,
    total,
    source: 'inventorySnapshots',
    canonicalSource: 'inventories',
  };
}

async function getWarehouseStock(query = {}) {
  return getWarehouseSnapshotStocks(query);
}

async function listLedger(query = {}) {
  const filter = buildLedgerFilter(query);
  const limit = Math.min(Number(query.limit || 100), 1000);
  const skip = Math.max(Number(query.skip || 0), 0);
  const rows = await inventoryRepository.find(filter, { limit, skip });
  const total = await inventoryRepository.count(filter);
  return {
    rows,
    total,
    source: 'inventories',
  };
}

async function rebuildInventorySnapshots() {
  const rows = await inventoryRepository.aggregateStock({});
  await inventoryRepository.clearSnapshots();

  const bulkOps = rows.map((row) => ({
    updateOne: {
      filter: { productId: row.productId, warehouseId: row.warehouseId },
      update: {
        $set: {
          code: `${row.productId}__${row.warehouseId}`,
          productId: row.productId,
          productCode: row.productCode || '',
          productName: row.productName || '',
          warehouseId: row.warehouseId,
          warehouseCode: row.warehouseCode || '',
          warehouseName: row.warehouseName || '',
          qty: Number(row.qty || 0),
          unit: row.unit || '',
          updatedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  if (bulkOps.length) await inventoryRepository.bulkWriteSnapshots(bulkOps);
  return {
    ok: true,
    rebuilt: bulkOps.length,
    source: 'inventories',
    target: 'inventorySnapshots',
    note: 'inventorySnapshots chỉ là cache tăng tốc, có thể rebuild từ inventories bất kỳ lúc nào.',
  };
}

async function rebuildSnapshots() {
  return rebuildInventorySnapshots();
}

async function auditInventorySnapshots() {
  const diffs = await inventoryRepository.auditSnapshots();
  return {
    ok: true,
    totalDiffs: diffs.length,
    diffs,
    source: 'inventories',
    target: 'inventorySnapshots',
  };
}

module.exports = {
  addInventoryEntry,
  getProductStock,
  getManyStocks,
  getWarehouseStock,
  getSnapshotStock,
  getManySnapshotStocks,
  getWarehouseSnapshotStocks,
  listLedger,
  rebuildSnapshots,
  rebuildInventorySnapshots,
  auditInventorySnapshots,
  normalizeQty,
};
