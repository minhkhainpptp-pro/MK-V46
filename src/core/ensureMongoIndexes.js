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
const Journal = require('../models/Journal');
const OperationLog = require('../models/OperationLog');
const AuditLog = require('../models/AuditLog');
const ApiLog = require('../models/ApiLog');

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

async function safeCreateIndex(collection, keys, options = {}) {
  try {
    return await collection.createIndex(keys, options);
  } catch (err) {
    if (err && (err.code === 85 || err.code === 86 || err.codeName === 'IndexOptionsConflict' || err.codeName === 'IndexKeySpecsConflict')) {
      console.warn('[INDEX_SKIP_CONFLICT]', collection.collectionName, options.name || JSON.stringify(keys));
      return null;
    }
    throw err;
  }
}

async function ensureMongoIndexes() {
  // Drop legacy non-partial unique index that treats missing customerCode as null.
  // It caused: E11000 duplicate key customers index: customerCode_1 dup key { customerCode: null }.
  await dropIndexIfExists(Customer.collection, 'customerCode_1');
  await repairCustomerCatalog();

  await Promise.all([

    safeCreateIndex(SalesOrder.collection, { code: 1 }, { name: 'idx_so_code_unique', unique: true }),
    safeCreateIndex(SalesOrder.collection, { id: 1 }, { name: 'idx_so_id' }),
    safeCreateIndex(SalesOrder.collection, { deliveryDate: 1, deliveryStaffCode: 1, status: 1 }, { name: 'idx_so_delivery_staff_status' }),
    safeCreateIndex(SalesOrder.collection, { masterOrderId: 1 }, { name: 'idx_so_master_order' }),
    safeCreateIndex(SalesOrder.collection, { normalizedCode: 1 }, { name: 'idx_so_normalized_code' }),
    safeCreateIndex(MasterOrder.collection, { code: 1 }, { name: 'idx_mo_code_unique', unique: true }),
    safeCreateIndex(MasterOrder.collection, { id: 1 }, { name: 'idx_mo_id' }),
    safeCreateIndex(MasterOrder.collection, { deliveryDate: 1, deliveryStaffCode: 1 }, { name: 'idx_mo_delivery_staff' }),
    safeCreateIndex(ReturnOrder.collection, { salesOrderId: 1, status: 1 }, { name: 'idx_ro_so_status' }),
    safeCreateIndex(ReturnOrder.collection, { salesOrderCode: 1, status: 1 }, { name: 'idx_ro_code_status' }),
    safeCreateIndex(ReturnOrder.collection, { deliveryDate: 1, deliveryStaffCode: 1 }, { name: 'idx_ro_delivery_staff' }),
    safeCreateIndex(ArLedger.collection, { customerCode: 1, date: 1 }, { name: 'idx_ar_customer_date' }),
    safeCreateIndex(ArLedger.collection, { salesOrderId: 1 }, { name: 'idx_ar_sales_order_id' }),
    safeCreateIndex(ArLedger.collection, { salesOrderCode: 1 }, { name: 'idx_ar_sales_order_code' }),
    safeCreateIndex(ArLedger.collection, { masterOrderId: 1 }, { name: 'idx_ar_master_order_id' }),
    safeCreateIndex(ArLedger.collection, { masterOrderCode: 1 }, { name: 'idx_ar_master_order_code' }),
    safeCreateIndex(ArLedger.collection, { type: 1 }, { name: 'idx_ar_type' }),
    safeCreateIndex(ArLedger.collection, { date: 1 }, { name: 'idx_ar_date' }),
    safeCreateIndex(ArLedger.collection, { masterOrderId: 1, type: 1 }, { name: 'idx_ar_master_type' }),
    safeCreateIndex(ArLedger.collection, 
      { sourceType: 1, sourceId: 1, type: 1 },
      { name: 'idx_ar_source_type_id_type_unique', unique: true, partialFilterExpression: { sourceType: { $type: 'string' }, sourceId: { $type: 'string' }, type: { $type: 'string' } } }
    ),
    safeCreateIndex(FundLedger.collection, { date: 1, type: 1 }, { name: 'idx_fund_date_type' }),
    safeCreateIndex(FundLedger.collection, { masterOrderId: 1 }, { name: 'idx_fund_master' }),
    safeCreateIndex(FundLedger.collection,
      { sourceType: 1, sourceId: 1, type: 1 },
      { name: 'idx_fund_source_type_id_type_unique', unique: true, partialFilterExpression: { sourceType: { $type: 'string' }, sourceId: { $type: 'string' }, type: { $type: 'string' } } }
    ),
    safeCreateIndex(Product.collection, { code: 1 }, { name: 'idx_product_code_unique', unique: true }),
    safeCreateIndex(Product.collection, { name: 1 }, { name: 'idx_product_name' }),
    safeCreateIndex(Product.collection, { barcode: 1 }, { name: 'idx_product_barcode' }),
    safeCreateIndex(Customer.collection, 
      { customerCode: 1 },
      {
        name: 'idx_customer_customer_code_unique',
        unique: true,
        partialFilterExpression: { customerCode: { $type: 'string', $gt: '' } },
      }
    ),
    safeCreateIndex(Customer.collection, { salesStaffCode: 1 }, { name: 'idx_customer_sales_staff_code' }),
    safeCreateIndex(Customer.collection, { deliveryStaffCode: 1 }, { name: 'idx_customer_delivery_staff_code' }),
    safeCreateIndex(Customer.collection, { routeCode: 1 }, { name: 'idx_customer_route_code' }),
    safeCreateIndex(Customer.collection, { customerName: 'text', customerCode: 'text', phone: 'text' }, { name: 'idx_customer_search_text' }),
    safeCreateIndex(User.collection, { code: 1 }, { name: 'idx_user_code_unique', unique: true }),
    safeCreateIndex(User.collection, { username: 1 }, { name: 'idx_user_username_unique', unique: true }),
    safeCreateIndex(User.collection, { roleCode: 1 }, { name: 'idx_user_role_code' }),
    safeCreateIndex(Role.collection, { code: 1 }, { name: 'idx_role_code_unique', unique: true }),
    safeCreateIndex(Warehouse.collection, { code: 1 }, { name: 'idx_warehouse_code_unique', unique: true }),
    safeCreateIndex(Inventory.collection, { productId: 1, warehouseId: 1 }, { name: 'idx_inventory_product_warehouse' }),
    safeCreateIndex(Inventory.collection, { transactionType: 1 }, { name: 'idx_inventory_transaction_type' }),
    safeCreateIndex(Inventory.collection, { referenceCode: 1 }, { name: 'idx_inventory_reference_code' }),
    safeCreateIndex(Inventory.collection, { createdAt: -1 }, { name: 'idx_inventory_created_at' }),
    safeCreateIndex(Inventory.collection, { referenceType: 1, referenceId: 1 }, { name: 'idx_inventory_reference_type_id' }),
    safeCreateIndex(InventorySnapshot.collection, { productId: 1, warehouseId: 1 }, { name: 'idx_inventory_snapshot_product_warehouse_unique', unique: true }),
    safeCreateIndex(InventorySnapshot.collection, { productCode: 1, warehouseCode: 1 }, { name: 'idx_inventory_snapshot_product_code_warehouse_code' }),
    safeCreateIndex(InventorySnapshot.collection, { updatedAt: -1 }, { name: 'idx_inventory_snapshot_updated_at' }),
    safeCreateIndex(Journal.collection, { date: 1, type: 1 }, { name: 'idx_journal_date_type' }),
    safeCreateIndex(Journal.collection, { salesOrderId: 1 }, { name: 'idx_journal_sales_order_id' }),
    safeCreateIndex(Journal.collection, { masterOrderId: 1 }, { name: 'idx_journal_master_order_id' }),
    safeCreateIndex(Journal.collection,
      { sourceType: 1, sourceId: 1, type: 1 },
      { name: 'idx_journal_source_type_id_type_unique', unique: true, partialFilterExpression: { sourceType: { $type: 'string' }, sourceId: { $type: 'string' }, type: { $type: 'string' } } }
    ),

    safeCreateIndex(OperationLog.collection, { operationId: 1 }, { name: 'idx_operation_id_unique', unique: true }),
    safeCreateIndex(OperationLog.collection, { type: 1, referenceId: 1 }, { name: 'idx_operation_type_reference' }),
    safeCreateIndex(AuditLog.collection, { module: 1, action: 1, createdAt: -1 }, { name: 'idx_audit_module_action_created' }),
    safeCreateIndex(AuditLog.collection, { referenceId: 1 }, { name: 'idx_audit_reference_id' }),
    safeCreateIndex(ApiLog.collection, { createdAt: -1 }, { name: 'idx_api_log_created_at' }),
    safeCreateIndex(ApiLog.collection, { path: 1, createdAt: -1 }, { name: 'idx_api_log_path_created' }),
    safeCreateIndex(ApiLog.collection, { ms: -1, createdAt: -1 }, { name: 'idx_api_log_ms_created' }),
  ]);
  console.log('[DB] Indexes ensured');
}

module.exports = { ensureMongoIndexes };
