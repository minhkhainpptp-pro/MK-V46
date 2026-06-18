'use strict';

const IntegrationInbox = require('../../../models/IntegrationInbox');
const IntegrationOutbox = require('../../../models/IntegrationOutbox');
const S3IntegrationError = require('../../../models/S3IntegrationError');
const S3SyncRun = require('../../../models/S3SyncRun');
const S3InventoryBalance = require('../../../models/S3InventoryBalance');
const SalesOrder = require('../../../models/SalesOrder');
const MasterOrder = require('../../../models/MasterOrder');
const ReturnOrder = require('../../../models/ReturnOrder');
const integrationConfig = require('../../../config/integrationConfig');
const { withMongoTransaction } = require('../../../utils/transaction.util');
const policy = require('./S3ReconciliationPolicy');

function text(value) { return String(value ?? '').trim(); }

function integrationError(message, code, status = 400, details) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  if (details) err.details = details;
  return err;
}

function countMap(rows = []) {
  return Object.fromEntries(rows.map((row) => [text(row._id || 'unknown'), Number(row.count || 0)]));
}

async function getHealth() {
  const [
    outboxGroups,
    inboxGroups,
    oldestPending,
    latestRun,
    masterConflicts,
    orderConflicts,
    latestInventory,
    unresolvedErrors
  ] = await Promise.all([
    IntegrationOutbox.aggregate([
      { $match: { destinationSystem: 'S3' } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    IntegrationInbox.aggregate([
      { $match: { sourceSystem: 'S3' } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    IntegrationOutbox.findOne({
      destinationSystem: 'S3',
      status: { $in: ['pending', 'failed', 'leased'] }
    }).sort({ createdAt: 1 }).select({ createdAt: 1, eventId: 1, status: 1 }).lean(),
    S3SyncRun.findOne({}).sort({ startedAt: -1 }).lean(),
    MasterOrder.countDocuments({ sourceSystem: 'S3', syncConflict: true }),
    SalesOrder.countDocuments({ sourceSystem: 'S3', syncConflict: true }),
    S3InventoryBalance.findOne({ sourceSystem: 'S3' }).sort({ snapshotAt: -1 }).select({ snapshotAt: 1, sourceUpdatedAt: 1 }).lean(),
    S3IntegrationError.countDocuments({ status: { $ne: 'resolved' } })
  ]);

  const outbox = countMap(outboxGroups);
  const inbox = countMap(inboxGroups);
  const oldestPendingAgeSeconds = policy.ageSeconds(oldestPending?.createdAt) || 0;
  const maxPendingAgeSeconds = Math.max(60, Number(process.env.S3_HEALTH_MAX_PENDING_AGE_SECONDS || 600));
  const conflicts = Number(masterConflicts || 0) + Number(orderConflicts || 0);
  const status = policy.healthStatus({
    deadLetters: outbox.dead_letter || 0,
    failed: (outbox.failed || 0) + (inbox.failed || 0) + Number(unresolvedErrors || 0),
    conflicts,
    oldestPendingAgeSeconds,
    maxPendingAgeSeconds
  });

  return {
    status,
    serverTime: new Date().toISOString(),
    mode: integrationConfig.systemMode,
    flags: {
      integrationEnabled: integrationConfig.s3IntegrationEnabled,
      masterOrderSyncEnabled: integrationConfig.s3MasterOrderSyncEnabled,
      returnSyncEnabled: integrationConfig.s3ReturnSyncEnabled,
      returnAutoPostEnabled: integrationConfig.s3ReturnAutoPostEnabled
    },
    outbox,
    inbox,
    queue: {
      oldestEventId: oldestPending?.eventId || '',
      oldestStatus: oldestPending?.status || '',
      oldestPendingAgeSeconds,
      maxPendingAgeSeconds
    },
    conflicts: {
      masterOrders: Number(masterConflicts || 0),
      orders: Number(orderConflicts || 0),
      total: conflicts
    },
    errors: { unresolved: Number(unresolvedErrors || 0) },
    latestSyncRun: latestRun ? {
      runId: latestRun.runId,
      status: latestRun.status,
      syncMode: latestRun.syncMode,
      startedAt: latestRun.startedAt,
      completedAt: latestRun.completedAt,
      publishedAt: latestRun.publishedAt
    } : null,
    inventorySnapshot: latestInventory ? {
      snapshotAt: latestInventory.snapshotAt || latestInventory.sourceUpdatedAt || '',
      ageSeconds: policy.ageSeconds(latestInventory.snapshotAt || latestInventory.sourceUpdatedAt)
    } : null
  };
}

async function listErrors(query = {}) {
  const limit = policy.clampLimit(query.limit);
  const page = policy.clampPage(query.page);
  const filter = {};
  if (text(query.status)) filter.status = text(query.status);
  else filter.status = { $ne: 'resolved' };
  if (text(query.stream)) filter.stream = text(query.stream);
  if (text(query.severity)) filter.severity = text(query.severity);

  const [errors, total, failedOutbox] = await Promise.all([
    S3IntegrationError.find(filter).sort({ lastOccurredAt: -1, createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    S3IntegrationError.countDocuments(filter),
    IntegrationOutbox.find({
      destinationSystem: 'S3',
      status: { $in: ['failed', 'dead_letter'] }
    }).sort({ updatedAt: -1 }).limit(limit).lean()
  ]);

  return { page, limit, total, errors, failedOutbox };
}

async function reconcileMasterOrders(query = {}) {
  const limit = policy.clampLimit(query.limit);
  const page = policy.clampPage(query.page);
  const filter = { sourceSystem: 'S3' };
  if (String(query.conflictsOnly || '').toLowerCase() === 'true') filter.syncConflict = true;
  if (text(query.sourceMasterOrderId)) filter.sourceMasterOrderId = text(query.sourceMasterOrderId);

  const [rows, total] = await Promise.all([
    MasterOrder.find(filter)
      .select({
        id: 1, code: 1, sourceMasterOrderId: 1, sourceVersion: 1, sourceHash: 1,
        sourceUpdatedAt: 1, sourceImportedAt: 1, sourceActive: 1,
        childOrderIds: 1, childOrderCodes: 1, children: 1,
        executionStatus: 1, status: 1, syncConflict: 1, syncConflictReason: 1,
        syncConflictAt: 1, deliveryStaffCode: 1, updatedAt: 1
      })
      .sort({ sourceUpdatedAt: -1, updatedAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    MasterOrder.countDocuments(filter)
  ]);

  const items = rows.map((row) => {
    const childOrderCodes = Array.isArray(row.childOrderCodes) ? row.childOrderCodes : [];
    const children = Array.isArray(row.children) ? row.children : [];
    return {
      ...row,
      reconciliation: {
        childCodeCount: childOrderCodes.length,
        childSnapshotCount: children.length,
        childCountMatched: childOrderCodes.length === children.length,
        requiresReview: Boolean(row.syncConflict) || childOrderCodes.length !== children.length
      }
    };
  });

  return { page, limit, total, items };
}

async function reconcileReturns(query = {}) {
  const limit = policy.clampLimit(query.limit);
  const page = policy.clampPage(query.page);
  const filter = { s3SyncEventId: { $exists: true, $nin: ['', null] } };
  if (text(query.status)) filter.s3SyncStatus = text(query.status);
  if (text(query.returnCode)) filter.$or = [{ code: text(query.returnCode) }, { id: text(query.returnCode) }];

  const [returns, total] = await Promise.all([
    ReturnOrder.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ReturnOrder.countDocuments(filter)
  ]);
  const eventIds = [...new Set(returns.map((row) => text(row.s3SyncEventId)).filter(Boolean))];
  const events = eventIds.length
    ? await IntegrationOutbox.find({ eventId: { $in: eventIds } }).lean()
    : [];
  const eventMap = new Map(events.map((event) => [event.eventId, event]));

  const items = returns.map((row) => {
    const event = eventMap.get(row.s3SyncEventId);
    const receiptCode = text(row.s3ReceiptCode || event?.result?.s3ReceiptCode || event?.result?.s3INNbr);
    const completed = row.s3SyncStatus === 'completed' && event?.status === 'completed' && Boolean(receiptCode);
    return {
      returnOrder: row,
      outbox: event || null,
      reconciliation: {
        receiptCode,
        completed,
        requiresReview: !completed && ['failed', 'dead_letter'].includes(text(event?.status || row.s3SyncStatus))
      }
    };
  });

  return { page, limit, total, items };
}

async function retryReturnCommand(eventIdValue, actor = 'integration-operator') {
  const eventId = text(eventIdValue);
  if (!eventId) throw integrationError('Thiếu eventId', 'S3_RETURN_EVENT_ID_REQUIRED');
  return withMongoTransaction(async (session) => {
    const current = await IntegrationOutbox.findOne({ eventId }).session(session).lean();
    if (!current) throw integrationError('Không tìm thấy command', 'S3_RETURN_COMMAND_NOT_FOUND', 404);
    if (current.eventType !== 'S3_CREATE_RETURN_TK') {
      throw integrationError('Event không phải command trả hàng', 'S3_RETURN_COMMAND_TYPE_INVALID', 409);
    }
    if (current.status === 'completed') {
      throw integrationError('Command đã hoàn thành, không được retry', 'S3_RETURN_COMMAND_ALREADY_COMPLETED', 409);
    }
    const now = new Date().toISOString();
    const updated = await IntegrationOutbox.findOneAndUpdate(
      { eventId, status: { $in: ['failed', 'dead_letter', 'pending'] } },
      {
        $set: {
          status: 'pending', nextAttemptAt: now, leasedBy: '', leaseUntil: '',
          error: null, failedAt: '', deadLetteredAt: '', updatedAt: now,
          result: { ...(current.result || {}), retriedBy: actor, retriedAt: now }
        }
      },
      { new: true, session }
    ).lean();
    if (!updated) throw integrationError('Command đang được xử lý hoặc lease chưa hết', 'S3_RETURN_COMMAND_NOT_RETRYABLE', 409);

    await ReturnOrder.updateOne(
      { s3SyncEventId: eventId },
      { $set: { s3SyncStatus: 'pending', s3SyncError: null, updatedAt: now } },
      { session }
    );
    return updated;
  });
}

function metricsText(health) {
  const lines = [
    '# HELP s3_v45_integration_health Integration health: healthy=0 degraded=1 critical=2',
    '# TYPE s3_v45_integration_health gauge',
    `s3_v45_integration_health ${health.status === 'critical' ? 2 : health.status === 'degraded' ? 1 : 0}`,
    '# TYPE s3_v45_return_queue gauge'
  ];
  for (const [status, count] of Object.entries(health.outbox || {})) {
    lines.push(`s3_v45_return_queue{status="${policy.prometheusEscape(status)}"} ${Number(count || 0)}`);
  }
  lines.push(`s3_v45_return_oldest_age_seconds ${Number(health.queue?.oldestPendingAgeSeconds || 0)}`);
  lines.push(`s3_v45_sync_conflicts_total ${Number(health.conflicts?.total || 0)}`);
  lines.push(`s3_v45_unresolved_errors_total ${Number(health.errors?.unresolved || 0)}`);
  if (health.inventorySnapshot?.ageSeconds != null) {
    lines.push(`s3_v45_inventory_snapshot_age_seconds ${Number(health.inventorySnapshot.ageSeconds)}`);
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  getHealth,
  listErrors,
  reconcileMasterOrders,
  reconcileReturns,
  retryReturnCommand,
  metricsText,
  countMap
};
