const ArLedger = require('../models/ArLedger');
const { roundMoney } = require('../utils/money.util');
const DEBT_ZERO_TOLERANCE = 1000;

async function listCustomerDebts(query) {
  const match = {};
  if (query.customerCode) match.customerCode = query.customerCode;
  if (query.dateFrom || query.dateTo) {
    match.date = {};
    if (query.dateFrom) match.date.$gte = query.dateFrom;
    if (query.dateTo) match.date.$lte = query.dateTo;
  }
  const rows = await ArLedger.aggregate([
    { $match: match },
    { $group: {
      _id: '$customerCode',
      customerName: { $last: '$customerName' },
      debit: { $sum: '$debit' },
      credit: { $sum: '$credit' },
    }},
    { $project: { customerCode: '$_id', customerName: 1, debit: 1, credit: 1, debt: { $subtract: ['$debit', '$credit'] } } },
    { $match: { debt: { $gt: DEBT_ZERO_TOLERANCE } } },
    { $sort: { customerName: 1 } },
    { $limit: 500 },
  ]);
  return rows.map(r => ({ ...r, debt: roundMoney(r.debt) }));
}

module.exports = { listCustomerDebts, DEBT_ZERO_TOLERANCE };
