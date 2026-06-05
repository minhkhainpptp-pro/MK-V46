const SalesOrder = require('../models/SalesOrder');
const MasterOrder = require('../models/MasterOrder');
const ReturnOrder = require('../models/ReturnOrder');
const ArLedger = require('../models/ArLedger');
const FundLedger = require('../models/FundLedger');

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
  ]);
  console.log('[DB] Indexes ensured');
}

module.exports = { ensureMongoIndexes };
