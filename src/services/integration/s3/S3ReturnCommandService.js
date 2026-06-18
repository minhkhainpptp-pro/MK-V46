'use strict';

const IntegrationOutbox = require('../../../models/IntegrationOutbox');
const ReturnOrder = require('../../../models/ReturnOrder');
const integrationConfig = require('../../../config/integrationConfig');
const { withMongoTransaction } = require('../../../utils/transaction.util');
const policy = require('./S3ReturnCommandPolicy');

function text(value) { return String(value ?? '').trim(); }

function integrationError(message, code, status = 400, details) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  if (details) err.details = details;
  return err;
}

function assertEnabled() {
  if (!integrationConfig.s3ReturnSyncEnabled) {
    throw integrationError('Đồng bộ hàng trả sang S3 chưa được bật', 'S3_RETURN_SYNC_DISABLED', 503);
  }
}

function commandView(event = {}) {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateId: event.aggregateId,
    aggregateCode: event.aggregateCode,
    correlationId: event.correlationId,
    payloadHash: event.payloadHash,
    payload: event.payload,
    attemptCount: Number(event.attemptCount || 0),
    leaseUntil: event.leaseUntil,
    leasedBy: event.leasedBy
  };
}

async function claimOne(agentId, now, leaseUntil) {
  return IntegrationOutbox.findOneAndUpdate(
    {
      eventType: 'S3_CREATE_RETURN_TK',
      destinationSystem: 'S3',
      $or: [
        {
          status: { $in: ['pending', 'failed'] },
          nextAttemptAt: { $lte: now }
        },
        {
          status: 'leased',
          leaseUntil: { $lte: now }
        }
      ]
    },
    {
      $set: {
        status: 'leased',
        leasedBy: agentId,
        leaseUntil,
        lastAttemptAt: now,
        updatedAt: now
      },
      $inc: { attemptCount: 1 }
    },
    {
      new: true,
      sort: { createdAt: 1, eventId: 1 }
    }
  ).lean();
}

async function claimCommands(body = {}, agent = {}) {
  assertEnabled();
  const agentId = text(agent.agentId || body.agentId);
  if (!agentId) throw integrationError('Thiếu Agent ID', 'S3_AGENT_ID_REQUIRED', 401);

  const limit = policy.claimLimit(body.limit);
  const seconds = policy.leaseSeconds(body.leaseSeconds);
  const now = new Date().toISOString();
  const leaseUntil = policy.isoAfter(seconds);
  const commands = [];

  for (let index = 0; index < limit; index += 1) {
    const event = await claimOne(agentId, now, leaseUntil);
    if (!event) break;
    commands.push(commandView(event));
  }

  return { commands, claimed: commands.length, leaseSeconds: seconds, serverTime: now };
}

async function getLeasedEvent(eventId, agentId, session) {
  const event = await IntegrationOutbox.findOne({ eventId }).session(session).lean();
  if (!event) throw integrationError('Không tìm thấy return command', 'S3_RETURN_COMMAND_NOT_FOUND', 404);
  if (event.status === 'completed') return event;
  if (event.status !== 'leased' || text(event.leasedBy) !== agentId) {
    throw integrationError('Command không được lease bởi agent hiện tại', 'S3_RETURN_COMMAND_LEASE_MISMATCH', 409, {
      status: event.status,
      leasedBy: event.leasedBy
    });
  }
  return event;
}

async function updateReturnOrder(event, patch, session) {
  const query = event.aggregateId
    ? { $or: [{ s3SyncEventId: event.eventId }, { code: event.aggregateId }, { id: event.aggregateId }] }
    : { s3SyncEventId: event.eventId };
  const result = await ReturnOrder.updateOne(query, { $set: patch }, { session });
  if (!Number(result.matchedCount || 0)) {
    throw integrationError('Không tìm thấy phiếu trả nguồn của command', 'S3_RETURN_ORDER_NOT_FOUND', 409, {
      eventId: event.eventId,
      aggregateId: event.aggregateId
    });
  }
}

async function completeCommand(eventIdValue, body = {}, agent = {}) {
  assertEnabled();
  const eventId = text(eventIdValue);
  const agentId = text(agent.agentId);
  const s3ReceiptCode = text(body.s3ReceiptCode || body.s3INNbr || body.receiptCode);
  const s3ReceiptId = text(body.s3ReceiptId || body.s3INNbr || s3ReceiptCode);
  if (!eventId) throw integrationError('Thiếu eventId', 'S3_RETURN_EVENT_ID_REQUIRED');
  if (!agentId) throw integrationError('Thiếu Agent ID', 'S3_AGENT_ID_REQUIRED', 401);
  if (!s3ReceiptCode) throw integrationError('Thiếu mã phiếu nhập kho S3', 'S3_RECEIPT_CODE_REQUIRED');

  return withMongoTransaction(async (session) => {
    const event = await getLeasedEvent(eventId, agentId, session);
    if (event.status === 'completed') {
      const existingCode = text(event.result?.s3ReceiptCode || event.result?.s3INNbr);
      if (existingCode && existingCode !== s3ReceiptCode) {
        throw integrationError('Command đã hoàn thành với mã phiếu S3 khác', 'S3_RETURN_RECEIPT_CONFLICT', 409, {
          existingCode,
          incomingCode: s3ReceiptCode
        });
      }
      return { event, duplicate: true };
    }

    const now = new Date().toISOString();
    const postedAt = text(body.postedAt) || now;
    const result = {
      s3ReceiptId,
      s3ReceiptCode,
      s3INNbr: s3ReceiptCode,
      postedAt,
      sqlStatus: text(body.sqlStatus || 'posted')
    };

    const updated = await IntegrationOutbox.findOneAndUpdate(
      { eventId, status: 'leased', leasedBy: agentId },
      {
        $set: {
          status: 'completed',
          result,
          error: null,
          completedAt: now,
          updatedAt: now,
          leasedBy: '',
          leaseUntil: ''
        }
      },
      { new: true, session }
    ).lean();
    if (!updated) throw integrationError('Lease command đã thay đổi', 'S3_RETURN_COMMAND_LEASE_LOST', 409);

    await updateReturnOrder(event, {
      s3SyncStatus: 'completed',
      s3SyncAttemptCount: Number(updated.attemptCount || 0),
      s3SyncError: null,
      s3SyncCompletedAt: now,
      s3ReceiptId,
      s3ReceiptCode,
      s3ReceiptDate: text(body.s3ReceiptDate || postedAt.slice(0, 10)),
      s3PostedAt: postedAt,
      updatedAt: now
    }, session);

    return { event: updated, duplicate: false };
  });
}

async function deferCommand(eventIdValue, body = {}, agent = {}) {
  assertEnabled();
  const eventId = text(eventIdValue);
  const agentId = text(agent.agentId);
  const delaySeconds = policy.retryDelaySeconds(1, body.retryAfterSeconds || 300);
  const now = new Date().toISOString();
  const nextAttemptAt = policy.isoAfter(delaySeconds);

  return withMongoTransaction(async (session) => {
    const event = await getLeasedEvent(eventId, agentId, session);
    if (event.status === 'completed') return { event, duplicate: true };

    const result = {
      sqlStatus: text(body.sqlStatus || 'staged'),
      stagedAt: text(body.stagedAt) || now,
      message: text(body.message || 'Yêu cầu đã vào staging, đang chờ S3 post kho')
    };
    const updated = await IntegrationOutbox.findOneAndUpdate(
      { eventId, status: 'leased', leasedBy: agentId },
      {
        $set: {
          status: 'pending',
          nextAttemptAt,
          result,
          error: null,
          updatedAt: now,
          leasedBy: '',
          leaseUntil: ''
        }
      },
      { new: true, session }
    ).lean();
    if (!updated) throw integrationError('Lease command đã thay đổi', 'S3_RETURN_COMMAND_LEASE_LOST', 409);

    await updateReturnOrder(event, {
      s3SyncStatus: 'pending',
      s3SyncAttemptCount: Number(updated.attemptCount || 0),
      s3SyncError: null,
      updatedAt: now
    }, session);

    return { event: updated, duplicate: false, nextAttemptAt };
  });
}

async function failCommand(eventIdValue, body = {}, agent = {}) {
  assertEnabled();
  const eventId = text(eventIdValue);
  const agentId = text(agent.agentId);
  const normalizedError = policy.normalizeError(body);
  const now = new Date().toISOString();

  return withMongoTransaction(async (session) => {
    const event = await getLeasedEvent(eventId, agentId, session);
    if (event.status === 'completed') return { event, duplicate: true };

    const deadLetter = policy.shouldDeadLetter({
      retryable: normalizedError.retryable,
      attemptCount: event.attemptCount,
      configuredMaxAttempts: process.env.S3_RETURN_MAX_ATTEMPTS
    });
    const delaySeconds = policy.retryDelaySeconds(event.attemptCount, body.retryAfterSeconds);
    const nextAttemptAt = deadLetter ? '' : policy.isoAfter(delaySeconds);
    const status = deadLetter ? 'dead_letter' : 'failed';

    const updated = await IntegrationOutbox.findOneAndUpdate(
      { eventId, status: 'leased', leasedBy: agentId },
      {
        $set: {
          status,
          error: normalizedError,
          nextAttemptAt,
          failedAt: now,
          deadLetteredAt: deadLetter ? now : '',
          updatedAt: now,
          leasedBy: '',
          leaseUntil: ''
        }
      },
      { new: true, session }
    ).lean();
    if (!updated) throw integrationError('Lease command đã thay đổi', 'S3_RETURN_COMMAND_LEASE_LOST', 409);

    await updateReturnOrder(event, {
      s3SyncStatus: status,
      s3SyncAttemptCount: Number(updated.attemptCount || 0),
      s3SyncError: normalizedError,
      updatedAt: now
    }, session);

    return { event: updated, duplicate: false, deadLetter, nextAttemptAt };
  });
}

async function renewLease(eventIdValue, body = {}, agent = {}) {
  assertEnabled();
  const eventId = text(eventIdValue);
  const agentId = text(agent.agentId);
  const seconds = policy.leaseSeconds(body.leaseSeconds);
  const now = new Date().toISOString();
  const leaseUntil = policy.isoAfter(seconds);
  const event = await IntegrationOutbox.findOneAndUpdate(
    { eventId, status: 'leased', leasedBy: agentId },
    { $set: { leaseUntil, updatedAt: now } },
    { new: true }
  ).lean();
  if (!event) throw integrationError('Không thể gia hạn lease command', 'S3_RETURN_COMMAND_LEASE_MISMATCH', 409);
  return { event: commandView(event), leaseSeconds: seconds };
}

module.exports = {
  claimCommands,
  completeCommand,
  deferCommand,
  failCommand,
  renewLease,
  commandView
};
