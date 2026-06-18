'use strict';

const fullSyncService = require('../services/integration/s3/S3FullSyncService');
const masterOrderSyncService = require('../services/integration/s3/S3MasterOrderSyncService');
const returnCommandService = require('../services/integration/s3/S3ReturnCommandService');
const reconciliationService = require('../services/integration/s3/S3ReconciliationService');

function sendError(res, err, fallback) {
  const status = Number(err?.status || err?.statusCode || 500);
  return res.status(status).json({
    ok: false,
    success: false,
    code: err?.code || 'S3_INTEGRATION_ERROR',
    message: err?.message || fallback,
    details: err?.details
  });
}

async function startSyncRun(req, res) {
  try {
    const run = await fullSyncService.startRun(req.body || {}, req.integrationAgent?.agentId);
    return res.status(201).json({ ok: true, success: true, run });
  } catch (err) {
    return sendError(res, err, 'Không tạo được sync run');
  }
}

async function processBatch(req, res) {
  try {
    const result = await fullSyncService.processBatch(req.params.entityType, req.body || {}, req.integrationAgent?.agentId);
    return res.status(result.duplicate ? 200 : 202).json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không xử lý được sync batch');
  }
}

async function completeSyncRun(req, res) {
  try {
    const run = await fullSyncService.completeRun(req.params.runId, req.body || {});
    return res.json({ ok: true, success: true, run });
  } catch (err) {
    return sendError(res, err, 'Không hoàn tất được sync run');
  }
}

async function getSyncRun(req, res) {
  try {
    const run = await fullSyncService.getRun(req.params.runId);
    return res.json({ ok: true, success: true, run });
  } catch (err) {
    return sendError(res, err, 'Không tải được sync run');
  }
}


async function upsertMasterOrder(req, res) {
  try {
    const result = await masterOrderSyncService.upsertMasterOrder(req.body || {});
    return res.status(result.duplicate ? 200 : 202).json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không đồng bộ được đơn tổng S3');
  }
}

async function claimReturnCommands(req, res) {
  try {
    const result = await returnCommandService.claimCommands(req.body || {}, req.integrationAgent || {});
    return res.json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không claim được return command');
  }
}

async function completeReturnCommand(req, res) {
  try {
    const result = await returnCommandService.completeCommand(req.params.eventId, req.body || {}, req.integrationAgent || {});
    return res.json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không hoàn tất được return command');
  }
}

async function deferReturnCommand(req, res) {
  try {
    const result = await returnCommandService.deferCommand(req.params.eventId, req.body || {}, req.integrationAgent || {});
    return res.json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không hoãn được return command');
  }
}

async function failReturnCommand(req, res) {
  try {
    const result = await returnCommandService.failCommand(req.params.eventId, req.body || {}, req.integrationAgent || {});
    return res.json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không ghi nhận được lỗi return command');
  }
}

async function renewReturnCommandLease(req, res) {
  try {
    const result = await returnCommandService.renewLease(req.params.eventId, req.body || {}, req.integrationAgent || {});
    return res.json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không gia hạn được return command');
  }
}

async function health(req, res) {
  try {
    const result = await reconciliationService.getHealth();
    const statusCode = result.status === 'critical' ? 503 : 200;
    return res.status(statusCode).json({ ok: result.status !== 'critical', success: true, source: 's3-integration', agentId: req.integrationAgent?.agentId, result });
  } catch (err) {
    return sendError(res, err, 'Không tải được sức khỏe tích hợp');
  }
}

async function metrics(req, res) {
  try {
    const healthResult = await reconciliationService.getHealth();
    return res.type('text/plain; version=0.0.4').send(reconciliationService.metricsText(healthResult));
  } catch (err) {
    return sendError(res, err, 'Không tải được metrics tích hợp');
  }
}

async function listErrors(req, res) {
  try {
    const result = await reconciliationService.listErrors(req.query || {});
    return res.json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không tải được lỗi tích hợp');
  }
}

async function reconcileMasterOrders(req, res) {
  try {
    const result = await reconciliationService.reconcileMasterOrders(req.query || {});
    return res.json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không đối soát được đơn tổng');
  }
}

async function reconcileReturns(req, res) {
  try {
    const result = await reconciliationService.reconcileReturns(req.query || {});
    return res.json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không đối soát được hàng trả');
  }
}

async function retryReturnCommand(req, res) {
  try {
    const result = await reconciliationService.retryReturnCommand(req.params.eventId, req.integrationAgent?.agentId);
    return res.json({ ok: true, success: true, result });
  } catch (err) {
    return sendError(res, err, 'Không retry được return command');
  }
}

module.exports = {
  startSyncRun, processBatch, completeSyncRun, getSyncRun, upsertMasterOrder,
  claimReturnCommands, completeReturnCommand, deferReturnCommand, failReturnCommand, renewReturnCommandLease,
  health, metrics, listErrors, reconcileMasterOrders, reconcileReturns, retryReturnCommand
};
