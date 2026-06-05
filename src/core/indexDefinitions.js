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
const DeliveryClosing = require('../models/DeliveryClosing');

const stringExists = (field) => ({ [field]: { $type: 'string', $gt: '' } });
const sourceUnique = {
  unique: true,
  partialFilterExpression: {
    sourceType: { $type: 'string', $gt: '' },
    sourceId: { $type: 'string', $gt: '' },
    type: { $type: 'string', $gt: '' },
  },
};

const indexDefinitions = [
  { model: SalesOrder, keys: { id: 1 }, options: { name: 'idx_so_id' } },
  { model: SalesOrder, keys: { code: 1 }, options: { name: 'idx_so_code_unique', unique: true, partialFilterExpression: stringExists('code') } },
  { model: SalesOrder, keys: { normalizedCode: 1 }, options: { name: 'idx_so_normalized_code_unique', unique: true, partialFilterExpression: stringExists('normalizedCode') } },
  { model: SalesOrder, keys: { deliveryDate: 1, deliveryStaffCode: 1, status: 1 }, options: { name: 'idx_so_delivery_staff_status' } },
  { model: SalesOrder, keys: { deliveryDate: 1, salesStaffCode: 1, status: 1 }, options: { name: 'idx_so_delivery_sales_status' } },
  { model: SalesOrder, keys: { masterOrderId: 1 }, options: { name: 'idx_so_master_order_id' } },
  { model: SalesOrder, keys: { masterOrderCode: 1 }, options: { name: 'idx_so_master_order_code' } },
  { model: SalesOrder, keys: { customerCode: 1, deliveryDate: 1 }, options: { name: 'idx_so_customer_delivery_date' } },

  { model: MasterOrder, keys: { id: 1 }, options: { name: 'idx_mo_id' } },
  { model: MasterOrder, keys: { code: 1 }, options: { name: 'idx_mo_code_unique', unique: true, partialFilterExpression: stringExists('code') } },
  { model: MasterOrder, keys: { deliveryDate: 1, deliveryStaffCode: 1 }, options: { name: 'idx_mo_delivery_staff' } },

  { model: ReturnOrder, keys: { id: 1 }, options: { name: 'idx_ro_id' } },
  { model: ReturnOrder, keys: { code: 1 }, options: { name: 'idx_ro_code' } },
  { model: ReturnOrder, keys: { salesOrderId: 1, status: 1 }, options: { name: 'idx_ro_so_status' } },
  { model: ReturnOrder, keys: { salesOrderCode: 1, status: 1 }, options: { name: 'idx_ro_code_status' } },
  { model: ReturnOrder, keys: { deliveryDate: 1, deliveryStaffCode: 1 }, options: { name: 'idx_ro_delivery_staff' } },

  { model: ArLedger, keys: { id: 1 }, options: { name: 'idx_ar_id' } },
  { model: ArLedger, keys: { customerCode: 1, date: 1 }, options: { name: 'idx_ar_customer_date' } },
  { model: ArLedger, keys: { salesOrderId: 1 }, options: { name: 'idx_ar_sales_order_id' } },
  { model: ArLedger, keys: { salesOrderCode: 1 }, options: { name: 'idx_ar_sales_order_code' } },
  { model: ArLedger, keys: { masterOrderId: 1 }, options: { name: 'idx_ar_master_order_id' } },
  { model: ArLedger, keys: { masterOrderCode: 1 }, options: { name: 'idx_ar_master_order_code' } },
  { model: ArLedger, keys: { type: 1 }, options: { name: 'idx_ar_type' } },
  { model: ArLedger, keys: { date: 1 }, options: { name: 'idx_ar_date' } },
  { model: ArLedger, keys: { masterOrderId: 1, type: 1 }, options: { name: 'idx_ar_master_type' } },
  { model: ArLedger, keys: { sourceType: 1, sourceId: 1, type: 1 }, options: { name: 'idx_ar_source_type_id_type_unique', ...sourceUnique } },

  { model: FundLedger, keys: { id: 1 }, options: { name: 'idx_fund_id' } },
  { model: FundLedger, keys: { date: 1, type: 1 }, options: { name: 'idx_fund_date_type' } },
  { model: FundLedger, keys: { masterOrderId: 1 }, options: { name: 'idx_fund_master' } },
  { model: FundLedger, keys: { sourceType: 1, sourceId: 1, type: 1 }, options: { name: 'idx_fund_source_type_id_type_unique', ...sourceUnique } },

  { model: Product, keys: { code: 1 }, options: { name: 'idx_product_code_unique', unique: true, partialFilterExpression: stringExists('code') } },
  { model: Product, keys: { name: 1 }, options: { name: 'idx_product_name' } },
  { model: Product, keys: { barcode: 1 }, options: { name: 'idx_product_barcode' } },

  { model: Customer, keys: { customerCode: 1 }, options: { name: 'idx_customer_customer_code_unique', unique: true, partialFilterExpression: stringExists('customerCode') } },
  { model: Customer, keys: { salesStaffCode: 1 }, options: { name: 'idx_customer_sales_staff_code' } },
  { model: Customer, keys: { deliveryStaffCode: 1 }, options: { name: 'idx_customer_delivery_staff_code' } },
  { model: Customer, keys: { routeCode: 1 }, options: { name: 'idx_customer_route_code' } },
  { model: Customer, keys: { customerName: 'text', customerCode: 'text', phone: 'text' }, options: { name: 'idx_customer_search_text' } },

  { model: User, keys: { code: 1 }, options: { name: 'idx_user_code_unique', unique: true, partialFilterExpression: stringExists('code') } },
  { model: User, keys: { userCode: 1 }, options: { name: 'idx_user_user_code_unique', unique: true, partialFilterExpression: stringExists('userCode') } },
  { model: User, keys: { username: 1 }, options: { name: 'idx_user_username_unique', unique: true, partialFilterExpression: stringExists('username') } },
  { model: User, keys: { roleCode: 1 }, options: { name: 'idx_user_role_code' } },
  { model: Role, keys: { code: 1 }, options: { name: 'idx_role_code_unique', unique: true, partialFilterExpression: stringExists('code') } },
  { model: Warehouse, keys: { code: 1 }, options: { name: 'idx_warehouse_code_unique', unique: true, partialFilterExpression: stringExists('code') } },
  { model: Warehouse, keys: { warehouseCode: 1 }, options: { name: 'idx_warehouse_warehouse_code_unique', unique: true, partialFilterExpression: stringExists('warehouseCode') } },

  { model: Inventory, keys: { productId: 1, warehouseId: 1 }, options: { name: 'idx_inventory_product_warehouse' } },
  { model: Inventory, keys: { transactionType: 1 }, options: { name: 'idx_inventory_transaction_type' } },
  { model: Inventory, keys: { referenceCode: 1 }, options: { name: 'idx_inventory_reference_code' } },
  { model: Inventory, keys: { createdAt: -1 }, options: { name: 'idx_inventory_created_at' } },
  { model: Inventory, keys: { referenceType: 1, referenceId: 1 }, options: { name: 'idx_inventory_reference_type_id' } },

  { model: InventorySnapshot, keys: { productId: 1, warehouseId: 1 }, options: { name: 'idx_inventory_snapshot_product_warehouse_unique', unique: true } },
  { model: InventorySnapshot, keys: { productCode: 1, warehouseCode: 1 }, options: { name: 'idx_inventory_snapshot_product_code_warehouse_code' } },
  { model: InventorySnapshot, keys: { updatedAt: -1 }, options: { name: 'idx_inventory_snapshot_updated_at' } },

  { model: Journal, keys: { date: 1, type: 1 }, options: { name: 'idx_journal_date_type' } },
  { model: Journal, keys: { salesOrderId: 1 }, options: { name: 'idx_journal_sales_order_id' } },
  { model: Journal, keys: { masterOrderId: 1 }, options: { name: 'idx_journal_master_order_id' } },
  { model: Journal, keys: { sourceType: 1, sourceId: 1, type: 1 }, options: { name: 'idx_journal_source_type_id_type_unique', ...sourceUnique } },

  { model: OperationLog, keys: { operationId: 1 }, options: { name: 'idx_operation_id_unique', unique: true, partialFilterExpression: stringExists('operationId') } },
  { model: OperationLog, keys: { type: 1, referenceId: 1 }, options: { name: 'idx_operation_type_reference' } },
  { model: AuditLog, keys: { module: 1, action: 1, createdAt: -1 }, options: { name: 'idx_audit_module_action_created' } },
  { model: AuditLog, keys: { referenceId: 1 }, options: { name: 'idx_audit_reference_id' } },
  { model: DeliveryClosing, keys: { date: 1, deliveryStaffCode: 1 }, options: { name: 'idx_delivery_closing_date_staff_unique', unique: true } },
  { model: DeliveryClosing, keys: { deliveryStaffCode: 1, date: -1 }, options: { name: 'idx_delivery_closing_staff_date' } },
  { model: ApiLog, keys: { createdAt: -1 }, options: { name: 'idx_api_log_created_at' } },
  { model: ApiLog, keys: { path: 1, createdAt: -1 }, options: { name: 'idx_api_log_path_created' } },
  { model: ApiLog, keys: { ms: -1, createdAt: -1 }, options: { name: 'idx_api_log_ms_created' } },
];

module.exports = { indexDefinitions };
