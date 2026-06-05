const COLLECTIONS = Object.freeze({
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  USERS: 'users',
  ROLES: 'roles',
  WAREHOUSES: 'warehouses',
  SALES_ORDERS: 'salesOrders',
  MASTER_ORDERS: 'masterOrders',
  RETURN_ORDERS: 'returnOrders',
  AR_LEDGERS: 'arLedgers',
  FUND_LEDGERS: 'fundLedgers',
  INVENTORIES: 'inventories',
  INVENTORY_SNAPSHOTS: 'inventorySnapshots',
  JOURNALS: 'journals',
  OPERATION_LOGS: 'operationLogs',
  AUDIT_LOGS: 'auditLogs',
  API_LOGS: 'apiLogs',
});

const TRANSACTION_COLLECTIONS = Object.freeze([
  COLLECTIONS.SALES_ORDERS,
  COLLECTIONS.MASTER_ORDERS,
  COLLECTIONS.RETURN_ORDERS,
  COLLECTIONS.AR_LEDGERS,
  COLLECTIONS.FUND_LEDGERS,
  COLLECTIONS.INVENTORIES,
  COLLECTIONS.JOURNALS,
]);

module.exports = { COLLECTIONS, TRANSACTION_COLLECTIONS };
