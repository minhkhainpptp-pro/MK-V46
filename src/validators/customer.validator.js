const { requireText } = require('./base.validator');

function validateCustomerPayload(body = {}) {
  const customerCode = requireText(body.customerCode || body.code, 'Thiếu mã khách hàng');
  const customerName = requireText(body.customerName || body.name, 'Thiếu tên khách hàng');
  return {
    ...body,
    code: customerCode,
    customerCode,
    name: customerName,
    customerName,
  };
}

module.exports = { validateCustomerPayload };
