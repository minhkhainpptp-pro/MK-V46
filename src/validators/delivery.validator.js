const { requireText, toNumber } = require('./base.validator');
const { DELIVERY_STATUS, assertAllowedStatus } = require('../constants/status.constants');

function validateDeliveryConfirmPayload(body = {}) {
  requireText(body.salesOrderId, 'Thiếu mã đơn bán');
  const deliveryStatus = body.deliveryStatus || DELIVERY_STATUS.DELIVERED;
  assertAllowedStatus(deliveryStatus, DELIVERY_STATUS, 'Trạng thái giao hàng');

  for (const line of body.returnLines || []) {
    requireText(line.productCode, 'Thiếu mã sản phẩm trả');
    toNumber(line.returnQty, 'Số lượng trả', { min: 0 });
  }

  toNumber(body.cashAmount, 'Tiền mặt', { min: 0 });
  toNumber(body.bankAmount, 'Chuyển khoản', { min: 0 });
  toNumber(body.bonusAmount, 'Trả thưởng', { min: 0 });
  return { ...body, deliveryStatus };
}

module.exports = { validateDeliveryConfirmPayload };
