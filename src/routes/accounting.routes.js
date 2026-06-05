const router = require('express').Router();
const service = require('../services/accountingService');
router.post('/confirm-master-order', async (req, res, next) => {
  try { res.json(await service.confirmMasterOrderAccounting(req.body.masterOrderId, req.body.paymentDrafts || [])); }
  catch (e) { next(e); }
});
module.exports = router;
