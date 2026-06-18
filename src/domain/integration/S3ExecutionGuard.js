'use strict';

const integrationConfig = require('../../config/integrationConfig');

const S3_MANAGED_IMPORT_TYPES = Object.freeze(new Set([
  'openingstock',
  'importorders',
  'salesorders',
  'salesorderss3'
]));

function normalized(value) {
  return String(value || '').trim().toUpperCase();
}

function createManagedByS3Error({ action, subject, code, authority }) {
  const error = new Error(`Không được ${action}: ${subject} đang được quản lý bởi S3`);
  error.code = code;
  error.status = 409;
  error.details = {
    systemMode: integrationConfig.systemMode,
    authority: normalized(authority),
    action
  };
  return error;
}

function assertLocalOrderEnabled(action = 'thực hiện nghiệp vụ đơn bán') {
  if (integrationConfig.isS3Execution && normalized(integrationConfig.orderAuthority) === 'S3') {
    throw createManagedByS3Error({
      action,
      subject: 'đơn bán',
      code: 'ORDER_MANAGED_BY_S3',
      authority: integrationConfig.orderAuthority
    });
  }
}

function assertLocalMasterOrderEnabled(action = 'thực hiện nghiệp vụ đơn tổng') {
  if (integrationConfig.isS3Execution && normalized(integrationConfig.masterOrderAuthority) === 'S3') {
    throw createManagedByS3Error({
      action,
      subject: 'đơn tổng',
      code: 'MASTER_ORDER_MANAGED_BY_S3',
      authority: integrationConfig.masterOrderAuthority
    });
  }
}

function assertLocalInventoryEnabled(action = 'ghi tồn kho') {
  if (integrationConfig.isS3Execution && normalized(integrationConfig.inventoryAuthority) === 'S3') {
    throw createManagedByS3Error({
      action,
      subject: 'tồn kho',
      code: 'INVENTORY_MANAGED_BY_S3',
      authority: integrationConfig.inventoryAuthority
    });
  }
}

function normalizeImportType(type) {
  return String(type || '').trim().toLowerCase();
}

function isS3ManagedImportType(type) {
  return S3_MANAGED_IMPORT_TYPES.has(normalizeImportType(type));
}

function assertLocalImportEnabled(type, action = 'import dữ liệu nguồn') {
  const normalizedType = normalizeImportType(type);
  if (!integrationConfig.isS3Execution || !isS3ManagedImportType(normalizedType)) return;

  const inventoryType = normalizedType === 'openingstock' || normalizedType === 'importorders';
  const authority = inventoryType
    ? integrationConfig.inventoryAuthority
    : integrationConfig.orderAuthority;

  if (normalized(authority) !== 'S3') return;

  throw createManagedByS3Error({
    action,
    subject: inventoryType ? 'nguồn nhập kho/tồn kho' : 'nguồn đơn bán',
    code: 'SOURCE_IMPORT_MANAGED_BY_S3',
    authority
  });
}

module.exports = {
  S3_MANAGED_IMPORT_TYPES,
  assertLocalOrderEnabled,
  assertLocalMasterOrderEnabled,
  assertLocalInventoryEnabled,
  assertLocalImportEnabled,
  isS3ManagedImportType,
  normalizeImportType
};
