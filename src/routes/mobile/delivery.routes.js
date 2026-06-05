const router = require('express').Router();
const controller = require('../../controllers/mobile/delivery.controller');
const reportController = require('../../controllers/mobile/report.controller');

router.get('/orders', controller.listOrders);
router.get('/detail/:id', controller.getOrder);
router.get('/report', reportController.getReport);
router.get('/order/:id', controller.getOrder);
router.get('/orders/:id', controller.getOrder);
router.post('/confirm', controller.confirm);

module.exports = router;
