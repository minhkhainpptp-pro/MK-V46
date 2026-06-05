const SALES_ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

const DELIVERY_STATUS = Object.freeze({
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const ACCOUNTING_STATUS = Object.freeze({
  PENDING: 'pending',
  POSTED: 'posted',
  CANCELLED: 'cancelled',
});

const COMMON_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CANCELLED: 'cancelled',
  POSTED: 'posted',
});

function assertAllowedStatus(value, allowed, fieldName = 'status') {
  if (!Object.values(allowed).includes(value)) {
    const err = new Error(`${fieldName} không hợp lệ: ${value}`);
    err.status = 400;
    throw err;
  }
  return value;
}

module.exports = {
  SALES_ORDER_STATUS,
  DELIVERY_STATUS,
  ACCOUNTING_STATUS,
  COMMON_STATUS,
  assertAllowedStatus,
};
