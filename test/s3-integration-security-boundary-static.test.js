'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }

test('S3 routes are mounted behind dedicated HMAC middleware', () => {
  const routes = read('src/routes/s3IntegrationRoutes.js');
  const index = read('src/routes/index.js');
  assert.match(routes, /router\.use\(integrationLimiter, s3IntegrationAuth\)/);
  assert.match(index, /\/api\/integrations\/s3/);
});

test('global JWT boundary exempts only the S3 integration namespace for dedicated auth', () => {
  const security = read('src/middlewares/apiSecurity.middleware.js');
  assert.match(security, /integrations\\\/s3/);
  assert.match(security, /method === '\*'/);
});

test('raw JSON bytes are preserved only for S3 signature verification', () => {
  const app = read('src/app.js');
  assert.match(app, /req\.rawBody = Buffer\.from\(buffer\)/);
  assert.match(app, /startsWith\('\/api\/integrations\/s3'\)/);
});
