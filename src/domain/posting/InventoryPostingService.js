'use strict';

const inventoryService = require('../../services/inventoryService');
const integrationConfig = require('../../config/integrationConfig');

function assertLocalInventoryEnabled(action) {
  if (
    integrationConfig.isS3Execution
    && integrationConfig.inventoryAuthority === 'S3'
  ) {
    const err = new Error(
      `Không được ${action}: tồn kho đang được quản lý bởi S3`
    );
    err.code = 'INVENTORY_MANAGED_BY_S3';
    err.status = 409;
    throw err;
  }
}

async function postImportIn(importOrder = {}, options = {}) {
  assertLocalInventoryEnabled('nhập kho từ phiếu nhập V45');
  const movement = {
    type: 'IMPORT',
    direction: 'IN',
    refType: 'IMPORT_ORDER',
    refId: importOrder.id || importOrder.code,
    refCode: importOrder.code || importOrder.id,
    date: importOrder.date || importOrder.documentDate,
    note: 'Nhập kho'
  };

  if (inventoryService.postStockMovementBulkImportIn && options.disableBulkImportPosting !== true) {
    return inventoryService.postStockMovementBulkImportIn(importOrder, movement, options);
  }

  return inventoryService.postStockMovement(importOrder, movement, options);
}


async function postSalesOrdersBulkOut(orders = [], options = {}) {
  assertLocalInventoryEnabled('xuất kho hàng loạt theo đơn bán V45');
  if (!options.session && options.allowUnsafeNoSession !== true) {
    const err = new Error('postSalesOrdersBulkOut cần chạy trong Mongo session để đảm bảo atomic inventory posting');
    err.code = 'INVENTORY_SESSION_REQUIRED';
    throw err;
  }

  if (inventoryService.postStockMovementBulkSalesOut && options.disableBulkSalesPosting !== true) {
    return inventoryService.postStockMovementBulkSalesOut(orders, options);
  }

  const transactions = [];
  for (const order of Array.isArray(orders) ? orders : []) {
    const rows = await postSaleOut(order, options);
    transactions.push(...(Array.isArray(rows) ? rows : []));
  }
  return transactions;
}

async function postSaleOut(order = {}, options = {}) {
  assertLocalInventoryEnabled('xuất kho theo đơn bán V45');
  if (!options.session && options.allowUnsafeNoSession !== true) {
    const err = new Error('postSaleOut cần chạy trong Mongo session để đảm bảo atomic inventory posting');
    err.code = 'INVENTORY_SESSION_REQUIRED';
    throw err;
  }

  return inventoryService.postStockMovement(order, {
    type: 'SALE',
    direction: 'OUT',
    refType: 'SALES_ORDER',
    refId: order.id || order._id || order.code,
    refCode: order.code || order.id,
    date: order.date || order.orderDate || order.createdAt,
    note: 'Xuất kho theo đơn bán'
  }, options);
}


async function postSaleEditDelta(order = {}, items = [], direction = 'OUT', options = {}) {
  assertLocalInventoryEnabled('điều chỉnh tồn do sửa đơn bán V45');
  if (!options.session && options.allowUnsafeNoSession !== true) {
    const err = new Error('postSaleEditDelta cần chạy trong Mongo session để đảm bảo atomic inventory posting');
    err.code = 'INVENTORY_SESSION_REQUIRED';
    throw err;
  }

  const normalizedDirection = String(direction || '').toUpperCase() === 'IN' ? 'IN' : 'OUT';
  const commandId = String(options.commandId || options.idempotencyKey || Date.now()).trim();
  const orderIdentity = String(order.id || order._id || order.code || '').trim();
  const refId = `${orderIdentity}:EDIT:${commandId}:${normalizedDirection}`;

  return inventoryService.postStockMovement({
    ...order,
    id: refId,
    items: Array.isArray(items) ? items : []
  }, {
    type: normalizedDirection === 'IN' ? 'SALE_EDIT_IN' : 'SALE_EDIT_OUT',
    direction: normalizedDirection,
    refType: 'SALES_ORDER_EDIT',
    refId,
    refCode: order.code || order.id,
    date: order.date || order.orderDate || order.createdAt,
    note: normalizedDirection === 'IN'
      ? `Hoàn tồn do sửa đơn bán ${order.code || order.id || ''}`
      : `Trừ thêm tồn do sửa đơn bán ${order.code || order.id || ''}`
  }, options);
}

async function postReturnIn(returnOrder = {}, options = {}) {
  assertLocalInventoryEnabled('nhập kho hàng trả trên V45');
  return inventoryService.postStockMovement(returnOrder, {
    type: 'RETURN',
    direction: 'IN',
    refType: 'RETURN_ORDER',
    refId: returnOrder.id || returnOrder.code,
    refCode: returnOrder.code || returnOrder.id,
    date: returnOrder.date || returnOrder.documentDate,
    note: 'Nhập lại kho theo phiếu trả hàng'
  }, options);
}

async function reverseMovement(document = {}, movement = {}, options = {}) {
  assertLocalInventoryEnabled('đảo giao dịch tồn kho trên V45');
  return inventoryService.reverseStockMovement(document, movement, options);
}

async function reconcileInventory(options = {}) {
  assertLocalInventoryEnabled('rebuild/đối soát ghi tồn kho V45');
  return inventoryService.rebuildCurrentInventoryFromTransactions(options);
}

module.exports = {
  postImportIn,
  postSaleOut,
  postSalesOrdersBulkOut,
  postSaleEditDelta,
  postReturnIn,
  reverseMovement,
  reconcileInventory,
  assertLocalInventoryEnabled
};
