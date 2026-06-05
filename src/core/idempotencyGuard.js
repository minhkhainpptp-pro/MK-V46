const {
  acquireOperation,
  completeOperation,
  failOperation,
} = require('./operationGuard');

async function runIdempotentOperation(meta, work, session) {
  const operationId = meta && meta.operationId;
  await acquireOperation(meta, session);
  try {
    const result = await work();
    await completeOperation(operationId, {
      ok: true,
      referenceId: meta && meta.referenceId,
      referenceCode: meta && meta.referenceCode,
    }, session);
    return result;
  } catch (err) {
    await failOperation(operationId, err, session);
    throw err;
  }
}

module.exports = { runIdempotentOperation };
