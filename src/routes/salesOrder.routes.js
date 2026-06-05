const router = require('express').Router();
const controller = require('../controllers/salesOrder.controller');

router.get('/', controller.list);
router.post('/import-preview', controller.importPreview);
router.post('/import-confirm', controller.importConfirm);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
