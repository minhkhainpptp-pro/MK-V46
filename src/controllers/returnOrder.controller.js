const service = require('../services/returnOrder.service');
const { successResponse, createdResponse } = require('../utils/response.util');

async function list(req, res, next) {
  try {
    const result = await service.listReturnOrders(req.query);
    return successResponse(res, result.rows, { rows: result.rows, total: result.total });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const returnOrder = await service.getReturnOrder(req.params.id);
    return successResponse(res, returnOrder, { returnOrder });
  } catch (err) { next(err); }
}

async function getBySalesOrder(req, res, next) {
  try {
    const result = await service.getReturnOrdersBySalesOrder(req.params.salesOrderId);
    return successResponse(res, result.rows, { rows: result.rows, total: result.total });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const returnOrder = await service.createOrUpdateReturnOrder(req.body);
    return createdResponse(res, returnOrder, { returnOrder, message: 'Tạo/cập nhật phiếu trả hàng thành công' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const returnOrder = await service.updateReturnOrder(req.params.id, req.body);
    return successResponse(res, returnOrder, { returnOrder, message: 'Cập nhật phiếu trả hàng thành công' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const returnOrder = await service.cancelReturnOrder(req.params.id, req.body && req.body.reason);
    return successResponse(res, returnOrder, { returnOrder, message: 'Đã hủy mềm phiếu trả hàng' });
  } catch (err) { next(err); }
}

async function accountingConfirm(req, res, next) {
  try {
    const returnOrder = await service.accountingConfirmReturnOrder(
      req.params.id,
      (req.body && (req.body.confirmedBy || req.body.userCode)) || ''
    );
    return successResponse(res, returnOrder, { returnOrder, message: 'Kế toán đã xác nhận phiếu trả hàng' });
  } catch (err) { next(err); }
}

module.exports = { list, getById, getBySalesOrder, create, update, remove, accountingConfirm };
