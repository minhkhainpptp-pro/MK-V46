'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('source write routes are guarded while delivery/read routes stay available', () => {
  const orderRoutes = read('src/routes/orderRoutes.js');
  const masterRoutes = read('src/routes/masterOrderRoutes.js');
  const importRoutes = read('src/routes/importOrderRoutes.js');
  const mobileRoutes = read('src/routes/mobile/sales.routes.js');
  const reportRoutes = read('src/routes/reportRoutes.js');

  assert.match(orderRoutes, /router\.post\('\/'[^\r\n]+blockOrderSourceWrite/);
  assert.match(orderRoutes, /router\.delete\('\/:id'[^\r\n]+blockOrderSourceWrite/);
  assert.match(orderRoutes, /vat-invoice-setting[^\r\n]+blockOrderSourceWrite[^\r\n]+orderController\.updateVatInvoiceSetting/);

  assert.match(masterRoutes, /router\.post\('\/'[^\r\n]+blockMasterOrderSourceWrite/);
  assert.match(masterRoutes, /router\.put\('\/:id'[^\r\n]+blockMasterOrderSourceWrite/);
  assert.match(masterRoutes, /delivery-today\/:id'[^\r\n]+masterOrderController\.updateDeliveryTodayOrder/);
  assert.doesNotMatch(
    masterRoutes.match(/router\.patch\('\/delivery-today\/:id'[^\r\n]+/)?.[0] || '',
    /blockMasterOrderSourceWrite/
  );

  assert.match(importRoutes, /post phiếu nhập kho trên V45/);
  assert.match(mobileRoutes, /blockOrderSourceWrite\('tạo đơn bán từ app trên V45'\)/);
  assert.match(reportRoutes, /blockInventorySourceWrite\('rebuild tồn kho V45'\)/);
});

test('service boundaries block bypasses around route middleware', () => {
  const files = {
    lifecycle: read('src/domain/lifecycle/SalesLifecycleService.js'),
    deletion: read('src/domain/lifecycle/SalesOrderDeletionService.js'),
    legacyOrder: read('src/services/orderLegacy.service.js'),
    mobile: read('src/services/mobile/sales.service.js'),
    importOrder: read('src/services/importOrderService.js'),
    master: read('src/services/master-order/masterOrderLegacy.service.js'),
    excel: read('src/services/excelImportService.js')
  };

  assert.match(files.lifecycle, /assertLocalOrderEnabled\('tạo đơn bán trên V45'\)/);
  assert.match(files.deletion, /assertLocalOrderEnabled\('xóa đơn bán nguồn trên V45'\)/);
  assert.match(files.legacyOrder, /assertLocalOrderEnabled\('sửa nội dung đơn bán trên V45'\)/);
  assert.match(files.mobile, /assertLocalOrderEnabled\('sửa nội dung đơn bán từ app trên V45'\)/);
  assert.match(files.importOrder, /assertLocalInventoryEnabled\('post phiếu nhập kho trên V45'\)/);
  assert.match(files.master, /assertLocalMasterOrderEnabled\('sửa thành phần đơn tổng trên V45'\)/);
  assert.match(files.excel, /assertLocalImportEnabled\('salesOrders', 'import đơn DMS\/Excel trên V45'\)/);
});

test('inventory posting guard covers every required function', () => {
  const source = read('src/domain/posting/InventoryPostingService.js');
  for (const name of [
    'postImportIn',
    'postSaleOut',
    'postSalesOrdersBulkOut',
    'postSaleEditDelta',
    'postReturnIn',
    'reverseMovement',
    'reconcileInventory'
  ]) {
    const start = source.indexOf(`async function ${name}`);
    assert.notEqual(start, -1, `${name} must exist`);
    const next = source.indexOf('\nasync function ', start + 1);
    const block = source.slice(start, next === -1 ? source.length : next);
    assert.match(block, /assertLocalInventoryEnabled\(/, `${name} must assert local inventory authority`);
  }
});
