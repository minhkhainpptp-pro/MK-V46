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
  },

  productId: { type: String, required: true },
  productCode: { type: String, default: '' },
  productName: { type: String, default: '' },

  warehouseId: { type: String, required: true },
  warehouseCode: { type: String, default: '' },
  warehouseName: { type: String, default: '' },

  qty: { type: Number, required: true, default: 0 },
  unit: { type: String, default: '' },

  referenceType: { type: String, default: '' },
  referenceId: { type: String, default: '' },
  referenceCode: { type: String, default: '' },

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
