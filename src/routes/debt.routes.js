const router = require('express').Router();
const service = require('../services/debtService');
router.get('/customers', async (req, res, next) => { try { res.json({ ok: true, rows: await service.listCustomerDebts(req.query) }); } catch (e) { next(e); } });
module.exports = router;
