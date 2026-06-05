const router = require('express').Router();
const service = require('../services/masterOrderService');
router.post('/', async (req, res, next) => { try { res.json({ ok: true, masterOrder: await service.createMasterOrder(req.body) }); } catch (e) { next(e); } });
router.get('/:id', async (req, res, next) => { try { res.json({ ok: true, data: await service.getMasterWithChildren(req.params.id) }); } catch (e) { next(e); } });
module.exports = router;
