'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlDir = path.resolve(__dirname, '../integration/s3-bridge/sql');
const read = (name) => fs.readFileSync(path.join(sqlDir, name), 'utf8');

test('core adapter is fail-closed until implemented', () => {
  const sql = read('010_create_guarded_return_orchestrator.sql');
  assert.match(sql, /S3 core adapter chưa được triển khai\/xác minh/i);
  assert.match(sql, /S3_CORE_ADAPTER_VERSION[^]*UNIMPLEMENTED/i);
  assert.match(sql, /S3_CONTRACT_FINGERPRINT[^]*UNVERIFIED/i);
});

test('orchestrator stages first and refuses unverified auto-post', () => {
  const sql = read('010_create_guarded_return_orchestrator.sql');
  const stageAt = sql.indexOf('sp_StageReturnReceiptRequest');
  const coreAt = sql.indexOf('sp_PostReturnReceiptCore', stageAt + 1);
  assert.ok(stageAt >= 0 && coreAt > stageAt);
  assert.match(sql, /RETURN_AUTO_POST_ENABLED/i);
  assert.match(sql, /Contract database S3 chưa được xác minh|contract database S3 chưa được xác minh/i);
});

test('bridge role cannot mark a receipt posted directly', () => {
  const sql = read('011_harden_bridge_permissions.sql');
  assert.match(sql, /REVOKE EXECUTE ON OBJECT::v45_int\.sp_MarkReturnReceiptPosted/i);
  assert.match(sql, /GRANT EXECUTE ON OBJECT::v45_int\.sp_CreateReturnReceipt/i);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON OBJECT::v45_int\.sp_SetReturnAutoPostEnabled/i);
});

test('core implementation template cannot be executed accidentally', () => {
  const sql = read('012_core_adapter_implementation_template.sql');
  assert.match(sql, /^\/\*/);
  assert.match(sql, /THROW 51130/i);
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+(?:dbo\.)?s3_/i);
  assert.doesNotMatch(sql, /UPDATE\s+(?:dbo\.)?s3_/i);
});

test('contract probe is metadata read-only', () => {
  const sql = read('006_probe_s3_contract.sql');
  assert.match(sql, /sys\.columns/i);
  assert.match(sql, /OBJECT_DEFINITION/i);
  assert.doesNotMatch(sql, /\bINSERT\s+INTO\s+(?:dbo\.)?s3_/i);
  assert.doesNotMatch(sql, /\bUPDATE\s+(?:dbo\.)?s3_/i);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\s+(?:dbo\.)?s3_/i);
});
