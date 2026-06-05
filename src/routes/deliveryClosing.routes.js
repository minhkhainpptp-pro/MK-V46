const router = require('express').Router();
const service = require('../services/deliveryClosing.service');

router.get('/', async (req, res, next) => {
  try {
    const result = await service.list(req.query);
    res.json({ ok: true, rows: result.rows, data: result.rows, total: result.total });
  } catch (err) { next(err); }
});

router.get('/expected', async (req, res, next) => {
  try {
    const result = await service.calculateExpected(req.query);
    res.json({ ok: true, rows: result.rows, summary: result.summary });
  } catch (err) { next(err); }
});

router.post('/close', async (req, res, next) => {
  try {
    const result = await service.closeDay(req.body || {});
    res.status(201).json({ ok: true, data: result.closing, closing: result.closing, expected: result.expected });
  } catch (err) { next(err); }
});

module.exports = router;
