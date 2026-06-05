const service = require('../../services/mobile/collection.service');

async function getCustomerDebts(req, res, next) {
  try {
    const data = await service.getCustomerDebts(req.query);
    res.json({ ok: true, ...data });
  } catch (err) { next(err); }
}

async function receipt(req, res, next) {
  try {
    const data = await service.createReceipt(req.body);
    res.json(data);
  } catch (err) { next(err); }
}

module.exports = { getCustomerDebts, receipt };
