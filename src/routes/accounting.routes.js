const router = require('express').Router();
const service = require('../services/accountingService');

router.post('/confirm', async (req, res, next) => {
  try {
    res.json(await service.confirmMasterOrderAccounting(
      req.body.masterOrderId,
      req.body.paymentDrafts || [],
      req.body.confirmedBy || req.body.userCode || ''
    ));
  } catch (e) { next(e); }
});

router.post('/confirm-master-order', async (req, res, next) => {
  try {
    res.json(await service.confirmMasterOrderAccounting(
      req.body.masterOrderId,
      req.body.paymentDrafts || [],
      req.body.confirmedBy || req.body.userCode || ''
    ));
  } catch (e) { next(e); }
});

module.exports = router;
