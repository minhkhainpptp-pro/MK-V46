function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}
function roundMoney(value) {
  return Math.round(toNumber(value));
}
module.exports = { toNumber, roundMoney };
