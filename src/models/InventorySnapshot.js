const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const schema = createBaseSchema({
  productId: { type: String, required: true, index: true },
  productCode: { type: String, default: '', index: true },
  productName: { type: String, default: '' },

  warehouseId: { type: String, required: true, index: true },
  warehouseCode: { type: String, default: '', index: true },
  warehouseName: { type: String, default: '' },

  qty: { type: Number, required: true, default: 0 },
  unit: { type: String, default: '' },
});

schema.index(
  { productId: 1, warehouseId: 1 },
  { name: 'idx_inventory_snapshot_product_warehouse_unique', unique: true }
);
schema.index({ productCode: 1, warehouseCode: 1 }, { name: 'idx_inventory_snapshot_product_code_warehouse_code' });
schema.index({ updatedAt: -1 }, { name: 'idx_inventory_snapshot_updated_at' });

module.exports = mongoose.models.InventorySnapshot || mongoose.model('InventorySnapshot', schema, 'inventorySnapshots');
