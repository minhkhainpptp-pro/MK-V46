const router = require('express').Router();
const controller = require('../../controllers/mobile/collection.controller');

router.get('/customer-debts', controller.getCustomerDebts);
router.post('/receipt', controller.receipt);

module.exports = router;
