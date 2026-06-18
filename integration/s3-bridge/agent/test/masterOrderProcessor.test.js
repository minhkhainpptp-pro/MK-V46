'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MasterOrderProcessor } = require('../src/masterOrderProcessor');
const { payloadHash } = require('../src/signature');

function row() {
  const payload = {
    eventId: 'S3:MASTER:M1:V1',
    sourceMasterOrderId: 'M1',
    sourceVersion: 'V1',
    orders: [{ sourceOrderId: 'SO1', items: [{ productCode: 'P1', quantityBaseUnit: 1 }] }]
  };
  return {
    eventId: payload.eventId,
    sourceMasterOrderId: 'M1',
    sourceVersion: 'V1',
    sourceCursor: 'CURSOR1',
    payload,
    payloadHash: payloadHash(payload)
  };
}

function createMocks(apiResult = {}) {
  const calls = [];
  return {
    calls,
    v45Client: { upsertMasterOrder: async (payload) => { calls.push(['api', payload]); return apiResult; } },
    repository: {
      recordDispatch: async (...args) => calls.push(['record', ...args]),
      saveCheckpoint: async (...args) => calls.push(['checkpoint', ...args]),
      getCheckpoint: async () => '',
      readCompletedMasterOrders: async () => []
    },
    logger: { info() {}, warn() {}, error() {} }
  };
}

test('successful upsert records dispatch then advances checkpoint', async () => {
  const m = createMocks({ duplicate: false, conflict: false });
  const processor = new MasterOrderProcessor({ config: { masterOrderBatchSize: 20 }, ...m });
  const result = await processor.processRow(row());
  assert.equal(result.status, 'completed');
  assert.deepEqual(m.calls.map((x) => x[0]), ['api', 'record', 'checkpoint']);
});

test('conflict is acknowledged and checkpoint advances', async () => {
  const m = createMocks({ conflict: true });
  const processor = new MasterOrderProcessor({ config: {}, ...m });
  const result = await processor.processRow(row());
  assert.equal(result.status, 'conflict');
  assert.equal(m.calls[1][2], 'conflict');
});

test('hash mismatch does not call V45 and records failure', async () => {
  const m = createMocks();
  const invalid = row();
  invalid.payloadHash = 'f'.repeat(64);
  const processor = new MasterOrderProcessor({ config: {}, ...m });
  const result = await processor.processRow(invalid);
  assert.equal(result.status, 'failed');
  assert.equal(m.calls[0][0], 'record');
});
