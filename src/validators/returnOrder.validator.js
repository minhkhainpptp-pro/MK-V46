const { requireText, requireArray, toNumber } = require('./base.validator');

function validateReturnOrderPayload(body = {}) {
  requireText(body.salesOrderId, 'Thiếu mã đơn bán');
  const lines = requireArray(body.returnLines || body.items || body.lines, 'Phiếu trả phải có sản phẩm');
  for (const line of lines) {
    requireText(line.productCode, 'Thiếu mã sản phẩm trả');
    toNumber(line.returnQty ?? line.quantity ?? line.qty, 'Số lượng trả', { min: 0 });
  }
  return body;
}

module.exports = { validateReturnOrderPayload };
