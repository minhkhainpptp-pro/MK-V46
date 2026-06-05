const router = require('express').Router();
const service = require('../services/salesOrderService');
router.get('/', async (req, res, next) => { try { res.json({ ok: true, rows: await service.listSalesOrders(req.query) }); } catch (e) { next(e); } });
router.post('/', async (req, res, next) => { try { res.json({ ok: true, order: await service.createSalesOrder(req.body) }); } catch (e) { next(e); } });
module.exports = router;
