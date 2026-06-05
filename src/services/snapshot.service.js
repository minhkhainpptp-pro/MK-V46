const InventorySnapshot = require('../models/InventorySnapshot');

function clean(value) {
  return String(value || '').trim();
}

function toQty(value) {
  const qty = Number(value || 0);
  if (!Number.isFinite(qty) || qty === 0) {
    throw Object.assign(new Error('Số lượng cập nhật snapshot không hợp lệ'), { status: 400 });
  }
  return qty;
}

/**
 * inventorySnapshots chỉ là cache tăng tốc đọc tồn hiện tại.
 * Không module nghiệp vụ nào được gọi hàm này trực tiếp.
 * Luồng ghi đúng: nghiệp vụ -> inventoryPosting -> inventories -> updateSnapshot().
 */
async function updateSnapshot(entry = {}, options = {}) {
  const productId = clean(entry.productId);
  const warehouseId = clean(entry.warehouseId);
  const qty = toQty(entry.qty);

  if (!productId) throw Object.assign(new Error('Thiếu productId để cập nhật snapshot tồn kho'), { status: 400 });
  if (!warehouseId) throw Object.assign(new Error('Thiếu warehouseId để cập nhật snapshot tồn kho'), { status: 400 });

  return InventorySnapshot.findOneAndUpdate(
    { productId, warehouseId },
    {
      $inc: { qty },
      $set: {
        productCode: clean(entry.productCode),
        productName: clean(entry.productName),
        warehouseCode: clean(entry.warehouseCode),
        warehouseName: clean(entry.warehouseName),
        unit: clean(entry.unit),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        productId,
        warehouseId,
        code: `${productId}__${warehouseId}`,
        createdBy: clean(entry.createdBy),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      ...options,
    }
  ).lean();
}

module.exports = { updateSnapshot };
