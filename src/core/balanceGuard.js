const BLOCKED_BALANCE_FIELDS = Object.freeze([
  'debtAmount',
  'customerDebt',
  'remainingDebt',
  'orderDebt',
  'stock',
  'quantityOnHand',
  'warehouseStock',
]);

function assertNoDirectBalanceMutation(payload = {}, context = 'update') {
  const keys = Object.keys(payload || {});
  const found = keys.filter((key) => BLOCKED_BALANCE_FIELDS.includes(key));
  if (found.length > 0) {
    const err = new Error(`Không được sửa trực tiếp số dư trong ${context}: ${found.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

module.exports = { BLOCKED_BALANCE_FIELDS, assertNoDirectBalanceMutation };
