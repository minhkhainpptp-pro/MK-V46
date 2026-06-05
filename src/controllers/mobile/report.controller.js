const service = require('../../services/mobile/report.service');

async function getReport(req, res, next) {
  try {
    const data = await service.getDeliveryReport(req.query);
    res.json({ ok: true, ...data });
  } catch (err) { next(err); }
}

module.exports = { getReport };
