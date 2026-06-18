'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { V45Client } = require('../src/v45Client');

test('GET health does not send a request body', async () => {
  let options;
  const client = new V45Client({
    v45BaseUrl: 'https://example.test',
    integrationKey: 'key',
    integrationSecret: 'x'.repeat(32),
    agentId: 'agent'
  }, {
    fetch: async (_url, requestOptions) => {
      options = requestOptions;
      return { ok: true, status: 200, text: async () => '{"success":true}' };
    }
  });
  await client.health();
  assert.equal(options.method, 'GET');
  assert.equal(Object.hasOwn(options, 'body'), false);
});
