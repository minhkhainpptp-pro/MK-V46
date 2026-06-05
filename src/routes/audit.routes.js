const router = require('express').Router();
const AuditLog = require('../models/AuditLog');
const { requireRole } = require('../middlewares/permission.middleware');

router.get('/', requireRole('admin', 'accounting'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.module) filter.module = String(req.query.module).trim();
    if (req.query.action) filter.action = String(req.query.action).trim();
    if (req.query.referenceId) filter.referenceId = String(req.query.referenceId).trim();
    const rows = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit || 200), 1000))
      .lean();
    res.json({ ok: true, rows, data: rows, total: rows.length });
  } catch (err) { next(err); }
});

module.exports = router;
