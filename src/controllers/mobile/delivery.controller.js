const service = require('../../engines/DeliveryEngine');
const { successResponse } = require('../../utils/response.util');

async function listOrders(req, res, next) {
  const started = Date.now();
  try {
    const result = await service.listOrders(req.query);
    return successResponse(res, result.rows, {
      rows: result.rows,
      orders: result.rows,
      total: result.total,
      ms: Date.now() - started,
      perf: result.perf || { totalMs: Date.now() - started },
    });
  } catch (err) { next(err); }
}

async function getOrder(req, res, next) {
  try {
    return successResponse(res, await service.getOrderDetail(req.params.id));
  } catch (err) { next(err); }
}

async function confirm(req, res, next) {
  try {
    const result = await service.confirm(req.body);
    return successResponse(res, result, result);
  } catch (err) { next(err); }
}

module.exports = { listOrders, getOrder, confirm };
