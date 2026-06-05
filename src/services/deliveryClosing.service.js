const DeliveryClosing = require('../models/DeliveryClosing');
const DeliveryEngine = require('../engines/DeliveryEngine');
const { roundMoney } = require('../utils/money.util');

function clean(value) { return String(value || '').trim(); }
function amount(value) { return roundMoney(Number(value || 0)); }

async function calculateExpected(query = {}) {
  const date = clean(query.date || query.deliveryDate);
  const deliveryStaffCode = clean(query.deliveryStaffCode);
  if (!date) throw Object.assign(new Error('Thiếu ngày đối soát'), { status: 400 });
  if (!deliveryStaffCode) throw Object.assign(new Error('Thiếu NVGH đối soát'), { status: 400 });

  const result = await DeliveryEngine.listOrders({ deliveryDate: date, deliveryStaffCode, status: 'all' });
  const summary = (result.rows || []).reduce((acc, row) => {
    acc.expectedCash += amount(row.cashAmount || row.paidAmount || 0);
    acc.expectedReturn += amount(row.returnAmount || 0);
    acc.expectedReceivable += amount(row.totalAmount || row.finalAmount || 0);
    acc.expectedDebt += amount(row.debtAmount || 0);
    return acc;
  }, { expectedCash: 0, expectedBank: 0, expectedReturn: 0, expectedReceivable: 0, expectedDebt: 0 });

  Object.keys(summary).forEach((key) => { summary[key] = amount(summary[key]); });
  return { rows: result.rows || [], summary };
}

async function closeDay(input = {}) {
  const date = clean(input.date || input.deliveryDate);
  const deliveryStaffCode = clean(input.deliveryStaffCode);
  if (!date) throw Object.assign(new Error('Thiếu ngày đối soát'), { status: 400 });
  if (!deliveryStaffCode) throw Object.assign(new Error('Thiếu NVGH đối soát'), { status: 400 });

  const expected = await calculateExpected({ date, deliveryStaffCode });
  const expectedCash = amount(input.expectedCash ?? expected.summary.expectedCash);
  const actualCash = amount(input.actualCash);
  const expectedBank = amount(input.expectedBank ?? expected.summary.expectedBank);
  const actualBank = amount(input.actualBank);
  const expectedReturn = amount(input.expectedReturn ?? expected.summary.expectedReturn);
  const actualReturn = amount(input.actualReturn ?? expectedReturn);
  const variance = amount((actualCash - expectedCash) + (actualBank - expectedBank) + (actualReturn - expectedReturn));

  const doc = await DeliveryClosing.findOneAndUpdate(
    { date, deliveryStaffCode },
    {
      $set: {
        code: `DC-${date}-${deliveryStaffCode}`,
        date,
        deliveryStaffCode,
        deliveryStaffName: clean(input.deliveryStaffName),
        expectedCash,
        actualCash,
        expectedBank,
        actualBank,
        expectedReturn,
        actualReturn,
        variance,
        note: clean(input.note),
        closedBy: clean(input.closedBy || input.createdBy),
        closedAt: new Date(),
        status: variance === 0 ? 'closed' : 'variance',
      },
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  return { closing: doc, expected: expected.summary };
}

async function list(query = {}) {
  const filter = {};
  if (query.date) filter.date = clean(query.date);
  if (query.deliveryStaffCode) filter.deliveryStaffCode = clean(query.deliveryStaffCode);
  const rows = await DeliveryClosing.find(filter).sort({ date: -1, deliveryStaffCode: 1 }).limit(Math.min(Number(query.limit || 100), 500)).lean();
  return { rows, total: rows.length };
}

module.exports = { calculateExpected, closeDay, list };
