const service = require('../services/reportService');

async function dashboard(req, res, next) {
  try {
    const result = await service.getDashboard(req.query);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

module.exports = { dashboard };
