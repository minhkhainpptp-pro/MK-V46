'use strict';

const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { s3IntegrationAuth } = require('../middlewares/s3IntegrationAuth.middleware');
const controller = require('../controllers/s3IntegrationController');

const router = express.Router();

const integrationLimiter = rateLimit({
  windowMs: Number(process.env.S3_INTEGRATION_RATE_WINDOW_MS || 60 * 1000),
  max: Number(process.env.S3_INTEGRATION_RATE_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${String(req.get('x-agent-id') || 'unknown')}:${ipKeyGenerator(req.ip)}`,
  message: {
    ok: false,
    success: false,
    code: 'S3_INTEGRATION_RATE_LIMITED',
    message: 'Bridge gửi quá nhiều yêu cầu'
  }
});

router.use(integrationLimiter, s3IntegrationAuth);

router.get('/health', controller.health);
router.get('/metrics', controller.metrics);
router.get('/errors', controller.listErrors);
router.get('/reconciliation/master-orders', controller.reconcileMasterOrders);
router.get('/reconciliation/returns', controller.reconcileReturns);

router.post('/master-orders/upsert', controller.upsertMasterOrder);
router.post('/return-commands/claim', controller.claimReturnCommands);
router.post('/return-commands/:eventId/complete', controller.completeReturnCommand);
router.post('/return-commands/:eventId/defer', controller.deferReturnCommand);
router.post('/return-commands/:eventId/fail', controller.failReturnCommand);
router.post('/return-commands/:eventId/renew', controller.renewReturnCommandLease);
router.post('/return-commands/:eventId/retry', controller.retryReturnCommand);
router.post('/sync-runs', controller.startSyncRun);
router.get('/sync-runs/:runId', controller.getSyncRun);
router.post('/sync-runs/:runId/complete', controller.completeSyncRun);
router.post('/:entityType(products|customers|users|inventory|orders)/batch', controller.processBatch);

module.exports = router;
