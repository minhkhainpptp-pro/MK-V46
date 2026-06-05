const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const INVENTORY_TRANSACTION_TYPES = [
  'IN_IMPORT',
  'OUT_SALE',
  'IN_RETURN',
  'ADJUSTMENT',
];

const schema = createBaseSchema({
  transactionType: {
    type: String,
    enum: INVENTORY_TRANSACTION_TYPES,
    required: true,
    index: true,
  },

  productId: { type: String, required: true, index: true },
  productCode: { type: String, default: '', index: true },
  productName: { type: String, default: '' },

  warehouseId: { type: String, required: true, index: true },
  warehouseCode: { type: String, default: '', index: true },
  warehouseName: { type: String, default: '' },

  qty: { type: Number, required: true, default: 0 },
  unit: { type: String, default: '' },

  referenceType: { type: String, default: '', index: true },
  referenceId: { type: String, default: '', index: true },
  referenceCode: { type: String, default: '', index: true },

  note: { type: String, default: '' },
});

schema.index({ productId: 1, warehouseId: 1 }, { name: 'idx_inventory_product_warehouse' });
schema.index({ transactionType: 1 }, { name: 'idx_inventory_transaction_type' });
schema.index({ referenceCode: 1 }, { name: 'idx_inventory_reference_code' });
schema.index({ createdAt: -1 }, { name: 'idx_inventory_created_at' });
schema.index({ referenceType: 1, referenceId: 1 }, { name: 'idx_inventory_reference_type_id' });
schema.index({ productCode: 1, warehouseCode: 1 }, { name: 'idx_inventory_product_code_warehouse_code' });

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', schema, 'inventories');
module.exports.INVENTORY_TRANSACTION_TYPES = INVENTORY_TRANSACTION_TYPES;
