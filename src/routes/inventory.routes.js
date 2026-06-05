const router = require('express').Router();
const inventoryService = require('../services/inventory.service');
const inventoryPosting = require('../services/posting/inventoryPosting');

function sendOk(res, payload = {}, message = 'OK') {
  res.json({ ok: true, ...payload, message });
}

function getRole(req) {
  return String(
    (req.user && (req.user.roleCode || req.user.role || req.user.type))
    || req.headers['x-user-role']
    || req.headers['x-role']
    || ''
  ).trim().toLowerCase();
}

function requireInventoryAdmin(req, res, next) {
  const role = getRole(req);
  const allowed = new Set(['admin', 'owner', 'ketoantruong', 'chief_accountant', 'accounting_manager']);
  if (allowed.has(role)) return next();

  const err = new Error('Chỉ admin/kế toán trưởng được phép rebuild Inventory Snapshot');
  err.status = 403;
  return next(err);
}

router.get('/stock', async (req, res, next) => {
  try {
    const result = await inventoryService.getWarehouseSnapshotStocks(req.query);
    sendOk(res, {
      data: result.rows,
      rows: result.rows,
      total: result.total,
      source: result.source,
      canonicalSource: result.canonicalSource,
    });
  } catch (err) { next(err); }
});

router.get('/product/:id', async (req, res, next) => {
  try {
    const result = await inventoryService.getSnapshotStock(req.params.id, req.query.warehouseId || req.query.warehouseCode || '');
    sendOk(res, { data: result });
  } catch (err) { next(err); }
});

router.get('/ledger', async (req, res, next) => {
  try {
    const result = await inventoryService.listLedger(req.query);
    sendOk(res, {
      data: result.rows,
      rows: result.rows,
      total: result.total,
      source: result.source,
    });
  } catch (err) { next(err); }
});

router.post('/adjustment', async (req, res, next) => {
  try {
    const result = await inventoryPosting.postAdjustment({
      ...req.body,
      referenceType: req.body.referenceType || 'ADJUSTMENT',
      referenceCode: req.body.referenceCode || req.body.code || '',
      note: req.body.note || 'Điều chỉnh tồn kho',
    });
    res.status(201).json({ ok: true, data: result, message: 'Đã điều chỉnh tồn kho' });
  } catch (err) { next(err); }
});

router.post('/snapshots/rebuild', requireInventoryAdmin, async (req, res, next) => {
  try {
    const result = await inventoryService.rebuildInventorySnapshots();
    sendOk(res, { data: result }, 'Đã rebuild inventorySnapshots từ inventories');
  } catch (err) { next(err); }
});

router.get('/snapshots/audit', async (req, res, next) => {
  try {
    const result = await inventoryService.auditInventorySnapshots();
    sendOk(res, {
      data: result.diffs,
      rows: result.diffs,
      total: result.totalDiffs,
      source: result.source,
      target: result.target,
    }, result.totalDiffs ? 'Có lệch snapshot' : 'Snapshot khớp ledger');
  } catch (err) { next(err); }
});

module.exports = router;
