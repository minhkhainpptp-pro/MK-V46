const router = require('express').Router();
const service = require('../services/debtService');

router.get('/customers', async (req, res, next) => {
  try {
    const result = await service.getDebtCustomers(req.query);
    res.json({ ok: true, rows: result.rows, data: result.rows, total: result.total, summary: result.summary });
  } catch (e) { next(e); }
});

router.get('/customer-detail', async (req, res, next) => {
  try {
    const result = await service.getCustomerDebtDetail(req.query);
    res.json({ ok: true, customer: result.customer, rows: result.rows, data: result.rows, summary: result.summary });
  } catch (e) { next(e); }
});

module.exports = router;
