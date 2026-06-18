'use strict';

const express = require('express');
const orderController = require('../controllers/orderController');
const { requireRole } = require('../middlewares/auth.middleware');
const { blockOrderSourceWrite } = require('../middlewares/integrationAuthority.middleware');

const router = express.Router();
const writeOrders = requireRole(['admin', 'manager', 'accountant', 'sales']);
const viewOrders = requireRole(['admin', 'manager', 'accountant', 'warehouse']);

router.get('/search', viewOrders, orderController.search);
router.get('/', viewOrders, orderController.list);
router.post('/', writeOrders, blockOrderSourceWrite('tạo đơn bán trên V45'), orderController.create);
router.get('/:id', viewOrders, orderController.get);
router.put('/:id', writeOrders, blockOrderSourceWrite('sửa nội dung đơn bán trên V45'), orderController.update);
router.patch('/:id/vat-invoice-setting', requireRole(['admin', 'accountant']), blockOrderSourceWrite('sửa thiết lập hóa đơn của đơn bán trên V45'), orderController.updateVatInvoiceSetting);
router.patch('/:id', writeOrders, blockOrderSourceWrite('sửa nội dung đơn bán trên V45'), orderController.update);
router.post('/:id/cancel', writeOrders, blockOrderSourceWrite('hủy đơn bán nguồn trên V45'), orderController.cancel);
router.delete('/:id', writeOrders, blockOrderSourceWrite('xóa đơn bán nguồn trên V45'), orderController.remove);

module.exports = router;
