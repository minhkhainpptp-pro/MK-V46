const mongoose = require('mongoose');
const OperationLog = require('../models/OperationLog');

function cleanText(value) {
  return String(value || '').trim();
}

function duplicateOperationError(operationId) {
  return Object.assign(new Error(`Nghiệp vụ đã được xử lý hoặc đang xử lý: ${operationId}`), { status: 409 });
}

async function acquireOperation({ operationId, type, referenceId = '', referenceCode = '', userCode = '' }, session) {
  const id = cleanText(operationId);
  if (!id) return null;

  try {
    const [log] = await OperationLog.create([{
      operationId: id,
      type: cleanText(type),
      referenceId: cleanText(referenceId),
      referenceCode: cleanText(referenceCode),
      userCode: cleanText(userCode),
      status: 'started',
    }], session ? { session } : undefined);
    return log;
  } catch (err) {
    if (err && err.code === 11000) throw duplicateOperationError(id);
    throw err;
  }
}

async function completeOperation(operationId, resultSummary = {}, session) {
  const id = cleanText(operationId);
  if (!id) return null;
  return OperationLog.updateOne(
    { operationId: id },
    { $set: { status: 'completed', resultSummary, errorMessage: '' } },
    session ? { session } : undefined
  );
}

async function failOperation(operationId, error, session) {
  const id = cleanText(operationId);
  if (!id) return null;
  return OperationLog.updateOne(
    { operationId: id },
    { $set: { status: 'failed', errorMessage: error && error.message ? error.message : String(error || '') } },
    session ? { session } : undefined
  );
}

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  acquireOperation,
  completeOperation,
  failOperation,
  withTransaction,
};
