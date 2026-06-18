'use strict';

const MasterOrder = require('../../../models/MasterOrder');
const SalesOrder = require('../../../models/SalesOrder');
const IntegrationInbox = require('../../../models/IntegrationInbox');
const integrationConfig = require('../../../config/integrationConfig');
const { withMongoTransaction } = require('../../../utils/transaction.util');
const { sourceHash } = require('./S3FullSyncService');

const PROTECTED_EXECUTION_STATES = new Set([
  'delivering', 'in_progress', 'partially_delivered', 'delivered',
  'completed', 'failed_delivery', 'return_pending', 'returned'
]);

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

function isProtectedExecutionState(value) {
  return PROTECTED_EXECUTION_STATES.has(text(value).toLowerCase());
}

function validatePayload(body = {}) {
  if (!integrationConfig.s3MasterOrderSyncEnabled) {
    throw integrationError('Đồng bộ đơn tổng S3 chưa được bật', 'S3_MASTER_ORDER_SYNC_DISABLED', 503);
  }
  const eventId = text(body.eventId);
  const sourceMasterOrderId = text(body.sourceMasterOrderId || body.sourceMasterOrderCode);
  const sourceMasterOrderCode = text(body.sourceMasterOrderCode || sourceMasterOrderId);
  const orders = Array.isArray(body.orders) ? body.orders : [];
  if (!eventId) throw integrationError('Thiếu eventId đơn tổng', 'S3_MASTER_EVENT_ID_REQUIRED');
  if (!sourceMasterOrderId) throw integrationError('Thiếu mã đơn tổng S3', 'S3_MASTER_ID_REQUIRED');
  if (!orders.length) throw integrationError('Đơn tổng S3 không có đơn con', 'S3_MASTER_CHILDREN_REQUIRED');
  const seen = new Set();
  for (const order of orders) {
    const id = text(order.sourceOrderId || order.code || order.orderCode);
    if (!id) throw integrationError('Đơn con S3 thiếu mã', 'S3_CHILD_ORDER_ID_REQUIRED');
    if (seen.has(id)) throw integrationError(`Đơn con bị lặp trong payload: ${id}`, 'S3_CHILD_ORDER_DUPLICATE');
    seen.add(id);
  }
  return { eventId, sourceMasterOrderId, sourceMasterOrderCode, orders };
}

function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    productCode: text(item.productCode || item.code || item.invtId || item.InvtID),
    productName: text(item.productName || item.name || item.description),
    quantity: number(item.quantityBaseUnit ?? item.quantity ?? item.qty),
    quantityBaseUnit: number(item.quantityBaseUnit ?? item.quantity ?? item.qty),
    salePrice: Math.max(0, number(item.salePrice || item.price)),
    amount: Math.max(0, number(item.amount))
  })).filter((item) => item.productCode && item.quantityBaseUnit >= 0);
}

function childSourcePatch(order, master, now) {
  const sourceOrderId = text(order.sourceOrderId || order.code || order.orderCode);
  const code = text(order.code || order.orderCode || sourceOrderId);
  const items = normalizeItems(order.items);
  const totalAmount = number(order.totalAmount || order.amount);
  const payloadForHash = {
    sourceOrderId,
    code,
    customerCode: text(order.customerCode),
    deliveryDate: text(order.deliveryDate || master.deliveryDate),
    items,
    totalAmount,
    sourceStatus: text(order.sourceStatus || order.status)
  };
  return {
    id: code,
    code,
    orderCode: code,
    documentCode: text(order.documentCode || code),
    orderDate: text(order.orderDate || order.date),
    deliveryDate: text(order.deliveryDate || master.deliveryDate),
    customerId: text(order.customerId || order.customerCode),
    customerCode: text(order.customerCode),
    customerName: text(order.customerName),
    customerPhone: text(order.customerPhone || order.phone),
    salesStaffId: text(order.salesStaffId || order.salesStaffCode),
    salesStaffCode: text(order.salesStaffCode),
    salesStaffName: text(order.salesStaffName),
    deliveryStaffId: text(master.deliveryStaff?.id || master.deliveryStaffId || master.deliveryStaff?.code),
    deliveryStaffCode: text(master.deliveryStaff?.code || master.deliveryStaffCode),
    deliveryStaffName: text(master.deliveryStaff?.name || master.deliveryStaffName),
    source: 'S3',
    orderSource: 'S3',
    sourceSystem: 'S3',
    sourceOrderId,
    sourceMasterOrderId: text(master.sourceMasterOrderId),
    sourceVersion: text(order.sourceVersion || order.version || master.sourceVersion),
    sourceHash: text(order.sourceHash) || sourceHash(payloadForHash),
    sourceUpdatedAt: text(order.sourceUpdatedAt || order.updatedAt || master.sourceUpdatedAt),
    sourceImportedAt: now,
    sourceActive: true,
    sourceReadOnly: true,
    status: text(order.status || 'assigned'),
    lifecycleStatus: text(order.lifecycleStatus || 'assigned'),
    deliveryStatus: text(order.deliveryStatus || 'pending'),
    mergeStatus: 'merged',
    masterOrderId: text(master.sourceMasterOrderId),
    masterOrderCode: text(master.sourceMasterOrderCode),
    items,
    totalAmount,
    amount: totalAmount,
    note: text(order.note),
    updatedAt: now,
    stockPosted: false
  };
}

function masterSourcePatch(body, sourceMasterOrderId, sourceMasterOrderCode, children, now) {
  const totalAmount = children.reduce((sum, child) => sum + number(child.totalAmount), 0);
  const childOrderIds = children.map((child) => child.id);
  const childOrderCodes = children.map((child) => child.code);
  const compactChildren = children.map((child) => ({
    id: child.id,
    code: child.code,
    sourceOrderId: child.sourceOrderId,
    customerCode: child.customerCode,
    customerName: child.customerName,
    totalAmount: child.totalAmount
  }));
  const payloadForHash = {
    sourceMasterOrderId,
    sourceMasterOrderCode,
    deliveryDate: text(body.deliveryDate),
    deliveryStaffCode: text(body.deliveryStaff?.code || body.deliveryStaffCode),
    childOrderCodes,
    totalAmount
  };
  return {
    id: sourceMasterOrderId,
    code: sourceMasterOrderCode,
    sourceSystem: 'S3',
    sourceMasterOrderId,
    sourceVersion: text(body.sourceVersion || body.version),
    sourceHash: text(body.sourceHash) || sourceHash(payloadForHash),
    sourceUpdatedAt: text(body.sourceUpdatedAt || body.updatedAt),
    sourceImportedAt: now,
    sourceActive: true,
    sourceReadOnly: true,
    childOrderIds,
    childOrderCodes,
    children: compactChildren,
    deliveryStaffId: text(body.deliveryStaff?.id || body.deliveryStaffId || body.deliveryStaff?.code),
    deliveryStaffCode: text(body.deliveryStaff?.code || body.deliveryStaffCode),
    deliveryStaffName: text(body.deliveryStaff?.name || body.deliveryStaffName),
    masterOrderDate: text(body.masterOrderDate || body.orderDate || body.date),
    deliveryDate: text(body.deliveryDate),
    routeName: text(body.routeName),
    note: text(body.note),
    deliveryNote: text(body.deliveryNote || body.note),
    status: text(body.status || 'assigned'),
    totalAmount,
    updatedAt: now
  };
}

async function applyChild(order, body, session, now) {
  const sourceOrderId = text(order.sourceOrderId || order.code || order.orderCode);
  const current = await SalesOrder.findOne({ sourceSystem: 'S3', sourceOrderId }).session(session).lean();
  const patch = childSourcePatch(order, body, now);
  if (current && current.sourceHash !== patch.sourceHash && isProtectedExecutionState(current.executionStatus || current.deliveryStatus)) {
    await SalesOrder.updateOne(
      { _id: current._id },
      {
        $set: {
          syncConflict: true,
          syncConflictReason: 'S3_SOURCE_CHANGED_AFTER_EXECUTION_STARTED',
          syncConflictAt: now,
          pendingSourceHash: patch.sourceHash,
          pendingSourcePayload: patch,
          sourceUpdatedAt: patch.sourceUpdatedAt,
          updatedAt: now
        }
      },
      { session }
    );
    return { ...current, conflict: true };
  }

  const updated = await SalesOrder.findOneAndUpdate(
    { sourceSystem: 'S3', sourceOrderId },
    {
      $set: { ...patch, syncConflict: false, syncConflictReason: '', syncConflictAt: '', pendingSourceHash: '', pendingSourcePayload: null },
      $setOnInsert: { createdAt: now, executionStatus: 'pending', executionVersion: 0 }
    },
    { new: true, upsert: true, session }
  ).lean();
  return { ...updated, conflict: false };
}

async function applyMaster(body, sourceMasterOrderId, sourceMasterOrderCode, children, session, now) {
  const current = await MasterOrder.findOne({ sourceSystem: 'S3', sourceMasterOrderId }).session(session).lean();
  const patch = masterSourcePatch(body, sourceMasterOrderId, sourceMasterOrderCode, children, now);
  const childConflict = children.some((child) => child.conflict);
  if (current && current.sourceHash !== patch.sourceHash && isProtectedExecutionState(current.executionStatus || current.status)) {
    await MasterOrder.updateOne(
      { _id: current._id },
      {
        $set: {
          syncConflict: true,
          syncConflictReason: 'S3_MASTER_CHANGED_AFTER_EXECUTION_STARTED',
          syncConflictAt: now,
          pendingSourceHash: patch.sourceHash,
          pendingSourcePayload: patch,
          sourceUpdatedAt: patch.sourceUpdatedAt,
          updatedAt: now
        }
      },
      { session }
    );
    return { ...current, conflict: true, childConflict };
  }

  const updated = await MasterOrder.findOneAndUpdate(
    { sourceSystem: 'S3', sourceMasterOrderId },
    {
      $set: {
        ...patch,
        syncConflict: childConflict,
        syncConflictReason: childConflict ? 'ONE_OR_MORE_CHILDREN_CONFLICT' : '',
        syncConflictAt: childConflict ? now : '',
        pendingSourceHash: '',
        pendingSourcePayload: null
      },
      $setOnInsert: { createdAt: now, executionStatus: 'pending', executionVersion: 0 }
    },
    { new: true, upsert: true, session }
  ).lean();
  return { ...updated, conflict: childConflict, childConflict };
}

async function upsertMasterOrder(body = {}) {
  const validated = validatePayload(body);
  const existingInbox = await IntegrationInbox.findOne({ eventId: validated.eventId }).lean();
  if (existingInbox?.status === 'completed') return { ...existingInbox.result, duplicate: true };

  try {
    return await withMongoTransaction(async (session) => {
      const now = new Date().toISOString();
      await IntegrationInbox.create([{
        eventId: validated.eventId,
        eventType: 'S3_MASTER_ORDER_UPSERT',
        sourceSystem: 'S3',
        sourceEntityType: 'master_order',
        sourceEntityId: validated.sourceMasterOrderId,
        sourceVersion: text(body.sourceVersion),
        payloadHash: text(body.sourceHash) || sourceHash(body),
        payload: body,
        status: 'processing',
        attemptCount: 1,
        receivedAt: now,
        processingStartedAt: now,
        correlationId: text(body.correlationId || validated.eventId),
        createdAt: now,
        updatedAt: now
      }], { session });

      const masterContext = {
        ...body,
        sourceMasterOrderId: validated.sourceMasterOrderId,
        sourceMasterOrderCode: validated.sourceMasterOrderCode
      };
      const children = [];
      for (const order of validated.orders) {
        children.push(await applyChild(order, masterContext, session, now));
      }
      const masterOrder = await applyMaster(
        body,
        validated.sourceMasterOrderId,
        validated.sourceMasterOrderCode,
        children,
        session,
        now
      );
      const result = {
        eventId: validated.eventId,
        sourceMasterOrderId: validated.sourceMasterOrderId,
        masterOrderId: masterOrder.id,
        masterOrderCode: masterOrder.code,
        childCount: children.length,
        conflictCount: children.filter((child) => child.conflict).length + (masterOrder.conflict ? 1 : 0),
        conflict: Boolean(masterOrder.conflict || children.some((child) => child.conflict)),
        duplicate: false
      };
      await IntegrationInbox.updateOne(
        { eventId: validated.eventId },
        { $set: { status: 'completed', result, completedAt: now, updatedAt: now } },
        { session }
      );
      return result;
    });
  } catch (err) {
    if (err?.code === 11000) {
      const duplicate = await IntegrationInbox.findOne({ eventId: validated.eventId }).lean();
      if (duplicate?.status === 'completed') return { ...duplicate.result, duplicate: true };
      throw integrationError('Event đơn tổng đang được xử lý', 'S3_MASTER_EVENT_CONFLICT', 409);
    }
    throw err;
  }
}

module.exports = {
  PROTECTED_EXECUTION_STATES,
  isProtectedExecutionState,
  childSourcePatch,
  masterSourcePatch,
  upsertMasterOrder
};
