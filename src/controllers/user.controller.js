const service = require('../services/user.service');

async function list(req, res, next) {
  try {
    const result = await service.listUsers(req.query);
    res.json({ ok: true, data: result.rows, rows: result.rows, total: result.total, message: 'OK' });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try { res.json({ ok: true, data: await service.getUser(req.params.id), message: 'OK' }); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try { res.status(201).json({ ok: true, data: await service.createUser(req.body), message: 'Đã tạo nhân sự' }); } catch (err) { next(err); }
}

async function update(req, res, next) {
  try { res.json({ ok: true, data: await service.updateUser(req.params.id, req.body), message: 'Đã cập nhật nhân sự' }); } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try { res.json({ ok: true, data: await service.deleteUser(req.params.id), message: 'Đã xóa mềm nhân sự' }); } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove };
