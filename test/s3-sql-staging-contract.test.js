'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlDir = path.resolve(__dirname, '../integration/s3-bridge/sql');
const read = (name) => fs.readFileSync(path.join(sqlDir, name), 'utf8');

test('staging schema keeps auto-post disabled by default', () => {
  const sql = read('001_create_schema.sql');
  assert.match(sql, /RETURN_AUTO_POST_ENABLED[\s\S]*false/i);
});

test('return staging uses idempotency key, transaction and application lock', () => {
  const sql = read('003_create_staging_procedures.sql');
  assert.match(sql, /sp_getapplock/i);
  assert.match(sql, /PayloadHash/i);
  assert.match(sql, /BEGIN TRANSACTION/i);
  assert.match(sql, /XACT_ABORT ON/i);
  assert.match(sql, /Phiếu trả đã tồn tại nhưng payload khác/i);
});

test('step 9 scripts do not mutate S3 core inventory tables', () => {
  const files = fs.readdirSync(sqlDir).filter((name) => name.endsWith('.sql') && !name.startsWith('005_'));
  const all = files.map(read).join('\n');
  const prohibited = [
    /\bINSERT\s+INTO\s+(?:dbo\.)?s3_/i,
    /\bUPDATE\s+(?:dbo\.)?s3_/i,
    /\bDELETE\s+FROM\s+(?:dbo\.)?s3_/i,
    /\bEXEC(?:UTE)?\s+(?:dbo\.)?s3_INDoc_sp_Post/i
  ];
  for (const pattern of prohibited) assert.doesNotMatch(all, pattern);
});

test('bridge writer receives procedure execution only, not table write grants', () => {
  const sql = read('004_create_roles_and_permissions.sql');
  assert.match(sql, /GRANT EXECUTE ON OBJECT::v45_int\.sp_StageReturnReceiptRequest/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:INSERT|UPDATE|DELETE).*v45_bridge_return_writer/i);
});

test('rollback disables integration without dropping audit data', () => {
  const sql = read('099_disable_integration.sql');
  assert.match(sql, /RETURN_STAGING_ENABLED/i);
  assert.match(sql, /RETURN_AUTO_POST_ENABLED/i);
  assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|SCHEMA)/i);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM/i);
});
