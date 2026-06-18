'use strict';

const express = require('express');
const importOrderController = require('../controllers/importOrderController');
const { requireRole } = require('../middlewares/auth.middleware');
const { blockInventorySourceWrite } = require('../middlewares/integrationAuthority.middleware');

const router = express.Router();
const manageImportOrders = requireRole(['admin', 'accountant', 'warehouse']);
const viewImportOrders = requireRole(['admin', 'manager', 'accountant', 'warehouse']);

router.get('/', viewImportOrders, importOrderController.list);
router.post('/', manageImportOrders, blockInventorySourceWrite('tạo phiếu nhập kho trên V45'), importOrderController.create);
router.put('/:id', manageImportOrders, blockInventorySourceWrite('sửa phiếu nhập kho trên V45'), importOrderController.update);
router.post('/:id/post', manageImportOrders, blockInventorySourceWrite('post phiếu nhập kho trên V45'), importOrderController.post);
router.post('/:id/cancel', manageImportOrders, blockInventorySourceWrite('hủy phiếu nhập kho trên V45'), importOrderController.cancel);

module.exports = router;
