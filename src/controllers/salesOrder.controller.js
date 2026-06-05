const service = require('../services/salesOrderService');

async function list(req, res, next) {
  try {
    const result = await service.listSalesOrders(req.query);
    res.json({ ok: true, rows: result.rows, data: result.rows, total: result.total });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const order = await service.getSalesOrder(req.params.id);
    res.json({ ok: true, order, data: order });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const order = await service.createSalesOrder(req.body);
    res.status(201).json({ ok: true, order, data: order, message: 'Tạo đơn bán thành công' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const order = await service.updateSalesOrder(req.params.id, req.body);
    res.json({ ok: true, order, data: order, message: 'Cập nhật đơn bán thành công' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const order = await service.cancelSalesOrder(req.params.id, req.body && req.body.reason);
    res.json({ ok: true, order, data: order, message: 'Đã hủy mềm đơn bán' });
  } catch (err) { next(err); }
}

async function importPreview(req, res, next) {
  try {
    const result = await service.importPreview(req.body);
    res.json({ ok: true, rows: result.rows, data: result.rows, total: result.total });
  } catch (err) { next(err); }
}

async function importConfirm(req, res, next) {
  try {
    const result = await service.importConfirm(req.body);
    res.status(201).json({ ok: true, rows: result.rows, data: result.rows, inserted: result.inserted, message: 'Import đơn bán thành công' });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove, importPreview, importConfirm };
