'use strict';

const crypto = require('crypto');
const Product = require('../../../models/Product');
const Customer = require('../../../models/Customer');
const User = require('../../../models/User');
const SalesOrder = require('../../../models/SalesOrder');
const S3InventoryBalance = require('../../../models/S3InventoryBalance');
const S3SyncRun = require('../../../models/S3SyncRun');
const IntegrationInbox = require('../../../models/IntegrationInbox');

const ENTITY_TYPES = Object.freeze(['products', 'customers', 'users', 'inventory', 'orders']);
const USER_ROLES = new Set(['admin', 'manager', 'sales', 'warehouse', 'accountant', 'delivery']);

function text(value) {
  return String(value ?? '').trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return !['0', 'false', 'inactive', 'no'].includes(text(value).toLowerCase());
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function sourceHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function integrationError(message, code, status = 400, details) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  if (details) err.details = details;
  return err;
}

function commonSource(record, runId) {
  return {
    sourceSystem: 'S3',
    sourceId: text(record.sourceId || record.id || record.code),
    sourceVersion: text(record.sourceVersion || record.version || ''),
    sourceUpdatedAt: text(record.sourceUpdatedAt || record.updatedAt || ''),
    sourceHash: text(record.sourceHash) || sourceHash(record),
    sourceSyncRunId: runId,
    sourceActive: true,
    sourceReadOnly: true
  };
}

function productOperation(record, runId) {
  const code = text(record.code || record.productCode || record.invtId || record.InvtID);
  if (!code) throw integrationError('Sản phẩm S3 thiếu mã', 'S3_PRODUCT_CODE_REQUIRED');
  const update = {
    code,
    name: text(record.name || record.productName || record.description),
    unit: text(record.unit || record.saleUnit || 'Thùng'),
    baseUnit: text(record.baseUnit || record.stockUnit || ''),
    conversionRate: Math.max(1, number(record.conversionRate || record.caseQty || record.invtCaseQty, 1)),
    packing: text(record.packing),
    barcode: text(record.barcode),
    category: text(record.category),
    brand: text(record.brand),
    costPrice: Math.max(0, number(record.costPrice)),
    salePrice: Math.max(0, number(record.salePrice || record.price)),
    isActive: bool(record.isActive ?? record.active, true),
    ...commonSource({ ...record, id: record.sourceId || code }, runId)
  };
  return { updateOne: { filter: { code }, update: { $set: update }, upsert: true } };
}

function customerOperation(record, runId) {
  const code = text(record.code || record.customerCode || record.custId || record.CustID);
  if (!code) throw integrationError('Khách hàng S3 thiếu mã', 'S3_CUSTOMER_CODE_REQUIRED');
  const update = {
    code,
    name: text(record.name || record.customerName),
    businessName: text(record.businessName),
    phone: text(record.phone),
    address: text(record.address),
    taxCode: text(record.taxCode),
    taxInvoiceAddress: text(record.taxInvoiceAddress),
    area: text(record.area),
    route: text(record.route),
    staffCode: text(record.salesStaffCode || record.staffCode),
    staffName: text(record.salesStaffName || record.staffName),
    openingDebt: number(record.openingDebt),
    debtLimit: number(record.debtLimit),
    isActive: bool(record.isActive ?? record.active, true),
    ...commonSource({ ...record, id: record.sourceId || code }, runId)
  };
  return { updateOne: { filter: { code }, update: { $set: update }, upsert: true } };
}

function normalizeRole(record) {
  const role = text(record.role || record.staffType || 'sales').toLowerCase();
  return USER_ROLES.has(role) ? role : 'sales';
}

function userOperation(record, runId) {
  const staffCode = text(record.staffCode || record.code || record.employeeCode);
  if (!staffCode) throw integrationError('Nhân viên S3 thiếu mã', 'S3_STAFF_CODE_REQUIRED');
  const fullName = text(record.fullName || record.name || record.staffName);
  const source = commonSource({ ...record, id: record.sourceId || staffCode }, runId);
  const generatedUsername = `s3_${staffCode}`.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return {
    updateOne: {
      filter: { staffCode },
      update: {
        $set: {
          staffCode,
          code: staffCode,
          fullName,
          name: fullName,
          phone: text(record.phone),
          role: normalizeRole(record),
          isActive: bool(record.isActive ?? record.active, true),
          ...source
        },
        $setOnInsert: {
          username: generatedUsername,
          // Source sync never imports S3 passwords. Admin must explicitly provision V45 login.
          password: `!S3_DISABLED_${crypto.randomBytes(24).toString('hex')}`
        }
      },
      upsert: true
    }
  };
}

function inventoryOperation(record, runId) {
  const productCode = text(record.productCode || record.code || record.invtId || record.InvtID);
  const siteId = text(record.siteId || record.warehouseCode || record.SiteID || 'MAIN');
  if (!productCode) throw integrationError('Tồn S3 thiếu mã sản phẩm', 'S3_INVENTORY_PRODUCT_REQUIRED');
  const conversionRate = Math.max(1, number(record.conversionRate || record.invtCaseQty, 1));
  const quantityBaseUnit = number(record.quantityBaseUnit ?? record.quantity ?? record.qty);
  return {
    updateOne: {
      filter: { productCode, siteId },
      update: {
        $set: {
          productCode,
          productName: text(record.productName || record.name),
          siteId,
          warehouseCode: siteId,
          quantityBaseUnit,
          caseQuantity: number(record.caseQuantity, Math.floor(quantityBaseUnit / conversionRate)),
          unitQuantity: number(record.unitQuantity, quantityBaseUnit % conversionRate),
          conversionRate,
          snapshotAt: text(record.snapshotAt || record.sourceUpdatedAt || new Date().toISOString()),
          syncRunId: runId,
          sourceSystem: 'S3',
          sourceVersion: text(record.sourceVersion || record.version),
          sourceUpdatedAt: text(record.sourceUpdatedAt || record.updatedAt),
          active: true,
          readOnly: true
        }
      },
      upsert: true
    }
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    productCode: text(item.productCode || item.code || item.invtId || item.InvtID),
    productName: text(item.productName || item.name || item.description),
    quantity: number(item.quantityBaseUnit ?? item.quantity ?? item.qty),
    quantityBaseUnit: number(item.quantityBaseUnit ?? item.quantity ?? item.qty),
    salePrice: Math.max(0, number(item.salePrice || item.price)),
    amount: Math.max(0, number(item.amount))
  })).filter((item) => item.productCode && item.quantityBaseUnit >= 0);
}

function orderOperation(record, runId) {
  const sourceOrderId = text(record.sourceOrderId || record.id || record.code || record.orderCode);
  const code = text(record.code || record.orderCode || sourceOrderId);
  if (!sourceOrderId || !code) throw integrationError('Đơn S3 thiếu mã nguồn', 'S3_ORDER_ID_REQUIRED');
  const sourcePayload = {
    code,
    customerCode: text(record.customerCode),
    items: normalizeItems(record.items),
    totalAmount: number(record.totalAmount || record.amount),
    sourceStatus: text(record.sourceStatus || record.status)
  };
  const now = new Date().toISOString();
  const update = {
    id: code,
    code,
    orderCode: code,
    documentCode: text(record.documentCode || code),
    orderDate: text(record.orderDate || record.date),
    deliveryDate: text(record.deliveryDate),
    customerId: text(record.customerId || record.customerCode),
    customerCode: text(record.customerCode),
    customerName: text(record.customerName),
    customerPhone: text(record.customerPhone || record.phone),
    salesStaffId: text(record.salesStaffId || record.salesStaffCode),
    salesStaffCode: text(record.salesStaffCode),
    salesStaffName: text(record.salesStaffName),
    source: 'S3',
    orderSource: 'S3',
    sourceSystem: 'S3',
    sourceOrderId,
    sourceMasterOrderId: text(record.sourceMasterOrderId),
    sourceVersion: text(record.sourceVersion || record.version),
    sourceHash: text(record.sourceHash) || sourceHash(sourcePayload),
    sourceUpdatedAt: text(record.sourceUpdatedAt || record.updatedAt),
    sourceImportedAt: now,
    sourceSyncRunId: runId,
    sourceActive: true,
    sourceReadOnly: true,
    status: text(record.status || 'pending'),
    lifecycleStatus: text(record.lifecycleStatus || record.status || 'pending'),
    deliveryStatus: text(record.deliveryStatus || 'pending'),
    mergeStatus: text(record.mergeStatus || 'unmerged'),
    items: sourcePayload.items,
    totalAmount: sourcePayload.totalAmount,
    amount: sourcePayload.totalAmount,
    note: text(record.note),
    updatedAt: now,
    stockPosted: false
  };
  return {
    updateOne: {
      filter: { sourceSystem: 'S3', sourceOrderId },
      update: {
        $set: update,
        $setOnInsert: {
          createdAt: now,
          executionStatus: 'pending',
          executionVersion: 0,
          syncConflict: false
        }
      },
      upsert: true
    }
  };
}

const ADAPTERS = {
  products: { Model: Product, operation: productOperation },
  customers: { Model: Customer, operation: customerOperation },
  users: { Model: User, operation: userOperation },
  inventory: { Model: S3InventoryBalance, operation: inventoryOperation },
  orders: { Model: SalesOrder, operation: orderOperation }
};

function validateBatch(body = {}) {
  const runId = text(body.runId);
  const eventId = text(body.eventId);
  const batchNo = Number(body.batchNo);
  const records = body.records;
  const maxBatch = Math.max(1, Number(process.env.S3_SYNC_MAX_BATCH_SIZE || 1000));
  if (!runId) throw integrationError('Thiếu runId', 'S3_SYNC_RUN_ID_REQUIRED');
  if (!eventId) throw integrationError('Thiếu eventId', 'S3_SYNC_EVENT_ID_REQUIRED');
  if (!Number.isInteger(batchNo) || batchNo < 1) throw integrationError('batchNo không hợp lệ', 'S3_SYNC_BATCH_NO_INVALID');
  if (!Array.isArray(records)) throw integrationError('records phải là mảng', 'S3_SYNC_RECORDS_INVALID');
  if (records.length > maxBatch) throw integrationError(`Batch vượt quá ${maxBatch} bản ghi`, 'S3_SYNC_BATCH_TOO_LARGE', 413);
  return { runId, eventId, batchNo, records };
}

async function startRun(input = {}, agentId = '') {
  const runId = text(input.runId);
  const syncMode = text(input.syncMode || 'FULL').toUpperCase();
  if (!runId) throw integrationError('Thiếu runId', 'S3_SYNC_RUN_ID_REQUIRED');
  if (!['FULL', 'INCREMENTAL'].includes(syncMode)) throw integrationError('syncMode không hợp lệ', 'S3_SYNC_MODE_INVALID');
  const entityTypes = Array.isArray(input.entityTypes) ? input.entityTypes.map(text).filter((value) => ENTITY_TYPES.includes(value)) : ENTITY_TYPES;
  const now = new Date().toISOString();
  const run = await S3SyncRun.findOneAndUpdate(
    { runId },
    {
      $setOnInsert: {
        runId,
        syncMode,
        entityTypes,
        status: 'running',
        startedAt: now,
        sourceSnapshotAt: text(input.sourceSnapshotAt),
        expectedCounts: input.expectedCounts || {},
        processedCounts: {},
        rejectedCounts: {},
        createdByAgent: agentId,
        createdAt: now,
        updatedAt: now
      }
    },
    { new: true, upsert: true }
  ).lean();
  return run;
}

async function processBatch(entityType, body = {}, agentId = '') {
  if (!ENTITY_TYPES.includes(entityType)) throw integrationError('Loại dữ liệu sync không hỗ trợ', 'S3_SYNC_ENTITY_UNSUPPORTED');
  const { runId, eventId, batchNo, records } = validateBatch(body);
  const run = await S3SyncRun.findOne({ runId }).lean();
  if (!run) throw integrationError('Không tìm thấy sync run', 'S3_SYNC_RUN_NOT_FOUND', 404);
  if (run.status !== 'running') throw integrationError('Sync run không còn ở trạng thái running', 'S3_SYNC_RUN_NOT_RUNNING', 409);

  const receivedAt = new Date().toISOString();
  try {
    await IntegrationInbox.create({
      eventId,
      eventType: `S3_SYNC_${entityType.toUpperCase()}_BATCH`,
      sourceSystem: 'S3',
      sourceEntityType: entityType,
      sourceEntityId: `${runId}:${batchNo}`,
      sourceVersion: text(body.sourceVersion),
      payloadHash: text(body.payloadHash) || sourceHash(records),
      status: 'processing',
      attemptCount: 1,
      receivedAt,
      processingStartedAt: receivedAt,
      correlationId: text(body.correlationId || eventId),
      createdAt: receivedAt,
      updatedAt: receivedAt
    });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    const existing = await IntegrationInbox.findOne({ eventId }).lean();
    if (existing?.status === 'completed') return { ...existing.result, duplicate: true };
    throw integrationError('Batch event đang được xử lý hoặc đã lỗi', 'S3_SYNC_EVENT_CONFLICT', 409);
  }

  try {
    const adapter = ADAPTERS[entityType];
    const operations = records.map((record) => adapter.operation(record || {}, runId));
    const writeResult = operations.length
      ? await adapter.Model.bulkWrite(operations, { ordered: true })
      : { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    const result = {
      runId,
      eventId,
      entityType,
      batchNo,
      received: records.length,
      matched: Number(writeResult.matchedCount || 0),
      modified: Number(writeResult.modifiedCount || 0),
      upserted: Number(writeResult.upsertedCount || 0),
      duplicate: false
    };
    const completedAt = new Date().toISOString();
    await Promise.all([
      IntegrationInbox.updateOne({ eventId }, { $set: { status: 'completed', result, completedAt, updatedAt: completedAt } }),
      S3SyncRun.updateOne({ runId }, {
        $inc: { [`processedCounts.${entityType}`]: records.length },
        $set: { updatedAt: completedAt }
      })
    ]);
    return result;
  } catch (err) {
    const failedAt = new Date().toISOString();
    await Promise.allSettled([
      IntegrationInbox.updateOne({ eventId }, {
        $set: {
          status: 'failed',
          error: { code: err.code || 'S3_SYNC_BATCH_FAILED', message: err.message },
          failedAt,
          updatedAt: failedAt
        }
      }),
      S3SyncRun.updateOne({ runId }, {
        $inc: { [`rejectedCounts.${entityType}`]: records.length },
        $set: { updatedAt: failedAt }
      })
    ]);
    throw err;
  }
}

async function deactivateMissing(entityType, runId) {
  const now = new Date().toISOString();
  if (entityType === 'inventory') {
    return S3InventoryBalance.updateMany({ sourceSystem: 'S3', syncRunId: { $ne: runId }, active: true }, { $set: { active: false, updatedAt: now } });
  }
  const adapter = ADAPTERS[entityType];
  if (!adapter) return null;
  return adapter.Model.updateMany(
    { sourceSystem: 'S3', sourceSyncRunId: { $ne: runId }, sourceActive: true },
    { $set: { sourceActive: false, updatedAt: now } }
  );
}

async function completeRun(runIdValue, input = {}) {
  const runId = text(runIdValue);
  const run = await S3SyncRun.findOne({ runId }).lean();
  if (!run) throw integrationError('Không tìm thấy sync run', 'S3_SYNC_RUN_NOT_FOUND', 404);
  if (run.status === 'completed') return { ...run, duplicate: true };
  if (run.status !== 'running') throw integrationError('Sync run không thể hoàn tất', 'S3_SYNC_RUN_NOT_RUNNING', 409);

  const expected = { ...(run.expectedCounts || {}), ...(input.expectedCounts || {}) };
  const processed = run.processedCounts || {};
  const mismatches = Object.entries(expected).filter(([entityType, expectedCount]) => {
    return ENTITY_TYPES.includes(entityType) && Number(expectedCount) !== Number(processed[entityType] || 0);
  }).map(([entityType, expectedCount]) => ({ entityType, expected: Number(expectedCount), processed: Number(processed[entityType] || 0) }));
  if (mismatches.length) {
    throw integrationError('Số lượng full sync không khớp, từ chối publish', 'S3_SYNC_COUNT_MISMATCH', 409, mismatches);
  }

  if (run.syncMode === 'FULL' && input.deactivateMissing !== false) {
    for (const entityType of run.entityTypes || []) await deactivateMissing(entityType, runId);
  }

  const completedAt = new Date().toISOString();
  const updated = await S3SyncRun.findOneAndUpdate(
    { runId, status: 'running' },
    { $set: { status: 'completed', completedAt, publishedAt: completedAt, expectedCounts: expected, updatedAt: completedAt } },
    { new: true }
  ).lean();
  if (!updated) throw integrationError('Sync run bị thay đổi đồng thời', 'S3_SYNC_RUN_CONCURRENT_UPDATE', 409);
  return updated;
}

async function getRun(runId) {
  const run = await S3SyncRun.findOne({ runId: text(runId) }).lean();
  if (!run) throw integrationError('Không tìm thấy sync run', 'S3_SYNC_RUN_NOT_FOUND', 404);
  return run;
}

module.exports = {
  ENTITY_TYPES,
  sourceHash,
  productOperation,
  customerOperation,
  userOperation,
  inventoryOperation,
  orderOperation,
  startRun,
  processBatch,
  completeRun,
  getRun
};
