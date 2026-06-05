const SalesOrder = require('../models/SalesOrder');
const MasterOrder = require('../models/MasterOrder');
const ReturnOrder = require('../models/ReturnOrder');
const ArLedger = require('../models/ArLedger');
const FundLedger = require('../models/FundLedger');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Role = require('../models/Role');
const Warehouse = require('../models/Warehouse');
const Inventory = require('../models/Inventory');
const InventorySnapshot = require('../models/InventorySnapshot');

async function dropIndexIfExists(collection, indexName) {
  const indexes = await collection.indexes();
  if (indexes.some((idx) => idx.name === indexName)) {
    await collection.dropIndex(indexName);
  }
}

async function repairCustomerCatalog() {
  // Remove polluted test rows created by earlier wrong routing/model mapping.
  // These rows look like product test records inside `customers` and break the
  // canonical customerCode unique index with customerCode=null.
  await Customer.deleteMany({
    customerCode: { $exists: false },
    customerName: { $exists: false },
    code: /^P\d+/i,
  });

  // Remove truly empty legacy rows; they cannot be recovered into valid customers.
  await Customer.deleteMany({
    $or: [{ customerCode: null }, { customerCode: { $exists: false } }, { customerCode: '' }],
    $and: [
      { $or: [{ code: { $exists: false } }, { code: '' }, { code: null }] },
      { $or: [{ name: { $exists: false } }, { name: '' }, { name: null }] },
      { $or: [{ customerName: { $exists: false } }, { customerName: '' }, { customerName: null }] },
    ],
  });

  // Backfill recoverable legacy customer rows from code/name into canonical fields.
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
          code: {
            $ifNull: ['$code', '$customerCode'],
          },
          name: {
            $ifNull: ['$name', '$customerName'],
          },
          isActive: {
            $ifNull: ['$isActive', true],
          },
        },
      },
    ],
    { updatePipeline: true }
  );
}

async function ensureMongoIndexes() {
  // Drop legacy non-partial unique index that treats missing customerCode as null.
  // It caused: E11000 duplicate key customers index: customerCode_1 dup key { customerCode: null }.
  await dropIndexIfExists(Customer.collection, 'customerCode_1');
  await repairCustomerCatalog();

  await Promise.all([
    SalesOrder.collection.createIndex({ code: 1 }, { name: 'idx_so_code_unique', unique: true }),
    SalesOrder.collection.createIndex({ id: 1 }, { name: 'idx_so_id' }),
    SalesOrder.collection.createIndex({ deliveryDate: 1, deliveryStaffCode: 1, status: 1 }, { name: 'idx_so_delivery_staff_status' }),
    SalesOrder.collection.createIndex({ masterOrderId: 1 }, { name: 'idx_so_master_order' }),
    SalesOrder.collection.createIndex({ normalizedCode: 1 }, { name: 'idx_so_normalized_code' }),
    MasterOrder.collection.createIndex({ code: 1 }, { name: 'idx_mo_code_unique', unique: true }),
    MasterOrder.collection.createIndex({ id: 1 }, { name: 'idx_mo_id' }),
    MasterOrder.collection.createIndex({ deliveryDate: 1, deliveryStaffCode: 1 }, { name: 'idx_mo_delivery_staff' }),
    ReturnOrder.collection.createIndex({ salesOrderId: 1, status: 1 }, { name: 'idx_ro_so_status' }),
    ReturnOrder.collection.createIndex({ salesOrderCode: 1, status: 1 }, { name: 'idx_ro_code_status' }),
    ReturnOrder.collection.createIndex({ deliveryDate: 1, deliveryStaffCode: 1 }, { name: 'idx_ro_delivery_staff' }),
    ArLedger.collection.createIndex({ customerCode: 1, date: 1 }, { name: 'idx_ar_customer_date' }),
    ArLedger.collection.createIndex({ salesOrderId: 1 }, { name: 'idx_ar_sales_order_id' }),
    ArLedger.collection.createIndex({ salesOrderCode: 1 }, { name: 'idx_ar_sales_order_code' }),
    ArLedger.collection.createIndex({ masterOrderId: 1 }, { name: 'idx_ar_master_order_id' }),
    ArLedger.collection.createIndex({ masterOrderCode: 1 }, { name: 'idx_ar_master_order_code' }),
    ArLedger.collection.createIndex({ type: 1 }, { name: 'idx_ar_type' }),
    ArLedger.collection.createIndex({ date: 1 }, { name: 'idx_ar_date' }),
    ArLedger.collection.createIndex({ masterOrderId: 1, type: 1 }, { name: 'idx_ar_master_type' }),
    ArLedger.collection.createIndex(
      { sourceType: 1, sourceId: 1, type: 1 },
      { name: 'idx_ar_source_type_id_type_unique', unique: true, partialFilterExpression: { sourceType: { $type: 'string' }, sourceId: { $type: 'string' }, type: { $type: 'string' } } }
    ),
    FundLedger.collection.createIndex({ date: 1, type: 1 }, { name: 'idx_fund_date_type' }),
    FundLedger.collection.createIndex({ masterOrderId: 1 }, { name: 'idx_fund_master' }),
    Product.collection.createIndex({ code: 1 }, { name: 'idx_product_code_unique', unique: true }),
    Product.collection.createIndex({ name: 1 }, { name: 'idx_product_name' }),
    Product.collection.createIndex({ barcode: 1 }, { name: 'idx_product_barcode' }),
    Customer.collection.createIndex(
      { customerCode: 1 },
      {
        name: 'idx_customer_customer_code_unique',
        unique: true,
        partialFilterExpression: { customerCode: { $type: 'string', $gt: '' } },
      }
    ),
    Customer.collection.createIndex({ salesStaffCode: 1 }, { name: 'idx_customer_sales_staff_code' }),
    Customer.collection.createIndex({ deliveryStaffCode: 1 }, { name: 'idx_customer_delivery_staff_code' }),
    Customer.collection.createIndex({ routeCode: 1 }, { name: 'idx_customer_route_code' }),
    Customer.collection.createIndex({ customerName: 'text', customerCode: 'text', phone: 'text' }, { name: 'idx_customer_search_text' }),
    User.collection.createIndex({ code: 1 }, { name: 'idx_user_code_unique', unique: true }),
    User.collection.createIndex({ username: 1 }, { name: 'idx_user_username_unique', unique: true }),
    User.collection.createIndex({ roleCode: 1 }, { name: 'idx_user_role_code' }),
    Role.collection.createIndex({ code: 1 }, { name: 'idx_role_code_unique', unique: true }),
    Warehouse.collection.createIndex({ code: 1 }, { name: 'idx_warehouse_code_unique', unique: true }),
    Inventory.collection.createIndex({ productId: 1, warehouseId: 1 }, { name: 'idx_inventory_product_warehouse' }),
    Inventory.collection.createIndex({ transactionType: 1 }, { name: 'idx_inventory_transaction_type' }),
    Inventory.collection.createIndex({ referenceCode: 1 }, { name: 'idx_inventory_reference_code' }),
    Inventory.collection.createIndex({ createdAt: -1 }, { name: 'idx_inventory_created_at' }),
    Inventory.collection.createIndex({ referenceType: 1, referenceId: 1 }, { name: 'idx_inventory_reference_type_id' }),
    InventorySnapshot.collection.createIndex({ productId: 1, warehouseId: 1 }, { name: 'idx_inventory_snapshot_product_warehouse_unique', unique: true }),
    InventorySnapshot.collection.createIndex({ productCode: 1, warehouseCode: 1 }, { name: 'idx_inventory_snapshot_product_code_warehouse_code' }),
    InventorySnapshot.collection.createIndex({ updatedAt: -1 }, { name: 'idx_inventory_snapshot_updated_at' }),
  ]);
  console.log('[DB] Indexes ensured');
}

module.exports = { ensureMongoIndexes };
