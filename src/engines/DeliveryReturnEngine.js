function normalizeReturnLines(lines = []) {
  return (Array.isArray(lines) ? lines : []).map((line) => ({
    ...line,
    returnQty: Number(line.returnQty || 0),
  })).filter((line) => line.returnQty > 0);
}
module.exports = { normalizeReturnLines };
