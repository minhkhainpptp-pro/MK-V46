const service = require('../services/customer.service');

async function list(req, res, next) {
  try {
    const result = await service.listCustomers(req.query);
    res.json({ ok: true, data: result.rows, rows: result.rows, total: result.total, message: 'OK' });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try { res.json({ ok: true, data: await service.getCustomer(req.params.id), message: 'OK' }); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try { res.status(201).json({ ok: true, data: await service.createCustomer(req.body), message: 'Đã tạo khách hàng' }); } catch (err) { next(err); }
}

async function update(req, res, next) {
  try { res.json({ ok: true, data: await service.updateCustomer(req.params.id, req.body), message: 'Đã cập nhật khách hàng' }); } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try { res.json({ ok: true, data: await service.deleteCustomer(req.params.id), message: 'Đã xóa mềm khách hàng' }); } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove };
