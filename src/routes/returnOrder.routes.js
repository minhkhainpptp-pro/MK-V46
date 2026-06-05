const router = require('express').Router();
const controller = require('../controllers/returnOrder.controller');

router.get('/', controller.list);
router.get('/by-sales-order/:salesOrderId', controller.getBySalesOrder);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/accounting-confirm', controller.accountingConfirm);

module.exports = router;
