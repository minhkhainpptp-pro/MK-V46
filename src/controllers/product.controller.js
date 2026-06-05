const service = require('../services/product.service');

async function list(req, res, next) {
  try {
    const result = await service.listProducts(req.query);
    res.json({ ok: true, data: result.rows, rows: result.rows, total: result.total, message: 'OK' });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try { res.json({ ok: true, data: await service.getProduct(req.params.id), message: 'OK' }); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try { res.status(201).json({ ok: true, data: await service.createProduct(req.body), message: 'Đã tạo sản phẩm' }); } catch (err) { next(err); }
}

async function update(req, res, next) {
  try { res.json({ ok: true, data: await service.updateProduct(req.params.id, req.body), message: 'Đã cập nhật sản phẩm' }); } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try { res.json({ ok: true, data: await service.deleteProduct(req.params.id), message: 'Đã xóa mềm sản phẩm' }); } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove };
