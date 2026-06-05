const router = require('express').Router();
const service = require('../services/accountingService');
const { successResponse } = require('../utils/response.util');

router.post('/confirm', async (req, res, next) => {
  try {
    const result = await service.confirmMasterOrderAccounting(
      req.body.masterOrderId,
      req.body.paymentDrafts || [],
      req.body.confirmedBy || req.body.userCode || '',
      { operationId: req.body.operationId }
    );
    return successResponse(res, result, result);
  } catch (e) { next(e); }
});

router.post('/confirm-master-order', async (req, res, next) => {
  try {
    const result = await service.confirmMasterOrderAccounting(
      req.body.masterOrderId,
      req.body.paymentDrafts || [],
      req.body.confirmedBy || req.body.userCode || '',
      { operationId: req.body.operationId }
    );
    return successResponse(res, result, result);
  } catch (e) { next(e); }
});

router.post('/confirm-delivery', async (req, res, next) => {
  try {
    const result = await service.confirmDeliveryAccounting(
      req.body.salesOrderId || req.body.salesOrderCode || req.body.id,
      req.body.confirmedBy || req.body.userCode || '',
      { operationId: req.body.operationId }
    );
    return successResponse(res, result, result);
  } catch (e) { next(e); }
});

module.exports = router;
