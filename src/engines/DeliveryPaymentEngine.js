function normalizePayment(input = {}) {
  return {
    cashAmount: Number(input.cashAmount || 0),
    bankAmount: Number(input.bankAmount || 0),
    bonusAmount: Number(input.bonusAmount || 0),
  };
}
module.exports = { normalizePayment };
