const router = require('express').Router();
const controller = require('../controllers/masterOrder.controller');

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/create', controller.create);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/deliver', controller.deliver);
router.post('/:id/accounting-confirm', controller.accountingConfirm);

module.exports = router;
