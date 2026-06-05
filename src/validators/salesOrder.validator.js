const { requireText, requireArray, toNumber } = require('./base.validator');
const { SALES_ORDER_STATUS, assertAllowedStatus } = require('../constants/status.constants');

function validateSalesOrderPayload(body = {}) {
  requireText(body.customerCode, 'Thiếu mã khách hàng');
  requireText(body.customerName, 'Thiếu tên khách hàng');
  const items = requireArray(body.items, 'Đơn hàng phải có sản phẩm');
  for (const item of items) {
    requireText(item.productCode, 'Thiếu mã sản phẩm');
    toNumber(item.quantity ?? item.qty, 'Số lượng', { min: 0 });
    toNumber(item.price, 'Đơn giá', { min: 0 });
  }
  if (body.status) assertAllowedStatus(body.status, SALES_ORDER_STATUS, 'Trạng thái đơn bán');
  return body;
}

module.exports = { validateSalesOrderPayload };
