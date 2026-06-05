function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value) {
  return String(value || '').trim();
}

function requireText(value, message) {
  const text = cleanText(value);
  if (!text) throw httpError(message, 400);
  return text;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function requirePositiveNumber(value, message) {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n) || n <= 0) throw httpError(message, 400);
  return n;
}

function requireNonNegativeNumber(value, message) {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n) || n < 0) throw httpError(message, 400);
  return n;
}

function validateProductPayload(input = {}) {
  return {
    code: requireText(input.code, 'Thiếu mã sản phẩm'),
    name: requireText(input.name, 'Thiếu tên sản phẩm'),
    salePrice: requireNonNegativeNumber(input.salePrice || 0, 'Giá bán không được âm'),
    costPrice: requireNonNegativeNumber(input.costPrice || 0, 'Giá vốn không được âm'),
    conversionRate: requirePositiveNumber(input.conversionRate || 1, 'Quy cách phải lớn hơn 0'),
  };
}

function validateCustomerPayload(input = {}) {
  return {
    customerCode: requireText(input.customerCode || input.code, 'Thiếu mã khách hàng'),
    customerName: requireText(input.customerName || input.name, 'Thiếu tên khách hàng'),
  };
}

function validateSalesOrderPayload(input = {}) {
  requireText(input.customerCode || input.customerId, 'Thiếu mã khách hàng');
  if (!Array.isArray(input.items) || !input.items.length) throw httpError('Đơn hàng phải có ít nhất 1 sản phẩm', 400);
  input.items.forEach((item, index) => {
    requireText(item.productCode || item.code, `Dòng ${index + 1}: thiếu mã sản phẩm`);
    requirePositiveNumber(item.quantity ?? item.qty, `Dòng ${index + 1}: số lượng phải lớn hơn 0`);
    requireNonNegativeNumber(item.price ?? item.salePrice ?? 0, `Dòng ${index + 1}: đơn giá không được âm`);
  });
}

function validateReturnPayload(input = {}) {
  requireText(input.salesOrderId || input.salesOrderCode || input.id || input.code, 'Thiếu salesOrderId hoặc salesOrderCode');
  const rows = input.items || input.returnLines;
  if (!Array.isArray(rows) || !rows.length) throw httpError('Phiếu trả phải có ít nhất 1 dòng hàng', 400);
  rows.forEach((item, index) => {
    requireText(item.productCode, `Dòng ${index + 1}: thiếu mã sản phẩm`);
    requireNonNegativeNumber(item.returnQty || 0, `Dòng ${index + 1}: số lượng trả không được âm`);
  });
}

module.exports = {
  httpError,
  cleanText,
  requireText,
  requirePositiveNumber,
  requireNonNegativeNumber,
  validateProductPayload,
  validateCustomerPayload,
  validateSalesOrderPayload,
  validateReturnPayload,
};
