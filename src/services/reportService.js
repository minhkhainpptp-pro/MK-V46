const SalesOrder = require('../models/SalesOrder');
const ReturnOrder = require('../models/ReturnOrder');
const ArLedger = require('../models/ArLedger');
const FundLedger = require('../models/FundLedger');
const Inventory = require('../models/Inventory');
const { roundMoney } = require('../utils/money.util');

function cleanText(value) { return String(value || '').trim(); }
function amountOf(value) { return roundMoney(Number(value || 0)); }

function dateFilter(query = {}) {
  const filter = {};
  const dateFrom = cleanText(query.dateFrom || query.from || query.date);
  const dateTo = cleanText(query.dateTo || query.to || query.date);
  if (dateFrom || dateTo) {
    filter.$gte = dateFrom || '0000-00-00';
    filter.$lte = dateTo || '9999-99-99';
  }
  return Object.keys(filter).length ? filter : null;
}

async function getDashboard(query = {}) {
  const startedAt = Date.now();
  const df = dateFilter(query);
  const salesFilter = df ? { deliveryDate: df } : { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
  const returnFilter = df ? { deliveryDate: df, status: { $nin: ['cancelled'] } } : { status: { $nin: ['cancelled'] } };
  const arFilter = df ? { date: df } : {};
  const fundFilter = df ? { date: df } : {};

  const [salesRows, returnRows, arRows, fundRows, inventoryCount] = await Promise.all([
    SalesOrder.find(salesFilter).select('payableAmount finalAmount totalAmount status accountingStatus').limit(5000).lean(),
    ReturnOrder.find(returnFilter).select('totalReturnAmount amount status').limit(5000).lean(),
    ArLedger.find(arFilter).select('debit credit type').limit(10000).lean(),
    FundLedger.find(fundFilter).select('amount type').limit(10000).lean(),
    Inventory.countDocuments({}),
  ]);

  const salesAmount = amountOf(salesRows.reduce((sum, row) => sum + Number(row.payableAmount ?? row.finalAmount ?? row.totalAmount ?? 0), 0));
  const returnAmount = amountOf(returnRows.reduce((sum, row) => sum + Number(row.totalReturnAmount ?? row.amount ?? 0), 0));
  const arDebit = amountOf(arRows.reduce((sum, row) => sum + Number(row.debit || 0), 0));
  const arCredit = amountOf(arRows.reduce((sum, row) => sum + Number(row.credit || 0), 0));
  const fundAmount = amountOf(fundRows.reduce((sum, row) => sum + Number(row.amount || 0), 0));

  return {
    summary: {
      orderCount: salesRows.length,
      salesAmount,
      returnAmount,
      arDebit,
      arCredit,
      debtAmount: amountOf(arDebit - arCredit),
      fundAmount,
      inventoryLedgerCount: inventoryCount,
    },
    source: ['salesOrders', 'returnOrders', 'arLedgers', 'fundLedgers', 'inventories'],
    perf: { totalMs: Date.now() - startedAt },
  };
}

module.exports = { getDashboard };
