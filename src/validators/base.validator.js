function error(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function requireText(value, message) {
  const text = String(value || '').trim();
  if (!text) throw error(message);
  return text;
}

function toNumber(value, fieldName, { min = 0 } = {}) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) throw error(`${fieldName} không hợp lệ`);
  if (num < min) throw error(`${fieldName} không được nhỏ hơn ${min}`);
  return num;
}

function requireArray(value, message) {
  if (!Array.isArray(value) || value.length === 0) throw error(message);
  return value;
}

module.exports = { error, requireText, toNumber, requireArray };
