const router = require('express').Router();
const Journal = require('../models/Journal');

function cleanText(value) { return String(value || '').trim(); }
function buildFilter(query = {}) {
  const filter = {};
  if (query.type) filter.type = cleanText(query.type);
  if (query.customerCode) filter.customerCode = cleanText(query.customerCode);
  if (query.salesOrderId) filter.salesOrderId = cleanText(query.salesOrderId);
  if (query.salesOrderCode) filter.salesOrderCode = cleanText(query.salesOrderCode);
  if (query.masterOrderId) filter.masterOrderId = cleanText(query.masterOrderId);
  if (query.masterOrderCode) filter.masterOrderCode = cleanText(query.masterOrderCode);
  if (query.dateFrom || query.dateTo || query.date) {
    filter.date = {};
    const from = cleanText(query.dateFrom || query.date);
    const to = cleanText(query.dateTo || query.date);
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  return filter;
}

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 1000);
    const rows = await Journal.find(buildFilter(req.query)).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
    res.json({ ok: true, rows, data: rows, total: rows.length, message: 'OK' });
  } catch (e) { next(e); }
});

module.exports = router;
