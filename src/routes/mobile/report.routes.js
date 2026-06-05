const router = require('express').Router();
const controller = require('../../controllers/mobile/report.controller');

router.get('/', controller.getReport);

module.exports = router;
