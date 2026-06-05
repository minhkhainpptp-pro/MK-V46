const inventoryService = require('../inventory.service');

async function assertEnoughStock(input = {}) {
  if (input.transactionType !== 'OUT_SALE') return;

  const productId = String(input.productId || '').trim();
  const warehouseId = String(input.warehouseId || '').trim();
  const saleQty = Math.abs(Number(input.qty || 0));
  const current = await inventoryService.getProductStock(productId, warehouseId);

  if (Number(current.qty || 0) < saleQty) {
    const err = new Error(`Vượt tồn kho: ${input.productCode || productId} tồn ${current.qty}, cần xuất ${saleQty}`);
    err.status = 400;
    throw err;
  }
}

async function post(input = {}, options = {}) {
  const transactionType = String(input.transactionType || '').trim();
  if (transactionType === 'OUT_SALE') {
    await assertEnoughStock({ ...input, transactionType });
  }
  return inventoryService.addInventoryEntry({ ...input, transactionType }, options);
}

async function postImport(input = {}, options = {}) {
  return post({ ...input, transactionType: 'IN_IMPORT' }, options);
}

async function postSale(input = {}, options = {}) {
  return post({ ...input, transactionType: 'OUT_SALE' }, options);
}

async function postReturn(input = {}, options = {}) {
  return post({ ...input, transactionType: 'IN_RETURN' }, options);
}

async function postAdjustment(input = {}, options = {}) {
  return post({ ...input, transactionType: 'ADJUSTMENT' }, options);
}

module.exports = {
  post,
  postImport,
  postSale,
  postReturn,
  postAdjustment,
  assertEnoughStock,
};
