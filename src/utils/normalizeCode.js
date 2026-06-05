function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toUpperCase();
}

function normalizeOrderCode(value) {
  return normalizeText(value).replace(/[^A-Z0-9]/g, '');
}

function uniqClean(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

module.exports = { normalizeText, normalizeOrderCode, uniqClean };
