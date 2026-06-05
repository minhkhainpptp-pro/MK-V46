const service = require('../../services/mobile/delivery.service');

async function listOrders(req, res, next) {
  const started = Date.now();
  try {
    const result = await service.listDeliveryOrders(req.query);
    res.json({ ok: true, rows: result.rows, orders: result.rows, total: result.total, ms: Date.now() - started, perf: result.perf || { totalMs: Date.now() - started } });
  } catch (err) { next(err); }
}

async function getOrder(req, res, next) {
  try {
    const data = await service.getDeliveryOrderDetail(req.params.id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

async function confirm(req, res, next) {
  try {
    const data = await service.confirmDelivery(req.body);
    res.json(data);
  } catch (err) { next(err); }
}

module.exports = { listOrders, getOrder, confirm };
