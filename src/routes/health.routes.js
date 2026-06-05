const router = require('express').Router();
router.get('/', (req, res) => res.json({ ok: true, name: 'MK-V46 Clean Core', time: new Date().toISOString() }));
module.exports = router;
