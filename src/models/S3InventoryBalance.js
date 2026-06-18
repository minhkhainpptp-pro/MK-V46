'use strict';

const flexModel = require('./_flexModel');

module.exports = flexModel('S3InventoryBalance', 's3InventoryBalances', {
  productCode: String,
  productName: String,
  siteId: String,
  warehouseCode: String,
  quantityBaseUnit: Number,
  caseQuantity: Number,
  unitQuantity: Number,
  conversionRate: Number,
  snapshotAt: String,
  syncRunId: String,
  sourceSystem: { type: String, default: 'S3' },
  sourceVersion: String,
  sourceUpdatedAt: String,
  active: { type: Boolean, default: true },
  readOnly: { type: Boolean, default: true },
  createdAt: String,
  updatedAt: String
});
