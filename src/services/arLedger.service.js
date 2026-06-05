const ArLedger = require('../models/ArLedger');
const Customer = require('../models/Customer');
const { roundMoney } = require('../utils/money.util');

const DEBT_ZERO_TOLERANCE = 1000;

function cleanText(value) {
  return String(value || '').trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function amountOf(value) {
  return roundMoney(Number(value || 0));
}

function sourceIdOf(doc) {
  return cleanText(doc.id || doc._id);
}

async function createOnce(payload) {
  const type = cleanText(payload.type);
  const sourceType = cleanText(payload.sourceType);
  const sourceId = cleanText(payload.sourceId);
  if (sourceType && sourceId && type) {
    const existed = await ArLedger.findOne({ sourceType, sourceId, type }).lean();
    if (existed) return existed;
  }
  const amount = amountOf(payload.amount || payload.debit || payload.credit);
  const doc = await ArLedger.create({
    id: cleanText(payload.id) || makeId('AR'),
    code: cleanText(payload.code) || `${type}-${payload.sourceCode || sourceId || Date.now()}`,
    type,
    date: cleanText(payload.date) || today(),
    customerCode: cleanText(payload.customerCode),
    customerName: cleanText(payload.customerName),
    salesOrderId: cleanText(payload.salesOrderId),
    salesOrderCode: cleanText(payload.salesOrderCode),
    masterOrderId: cleanText(payload.masterOrderId),
    masterOrderCode: cleanText(payload.masterOrderCode),
    debit: amountOf(payload.debit),
    credit: amountOf(payload.credit),
    amount,
    note: cleanText(payload.note),
    sourceType,
    sourceId,
    sourceCode: cleanText(payload.sourceCode),
    createdBy: cleanText(payload.createdBy),
  });
  return doc.toObject();
}

async function postSaleAr(salesOrder, createdBy = '') {
  const saleAmount = amountOf(salesOrder.finalAmount ?? salesOrder.totalAmount ?? 0);
  if (saleAmount <= 0) return null;
  const sourceId = sourceIdOf(salesOrder);
  return createOnce({
    type: 'AR_SALE',
    date: salesOrder.deliveryDate || today(),
    customerCode: salesOrder.customerCode,
    customerName: salesOrder.customerName,
    salesOrderId: sourceId,
    salesOrderCode: salesOrder.code,
    masterOrderId: salesOrder.masterOrderId,
    masterOrderCode: salesOrder.masterOrderCode,
    debit: saleAmount,
    credit: 0,
    amount: saleAmount,
    note: 'Ghi nhận công nợ bán hàng khi kế toán xác nhận',
    sourceType: 'salesOrder',
    sourceId,
    sourceCode: salesOrder.code,
    createdBy,
  });
}


async function assertNotOverCustomerDebt(payload = {}, amount = 0) {
  const customerCode = cleanText(payload.customerCode);
  if (!customerCode) return;
  const currentDebt = await getCustomerDebt(customerCode, {});
  if (amountOf(amount) > amountOf(currentDebt + DEBT_ZERO_TOLERANCE)) {
    throw Object.assign(
      new Error(`Thu vượt công nợ: số thu ${amountOf(amount)} lớn hơn công nợ ${amountOf(currentDebt)}`),
      { status: 409 }
    );
  }
}

async function postReceiptAr(payload) {
  const amount = amountOf(payload.amount || payload.cashAmount || 0);
  if (amount <= 0) throw Object.assign(new Error('Số tiền thu phải lớn hơn 0'), { status: 400 });
  await assertNotOverCustomerDebt(payload, amount);
  const sourceId = cleanText(payload.receiptId || payload.sourceId || makeId('RECEIPT'));
  return createOnce({
    type: 'AR_RECEIPT',
    date: payload.date || today(),
    customerCode: payload.customerCode,
    customerName: payload.customerName,
    salesOrderId: payload.salesOrderId,
    salesOrderCode: payload.salesOrderCode,
    masterOrderId: payload.masterOrderId,
    masterOrderCode: payload.masterOrderCode,
    debit: 0,
    credit: amount,
    amount,
    note: payload.note || 'Thu tiền giảm công nợ',
    sourceType: 'receipt',
    sourceId,
    sourceCode: payload.receiptCode || payload.sourceCode || sourceId,
    createdBy: payload.createdBy,
  });
}

async function postReturnAr(returnOrder, createdBy = '') {
  const amount = amountOf(returnOrder.totalReturnAmount || 0);
  if (amount <= 0) return null;
  const sourceId = sourceIdOf(returnOrder);
  return createOnce({
    type: 'AR_RETURN',
    date: returnOrder.deliveryDate || today(),
    customerCode: returnOrder.customerCode,
    customerName: returnOrder.customerName,
    salesOrderId: returnOrder.salesOrderId,
    salesOrderCode: returnOrder.salesOrderCode,
    masterOrderId: returnOrder.masterOrderId,
    masterOrderCode: returnOrder.masterOrderCode,
    debit: 0,
    credit: amount,
    amount,
    note: 'Giảm công nợ do hàng trả',
    sourceType: 'returnOrder',
    sourceId,
    sourceCode: returnOrder.code,
    createdBy,
  });
}

async function postDiscountAr(payload) {
  const amount = amountOf(payload.amount);
  if (amount <= 0) throw Object.assign(new Error('Số tiền chiết khấu/trả thưởng phải lớn hơn 0'), { status: 400 });
  const sourceId = cleanText(payload.discountId || payload.sourceId || makeId('DISCOUNT'));
  return createOnce({
    type: 'AR_DISCOUNT',
    date: payload.date || today(),
    customerCode: payload.customerCode,
    customerName: payload.customerName,
    salesOrderId: payload.salesOrderId,
    salesOrderCode: payload.salesOrderCode,
    masterOrderId: payload.masterOrderId,
    masterOrderCode: payload.masterOrderCode,
    debit: 0,
    credit: amount,
    amount,
    note: payload.note || 'Chiết khấu/trả thưởng giảm công nợ',
    sourceType: 'discount',
    sourceId,
    sourceCode: payload.discountCode || payload.sourceCode || sourceId,
    createdBy: payload.createdBy,
  });
}

async function reverseSaleAr(salesOrder, createdBy = '') {
  const amount = amountOf(salesOrder.finalAmount ?? salesOrder.totalAmount ?? 0);
  if (amount <= 0) return null;
  const sourceId = sourceIdOf(salesOrder);
  return createOnce({
    type: 'AR_SALE_REVERSAL',
    date: today(),
    customerCode: salesOrder.customerCode,
    customerName: salesOrder.customerName,
    salesOrderId: sourceId,
    salesOrderCode: salesOrder.code,
    masterOrderId: salesOrder.masterOrderId,
    masterOrderCode: salesOrder.masterOrderCode,
    debit: 0,
    credit: amount,
    amount,
    note: 'Đảo công nợ bán hàng',
    sourceType: 'salesOrderReversal',
    sourceId,
    sourceCode: salesOrder.code,
    createdBy,
  });
}

function buildLedgerFilter(query = {}) {
  const filter = {};
  if (query.customerCode) filter.customerCode = cleanText(query.customerCode);
  if (query.salesOrderCode) filter.salesOrderCode = cleanText(query.salesOrderCode);
  if (query.masterOrderCode) filter.masterOrderCode = cleanText(query.masterOrderCode);
  if (query.type) filter.type = cleanText(query.type);
  if (query.dateFrom || query.dateTo) {
    filter.date = {};
    if (query.dateFrom) filter.date.$gte = cleanText(query.dateFrom);
    if (query.dateTo) filter.date.$lte = cleanText(query.dateTo);
  }
  if (query.keyword) {
    const keyword = cleanText(query.keyword);
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ customerCode: regex }, { customerName: regex }, { salesOrderCode: regex }, { masterOrderCode: regex }, { code: regex }];
  }
  return filter;
}

async function listArLedgers(query = {}) {
  const filter = buildLedgerFilter(query);
  const limit = Math.min(Number(query.limit || 200), 1000);
  const rows = await ArLedger.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
  const summary = rows.reduce((acc, row) => {
    acc.totalDebit += amountOf(row.debit);
    acc.totalCredit += amountOf(row.credit);
    return acc;
  }, { totalDebit: 0, totalCredit: 0, totalDebt: 0 });
  summary.totalDebt = amountOf(summary.totalDebit - summary.totalCredit);
  return { rows, total: rows.length, summary };
}

async function getCustomerDebt(customerCode, query = {}) {
  const detail = await getCustomerDebtDetail({ ...query, customerCode });
  return detail.summary.debt;
}

async function getCustomerDebtDetail(query = {}) {
  const customerCode = cleanText(query.customerCode);
  if (!customerCode) throw Object.assign(new Error('Thiếu customerCode'), { status: 400 });
  const filter = buildLedgerFilter(query);
  filter.customerCode = customerCode;
  const rows = await ArLedger.find(filter).sort({ date: 1, createdAt: 1 }).lean();
  let runningDebt = 0;
  const ledgerRows = rows.map(row => {
    runningDebt = amountOf(runningDebt + amountOf(row.debit) - amountOf(row.credit));
    return { ...row, runningDebt };
  });
  const summary = ledgerRows.reduce((acc, row) => {
    acc.debit += amountOf(row.debit);
    acc.credit += amountOf(row.credit);
    return acc;
  }, { debit: 0, credit: 0, debt: 0 });
  summary.debt = amountOf(summary.debit - summary.credit);
  const customer = await Customer.findOne({ code: customerCode }).lean();
  return { customer: customer || { code: customerCode, name: ledgerRows[0] && ledgerRows[0].customerName }, rows: ledgerRows, summary };
}

async function getDebtCustomers(query = {}) {
  const match = buildLedgerFilter(query);
  delete match.customerCode;
  const rows = await ArLedger.aggregate([
    { $match: match },
    { $group: {
      _id: '$customerCode',
      customerName: { $last: '$customerName' },
      totalDebit: { $sum: '$debit' },
      totalCredit: { $sum: '$credit' },
    } },
    { $project: {
      _id: 0,
      customerCode: '$_id',
      customerName: 1,
      totalDebit: 1,
      totalCredit: 1,
      debt: { $subtract: ['$totalDebit', '$totalCredit'] },
    } },
    { $match: { debt: { $gt: DEBT_ZERO_TOLERANCE } } },
    { $sort: { customerName: 1 } },
    { $limit: Math.min(Number(query.limit || 500), 1000) },
  ]);
  const normalizedRows = rows.map(row => ({
    ...row,
    totalDebit: amountOf(row.totalDebit),
    totalCredit: amountOf(row.totalCredit),
    debt: amountOf(row.debt),
  }));
  const summary = normalizedRows.reduce((acc, row) => {
    acc.totalDebit += row.totalDebit;
    acc.totalCredit += row.totalCredit;
    acc.totalDebt += row.debt;
    return acc;
  }, { totalDebit: 0, totalCredit: 0, totalDebt: 0 });
  summary.totalDebit = amountOf(summary.totalDebit);
  summary.totalCredit = amountOf(summary.totalCredit);
  summary.totalDebt = amountOf(summary.totalDebt);
  return { rows: normalizedRows, total: normalizedRows.length, summary };
}


async function getCustomerStatement(query = {}) {
  const customerCode = cleanText(query.customerCode);
  if (!customerCode) throw Object.assign(new Error('Thiếu customerCode'), { status: 400 });

  const fromDate = cleanText(query.dateFrom || query.from);
  const toDate = cleanText(query.dateTo || query.to);
  const openingMatch = { customerCode };
  if (fromDate) openingMatch.date = { $lt: fromDate };

  const periodMatch = { customerCode };
  if (fromDate || toDate) {
    periodMatch.date = {};
    if (fromDate) periodMatch.date.$gte = fromDate;
    if (toDate) periodMatch.date.$lte = toDate;
  }

  const [openingRows, rows] = await Promise.all([
    fromDate ? ArLedger.find(openingMatch).select('debit credit').lean() : [],
    ArLedger.find(periodMatch).sort({ date: 1, createdAt: 1 }).lean(),
  ]);

  const openingBalance = openingRows.reduce((sum, row) => amountOf(sum + amountOf(row.debit) - amountOf(row.credit)), 0);
  let runningDebt = amountOf(openingBalance);
  const statementRows = rows.map((row) => {
    runningDebt = amountOf(runningDebt + amountOf(row.debit) - amountOf(row.credit));
    return { ...row, openingBalance, runningDebt };
  });

  const periodDebit = rows.reduce((sum, row) => amountOf(sum + amountOf(row.debit)), 0);
  const periodCredit = rows.reduce((sum, row) => amountOf(sum + amountOf(row.credit)), 0);
  const closingBalance = amountOf(openingBalance + periodDebit - periodCredit);

  return {
    customerCode,
    rows: statementRows,
    summary: {
      openingBalance: amountOf(openingBalance),
      periodDebit: amountOf(periodDebit),
      periodCredit: amountOf(periodCredit),
      closingBalance,
    },
  };
}


module.exports = {
  DEBT_ZERO_TOLERANCE,
  postSaleAr,
  postReceiptAr,
  postReturnAr,
  postDiscountAr,
  reverseSaleAr,
  getCustomerDebt,
  getCustomerDebtDetail,
  getCustomerStatement,
  getDebtCustomers,
  listArLedgers,
};
