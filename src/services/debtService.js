const arLedgerService = require('./arLedger.service');

const DEBT_ZERO_TOLERANCE = arLedgerService.DEBT_ZERO_TOLERANCE;

async function listCustomerDebts(query) {
  const result = await arLedgerService.getDebtCustomers(query);
  return result.rows;
}

async function getDebtCustomers(query) {
  return arLedgerService.getDebtCustomers(query);
}

async function getCustomerDebtDetail(query) {
  return arLedgerService.getCustomerDebtDetail(query);
}

module.exports = {
  listCustomerDebts,
  getDebtCustomers,
  getCustomerDebtDetail,
  DEBT_ZERO_TOLERANCE,
};
