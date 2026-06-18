'use strict';

const IntegrationOutbox = require('../../../models/IntegrationOutbox');
const ReturnStateMachine = require('../../../domain/lifecycle/ReturnStateMachine');
const integrationConfig = require('../../../config/integrationConfig');
const { sourceHash } = require('./S3FullSyncService');

const { RETURN_STATES } = ReturnStateMachine;

function text(value) { return String(value ?? '').trim(); }
function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integrationError(message, code, status = 400, details) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  if (details) err.details = details;
  return err;
}

function returnIdentity(returnOrder = {}) {
  return text(returnOrder.code || returnOrder.id);
}

function eventIdFor(returnOrder = {}) {
  const identity = returnIdentity(returnOrder);
  if (!identity) throw integrationError('Phiếu trả thiếu mã', 'S3_RETURN_ID_REQUIRED');
  return `V45:RETURN:${identity}`;
}

function normalizeReturnItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    productCode: text(item.productCode || item.code || item.productId),
    baseQuantity: number(
      item.returnQty
      ?? item.qtyReturn
      ?? item.returnQuantity
      ?? item.returnedQty
      ?? item.quantityBaseUnit
      ?? item.quantity
      ?? item.qty
    ),
    reason: text(item.reason),
    sourceLineId: text(item.sourceLineId || item.lineId || item.id)
  })).filter((item) => item.productCode && item.baseQuantity > 0);
}

function buildReturnCommandPayload(returnOrder = {}) {
  if (!integrationConfig.s3ReturnSyncEnabled) {
    throw integrationError('Đồng bộ hàng trả sang S3 chưa được bật', 'S3_RETURN_SYNC_DISABLED', 503);
  }
  const sourceReturnId = returnIdentity(returnOrder);
  const siteId = text(
    returnOrder.s3SiteId
    || returnOrder.siteId
    || returnOrder.warehouseCode
    || process.env.S3_RETURN_DEFAULT_SITE_ID
  );
  if (!siteId) {
    throw integrationError('Chưa cấu hình kho nhận hàng trả trên S3', 'S3_RETURN_SITE_REQUIRED', 409);
  }
  const customerCode = text(returnOrder.customerCode);
  if (!customerCode) throw integrationError('Phiếu trả thiếu mã khách hàng', 'S3_RETURN_CUSTOMER_REQUIRED');
  const sourceOrderCode = text(returnOrder.salesOrderCode || returnOrder.orderCode || returnOrder.sourceOrderCode);
  if (!sourceOrderCode) throw integrationError('Phiếu trả thiếu mã đơn gốc S3', 'S3_RETURN_SOURCE_ORDER_REQUIRED');
  const items = normalizeReturnItems(returnOrder.items);
  if (!items.length) throw integrationError('Phiếu trả không có số lượng hợp lệ', 'S3_RETURN_ITEMS_REQUIRED');

  return {
    sourceSystem: 'V45',
    sourceReturnId,
    sourceOrderCode,
    customerCode,
    siteId,
    returnDate: text(returnOrder.returnDate || returnOrder.documentDate || returnOrder.date || returnOrder.deliveryDate),
    confirmedAt: text(returnOrder.accountingConfirmedAt || new Date().toISOString()),
    note: text(returnOrder.accountingNote || returnOrder.note),
    items
  };
}

async function createReturnCommand(returnOrder = {}, options = {}) {
  const session = options.session;
  const eventId = eventIdFor(returnOrder);
  const payload = buildReturnCommandPayload(returnOrder);
  const payloadHash = sourceHash(payload);
  const now = new Date().toISOString();

  const existing = await IntegrationOutbox.findOne({ eventId }).session(session || null).lean();
  if (existing) {
    if (existing.payloadHash && existing.payloadHash !== payloadHash) {
      throw integrationError('Phiếu trả đã tạo command với nội dung khác', 'S3_RETURN_COMMAND_PAYLOAD_CONFLICT', 409, {
        eventId,
        existingPayloadHash: existing.payloadHash,
        incomingPayloadHash: payloadHash
      });
    }
    return { event: existing, duplicate: true };
  }

  const event = await IntegrationOutbox.findOneAndUpdate(
    { eventId },
    {
      $setOnInsert: {
        eventId,
        eventType: 'S3_CREATE_RETURN_TK',
        destinationSystem: 'S3',
        aggregateType: 'ReturnOrder',
        aggregateId: payload.sourceReturnId,
        aggregateCode: payload.sourceReturnId,
        payloadHash,
        payload,
        status: 'pending',
        attemptCount: 0,
        nextAttemptAt: now,
        leasedBy: '',
        leaseUntil: '',
        correlationId: text(options.correlationId || eventId),
        createdAt: now,
        updatedAt: now
      }
    },
    { new: true, upsert: true, session }
  ).lean();

  return { event, duplicate: false };
}

function accountingConfirmedPatch(current = {}, body = {}, event = {}) {
  const now = new Date().toISOString();
  return {
    ...current,
    ...ReturnStateMachine.patchForState(current, RETURN_STATES.ACCOUNTING_CONFIRMED),
    returnState: RETURN_STATES.ACCOUNTING_CONFIRMED,
    accountingConfirmedBy: body.confirmedBy || body.user || 'system',
    accountingNote: body.note || current.accountingNote || '',
    stateChangedAt: now,
    updatedAt: now,
    stockPosted: false,
    stockPostedAt: '',
    arPosted: false,
    arPostedAt: '',
    s3SyncStatus: event.status === 'completed' ? 'completed' : 'pending',
    s3SyncEventId: event.eventId,
    s3SyncAttemptCount: Number(event.attemptCount || 0),
    s3SyncRequestedAt: current.s3SyncRequestedAt || now,
    s3SyncError: null
  };
}

module.exports = {
  eventIdFor,
  normalizeReturnItems,
  buildReturnCommandPayload,
  createReturnCommand,
  accountingConfirmedPatch
};
