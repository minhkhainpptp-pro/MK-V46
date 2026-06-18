'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve(__dirname, '../integration/s3-bridge/sql');
const contract = fs.readFileSync(path.join(dir, '020_create_master_order_read_contract.sql'), 'utf8');
const template = fs.readFileSync(path.join(dir, '021_master_order_adapter_template.sql'), 'utf8');

test('master order adapter is disabled and fail-closed by default', () => {
  assert.match(contract, /MASTER_ORDER_READ_ENABLED[\s\S]*false/i);
  assert.match(contract, /MASTER_ORDER_ADAPTER_VERSION[\s\S]*UNIMPLEMENTED/i);
  assert.match(contract, /Master-order SQL adapter chưa được triển khai\/xác minh/i);
});

test('master order dispatch uses a stable event/source version uniqueness contract', () => {
  assert.match(contract, /PRIMARY KEY \(EventId\)/i);
  assert.match(contract, /UNIQUE \(SourceMasterOrderId, SourceVersion\)/i);
  assert.match(contract, /PayloadHash CHAR\(64\)/i);
});

test('adapter template is read-only and cannot be deployed accidentally', () => {
  assert.match(template, /THROW 51210/i);
  assert.doesNotMatch(template, /\bINSERT\s+INTO\s+(?:dbo\.)?s3_/i);
  assert.doesNotMatch(template, /\bUPDATE\s+(?:dbo\.)?s3_/i);
  assert.doesNotMatch(template, /\bDELETE\s+FROM\s+(?:dbo\.)?s3_/i);
});
