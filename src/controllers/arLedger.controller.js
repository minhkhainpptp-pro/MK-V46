const service = require('../services/arLedger.service');

async function list(req, res, next) {
  try {
    const result = await service.listArLedgers(req.query);
    res.json({ ok: true, rows: result.rows, data: result.rows, total: result.total, summary: result.summary });
  } catch (err) { next(err); }
}

async function byCustomer(req, res, next) {
  try {
    const result = await service.getCustomerDebtDetail({ ...req.query, customerCode: req.params.customerCode });
    res.json({ ok: true, customer: result.customer, rows: result.rows, data: result.rows, summary: result.summary });
  } catch (err) { next(err); }
}

async function receipt(req, res, next) {
  try {
    const row = await service.postReceiptAr(req.body || {});
    res.status(201).json({ ok: true, row, data: row, message: 'Đã ghi AR_RECEIPT giảm công nợ' });
  } catch (err) { next(err); }
}

async function customerStatement(req, res, next) {
  try {
    const result = await service.getCustomerStatement(req.query);
    res.json({ ok: true, rows: result.rows, data: result.rows, summary: result.summary });
  } catch (err) { next(err); }
}

async function discount(req, res, next) {
  try {
    const row = await service.postDiscountAr(req.body || {});
    res.status(201).json({ ok: true, row, data: row, message: 'Đã ghi AR_DISCOUNT giảm công nợ' });
  } catch (err) { next(err); }
}

module.exports = { list, byCustomer, customerStatement, receipt, discount };
