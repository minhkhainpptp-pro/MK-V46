/**
 * MK-V46 full-flow checklist.
 *
 * This file is intentionally dependency-free so it can run in CI/static mode.
 * Real integration tests should use a test MongoDB database.
 */
const REQUIRED_FLOW = Object.freeze([
  'createProduct',
  'createCustomer',
  'createSalesOrder',
  'createMasterOrder',
  'confirmDelivery',
  'confirmAccounting',
  'checkArLedger',
  'checkInventoryLedger',
  'checkFundLedger',
  'checkDashboard',
]);

function getRequiredFlow() {
  return REQUIRED_FLOW.slice();
}

if (require.main === module) {
  console.log('[FULL_FLOW_CHECKLIST]', REQUIRED_FLOW.join(' -> '));
}

module.exports = { REQUIRED_FLOW, getRequiredFlow };
