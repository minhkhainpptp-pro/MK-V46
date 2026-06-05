const router = require('express').Router();
const controller = require('../controllers/report.controller');
router.get('/dashboard', controller.dashboard);
module.exports = router;
