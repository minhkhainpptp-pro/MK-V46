'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ReturnProcessor, classifySqlError } = require('../src/returnProcessor');
const { payloadHash } = require('../src/signature');

function command() {
  const payload = {
    sourceReturnId: 'RO-1',
    customerCode: 'C1',
    sourceOrderCode: 'SO-1',
    siteId: 'MAIN',
    items: [{ productCode: 'P1', baseQuantity: 2 }]
  };
  return { eventId: 'V45:RETURN:RO-1', payload, payloadHash: payloadHash(payload) };
}

function mocks(sqlResult) {
  const calls = [];
  return {
    calls,
    v45Client: {
      completeReturnCommand: async (...args) => calls.push(['complete', ...args]),
      deferReturnCommand: async (...args) => calls.push(['defer', ...args]),
      failReturnCommand: async (...args) => calls.push(['fail', ...args]),
      claimReturnCommands: async () => ({ commands: [] })
    },
    sqlRepository: { createReturnReceipt: async () => sqlResult },
    logger: { info() {}, warn() {}, error() {} }
  };
}

test('posted receipt completes V45 command', async () => {
  const m = mocks({ status: 'posted', s3INNbr: 'TK001' });
  const processor = new ReturnProcessor({ config: { stagedRetrySeconds: 300 }, ...m });
  const result = await processor.processCommand(command());
  assert.equal(result.status, 'completed');
  assert.equal(m.calls[0][0], 'complete');
  assert.equal(m.calls[0][2].s3ReceiptCode, 'TK001');
});

test('staged request is deferred, never falsely completed', async () => {
  const m = mocks({ status: 'staged', s3INNbr: '' });
  const processor = new ReturnProcessor({ config: { stagedRetrySeconds: 300 }, ...m });
  const result = await processor.processCommand(command());
  assert.equal(result.status, 'deferred');
  assert.equal(m.calls[0][0], 'defer');
});

test('payload hash mismatch is non-retryable failure', async () => {
  const m = mocks({ status: 'posted', s3INNbr: 'TK001' });
  const processor = new ReturnProcessor({ config: { stagedRetrySeconds: 300 }, ...m });
  const invalid = command();
  invalid.payloadHash = '0'.repeat(64);
  const result = await processor.processCommand(invalid);
  assert.equal(result.status, 'failed');
  assert.equal(m.calls[0][0], 'fail');
  assert.equal(m.calls[0][2].retryable, false);
});

test('SQL validation errors are non-retryable', () => {
  assert.equal(classifySqlError({ number: 51004, message: 'bad customer' }).retryable, false);
  assert.equal(classifySqlError({ number: 1205, message: 'deadlock' }).retryable, true);
});
