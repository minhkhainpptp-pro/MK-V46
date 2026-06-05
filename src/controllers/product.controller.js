const service = require('../services/product.service');
const { successResponse, createdResponse } = require('../utils/response.util');

async function list(req, res, next) {
  try {
    const result = await service.listProducts(req.query);
    return successResponse(res, result.rows, { rows: result.rows, total: result.total, message: 'OK' });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try { return successResponse(res, await service.getProduct(req.params.id), { message: 'OK' }); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try { return createdResponse(res, await service.createProduct(req.body), { message: 'Đã tạo sản phẩm' }); } catch (err) { next(err); }
}

async function update(req, res, next) {
  try { return successResponse(res, await service.updateProduct(req.params.id, req.body), { message: 'Đã cập nhật sản phẩm' }); } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try { return successResponse(res, await service.deleteProduct(req.params.id), { message: 'Đã xóa mềm sản phẩm' }); } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove };
