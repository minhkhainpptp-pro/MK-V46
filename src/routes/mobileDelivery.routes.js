const router = require('express').Router();
const service = require('../services/deliveryService');
router.get('/orders', async (req, res, next) => {
  const started = Date.now();
  try {
    const rows = await service.listDeliveryOrders(req.query);
    res.json({ ok: true, rows, orders: rows, total: rows.length, ms: Date.now() - started });
  } catch (e) { next(e); }
});
router.get('/orders/:id', async (req, res, next) => { try { res.json({ ok: true, data: await service.getDeliveryOrderDetail(req.params.id) }); } catch (e) { next(e); } });
router.post('/confirm', async (req, res, next) => { try { res.json(await service.confirmDelivery(req.body)); } catch (e) { next(e); } });
module.exports = router;
