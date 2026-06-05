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

async function ensureMongoIndexes() {
  await Promise.all([
    SalesOrder.collection.createIndex({ deliveryDate: 1, deliveryStaffCode: 1, status: 1 }, { name: 'idx_so_delivery_staff_status' }),
    SalesOrder.collection.createIndex({ masterOrderId: 1 }, { name: 'idx_so_master_order' }),
    SalesOrder.collection.createIndex({ normalizedCode: 1 }, { name: 'idx_so_normalized_code' }),
    MasterOrder.collection.createIndex({ deliveryDate: 1, deliveryStaffCode: 1 }, { name: 'idx_mo_delivery_staff' }),
    ReturnOrder.collection.createIndex({ salesOrderId: 1, status: 1 }, { name: 'idx_ro_so_status' }),
    ReturnOrder.collection.createIndex({ salesOrderCode: 1, status: 1 }, { name: 'idx_ro_code_status' }),
    ReturnOrder.collection.createIndex({ deliveryDate: 1, deliveryStaffCode: 1 }, { name: 'idx_ro_delivery_staff' }),
    ArLedger.collection.createIndex({ customerCode: 1, date: 1 }, { name: 'idx_ar_customer_date' }),
    ArLedger.collection.createIndex({ masterOrderId: 1, type: 1 }, { name: 'idx_ar_master_type' }),
    FundLedger.collection.createIndex({ date: 1, type: 1 }, { name: 'idx_fund_date_type' }),
    FundLedger.collection.createIndex({ masterOrderId: 1 }, { name: 'idx_fund_master' }),
    Product.collection.createIndex({ code: 1 }, { name: 'idx_product_code_unique', unique: true }),
    Product.collection.createIndex({ name: 1 }, { name: 'idx_product_name' }),
    Product.collection.createIndex({ barcode: 1 }, { name: 'idx_product_barcode' }),
    Customer.collection.createIndex({ code: 1 }, { name: 'idx_customer_code_unique', unique: true }),
    Customer.collection.createIndex({ name: 1 }, { name: 'idx_customer_name' }),
    Customer.collection.createIndex({ salesStaffCode: 1 }, { name: 'idx_customer_sales_staff' }),
    Customer.collection.createIndex({ deliveryStaffCode: 1 }, { name: 'idx_customer_delivery_staff' }),
    User.collection.createIndex({ code: 1 }, { name: 'idx_user_code_unique', unique: true }),
    User.collection.createIndex({ username: 1 }, { name: 'idx_user_username_unique', unique: true }),
    User.collection.createIndex({ roleCode: 1 }, { name: 'idx_user_role_code' }),
    Role.collection.createIndex({ code: 1 }, { name: 'idx_role_code_unique', unique: true }),
    Warehouse.collection.createIndex({ code: 1 }, { name: 'idx_warehouse_code_unique', unique: true }),
  ]);
  console.log('[DB] Indexes ensured');
}

module.exports = { ensureMongoIndexes };
