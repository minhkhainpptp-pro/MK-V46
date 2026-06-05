const ArLedger = require('../../models/ArLedger');
const Customer = require('../../models/Customer');
const arLedgerService = require('../arLedger.service');
const { roundMoney } = require('../../utils/money.util');

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value) {
  return String(value || '').trim();
}

function amountOf(value) {
  return roundMoney(Number(value || 0));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function buildLedgerFilter(query = {}) {
  const filter = {};
  if (query.customerCode) filter.customerCode = cleanText(query.customerCode);
  if (query.dateFrom || query.fromDate) filter.date = { ...(filter.date || {}), $gte: cleanText(query.dateFrom || query.fromDate) };
  if (query.dateTo || query.toDate) filter.date = { ...(filter.date || {}), $lte: cleanText(query.dateTo || query.toDate) };
  return filter;
}

async function getCustomerDebts(query = {}) {
  const customerCode = cleanText(query.customerCode);
  if (!customerCode) throw httpError('Thiếu customerCode', 400);

  const filter = buildLedgerFilter(query);
  const ledgers = await ArLedger.find(filter)
    .sort({ date: 1, createdAt: 1 })
    .lean();

  let runningDebt = 0;
  const rows = ledgers.map((row) => {
    runningDebt = amountOf(runningDebt + amountOf(row.debit) - amountOf(row.credit));
    return { ...row, runningDebt };
  });

  const orderMap = new Map();
  for (const row of rows) {
    const key = cleanText(row.salesOrderCode || row.salesOrderId || row.sourceCode || row.sourceId);
    if (!key) continue;
    const current = orderMap.get(key) || {
      salesOrderId: cleanText(row.salesOrderId),
      salesOrderCode: cleanText(row.salesOrderCode || row.sourceCode),
      customerCode: row.customerCode,
      customerName: row.customerName,
      debit: 0,
      credit: 0,
      debt: 0,
      date: row.date,
    };
    current.debit += amountOf(row.debit);
    current.credit += amountOf(row.credit);
    current.debt = amountOf(current.debit - current.credit);
    current.date = current.date || row.date;
    orderMap.set(key, current);
  }

  const debtOrders = Array.from(orderMap.values())
    .map((row) => ({ ...row, debit: amountOf(row.debit), credit: amountOf(row.credit), debt: amountOf(row.debt) }))
    .filter((row) => row.debt > 1000)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const summary = rows.reduce((acc, row) => {
    acc.totalDebit += amountOf(row.debit);
    acc.totalCredit += amountOf(row.credit);
    return acc;
  }, { totalDebit: 0, totalCredit: 0, debt: 0 });
  summary.totalDebit = amountOf(summary.totalDebit);
  summary.totalCredit = amountOf(summary.totalCredit);
  summary.debt = amountOf(summary.totalDebit - summary.totalCredit);

  const customer = await Customer.findOne({ code: customerCode }).lean();

  return {
    customer: customer || { code: customerCode, name: rows[0] && rows[0].customerName },
    debt: summary.debt,
    rows,
    debtOrders,
    summary,
  };
}

async function createReceipt(input = {}) {
  const customerCode = cleanText(input.customerCode);
  if (!customerCode) throw httpError('Thiếu customerCode', 400);

  const cashAmount = amountOf(input.cashAmount ?? input.cash ?? 0);
  const bankAmount = amountOf(input.bankAmount ?? input.bank ?? 0);
  const bonusAmount = amountOf(input.bonusAmount ?? input.bonus ?? 0);
  const discountAmount = amountOf(input.discountAmount ?? input.discount ?? 0);
  const amount = amountOf(cashAmount + bankAmount + bonusAmount + discountAmount);
  if (amount <= 0) throw httpError('Số tiền thu phải lớn hơn 0', 400);

  const sourceId = cleanText(input.receiptId || input.sourceId) || `MOBILE-RECEIPT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const selectedDebtOrderIds = Array.isArray(input.selectedDebtOrderIds) ? input.selectedDebtOrderIds.map(cleanText).filter(Boolean) : [];

  const arLedger = await arLedgerService.postReceiptAr({
    date: input.date || today(),
    customerCode,
    customerName: cleanText(input.customerName),
    salesOrderId: cleanText(input.salesOrderId),
    salesOrderCode: cleanText(input.salesOrderCode),
    masterOrderId: cleanText(input.masterOrderId),
    masterOrderCode: cleanText(input.masterOrderCode),
    amount,
    receiptId: sourceId,
    receiptCode: cleanText(input.receiptCode) || sourceId,
    sourceId,
    note: input.note || `Thu tiền app giao hàng: TM=${cashAmount}; CK=${bankAmount}; thưởng=${bonusAmount}; giảm trừ=${discountAmount}; đơn chọn=${selectedDebtOrderIds.join(',')}`,
    createdBy: input.createdBy || input.deliveryStaffCode || '',
  });

  return {
    ok: true,
    arLedger,
    receiptAmount: amount,
    breakdown: { cashAmount, bankAmount, bonusAmount, discountAmount },
    selectedDebtOrderIds,
  };
}

module.exports = {
  getCustomerDebts,
  createReceipt,
};
