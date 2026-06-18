'use strict';

const { loadConfig } = require('../src/config');
const { V45Client } = require('../src/v45Client');

async function main() {
  const config = loadConfig();
  const client = new V45Client(config);
  const result = await client.health();
  console.log(JSON.stringify({ ok: true, agentId: config.agentId, result }, null, 2));
  if (result?.status === 'critical') process.exitCode = 2;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, code: error.code, message: error.message }, null, 2));
  process.exitCode = 1;
});
