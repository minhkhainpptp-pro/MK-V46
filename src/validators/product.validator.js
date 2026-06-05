const { requireText, toNumber } = require('./base.validator');

function validateProductPayload(body = {}) {
  const code = requireText(body.code, 'Thiếu mã sản phẩm');
  const name = requireText(body.name, 'Thiếu tên sản phẩm');
  return {
    ...body,
    code,
    name,
    salePrice: toNumber(body.salePrice, 'Giá bán', { min: 0 }),
    costPrice: toNumber(body.costPrice, 'Giá vốn', { min: 0 }),
    conversionRate: toNumber(body.conversionRate || 1, 'Quy cách', { min: 0 }),
  };
}

module.exports = { validateProductPayload };
