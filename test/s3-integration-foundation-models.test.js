'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('../src/models');
const { INDEX_DEFINITIONS, buildManagedIndexPlan } = require('../src/services/mongoIndexService');

const EXPECTED = {
  integrationInboxes: 'integrationInboxes',
  integrationOutboxes: 'integrationOutboxes',
  s3SyncCheckpoints: 's3SyncCheckpoints',
  s3SyncRuns: 's3SyncRuns',
  s3InventoryBalances: 's3InventoryBalances',
  s3IntegrationErrors: 's3IntegrationErrors'
};

test('Step 3 registers all S3 integration foundation models', () => {
  for (const [key, collectionName] of Object.entries(EXPECTED)) {
    assert.ok(models[key], `${key} model must be exported`);
    assert.equal(models[key].collection.collectionName, collectionName);
    assert.ok(INDEX_DEFINITIONS[key], `${key} managed indexes must exist`);
  }
});

test('integration inbox/outbox event ids are protected by unique managed indexes', () => {
  const inboxUnique = INDEX_DEFINITIONS.integrationInboxes.find(([fields, options]) => fields.eventId === 1 && options.unique);
  const outboxUnique = INDEX_DEFINITIONS.integrationOutboxes.find(([fields, options]) => fields.eventId === 1 && options.unique);
  assert.ok(inboxUnique);
  assert.ok(outboxUnique);
});

test('S3 inventory mirror is isolated from local inventories and marked read-only by schema default', () => {
  assert.notEqual(models.s3InventoryBalances.collection.collectionName, models.inventories.collection.collectionName);
  assert.equal(models.s3InventoryBalances.schema.path('readOnly').defaultValue, true);
  assert.equal(models.s3InventoryBalances.schema.path('sourceSystem').defaultValue, 'S3');
});

test('managed index plan has no conflicting physical collection definitions', () => {
  assert.doesNotThrow(() => buildManagedIndexPlan());
});
