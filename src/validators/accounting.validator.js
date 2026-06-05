const { requireText } = require('./base.validator');

function validateAccountingConfirmPayload(body = {}) {
  requireText(body.salesOrderId || body.masterOrderId, 'Thiếu mã đơn cần xác nhận kế toán');
  return body;
}

module.exports = { validateAccountingConfirmPayload };
