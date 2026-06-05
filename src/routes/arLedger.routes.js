const router = require('express').Router();
const controller = require('../controllers/arLedger.controller');

router.get('/', controller.list);
router.get('/customer/:customerCode', controller.byCustomer);
router.post('/receipt', controller.receipt);
router.post('/discount', controller.discount);

module.exports = router;
