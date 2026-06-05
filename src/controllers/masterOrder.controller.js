const service = require('../services/masterOrderService');

async function list(req, res, next) {
  try {
    const result = await service.listMasterOrders(req.query);
    res.json({ ok: true, rows: result.rows, data: result.rows, total: result.total });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const data = await service.getMasterWithChildren(req.params.id);
    res.json({ ok: true, data, masterOrder: data.master, orders: data.orders });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const masterOrder = await service.createMasterOrder(req.body);
    res.status(201).json({ ok: true, masterOrder, data: masterOrder, message: 'Gộp đơn thành công' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const masterOrder = await service.updateMasterOrder(req.params.id, req.body);
    res.json({ ok: true, masterOrder, data: masterOrder, message: 'Cập nhật đơn tổng thành công' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const masterOrder = await service.cancelMasterOrder(req.params.id, req.body && req.body.reason);
    res.json({ ok: true, masterOrder, data: masterOrder, message: 'Đã hủy mềm đơn tổng và trả đơn con về pending' });
  } catch (err) { next(err); }
}

async function deliver(req, res, next) {
  try {
    const masterOrder = await service.deliverMasterOrder(req.params.id);
    res.json({ ok: true, masterOrder, data: masterOrder, message: 'Xác nhận giao hàng thành công' });
  } catch (err) { next(err); }
}

async function accountingConfirm(req, res, next) {
  try {
    const masterOrder = await service.accountingConfirmMasterOrder(req.params.id, req.body && req.body.confirmedBy);
    res.json({ ok: true, masterOrder, data: masterOrder, message: 'Kế toán xác nhận thành công' });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove, deliver, accountingConfirm };
