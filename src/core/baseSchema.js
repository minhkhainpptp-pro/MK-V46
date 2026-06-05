const mongoose = require('mongoose');
const { generateId } = require('../utils/id.util');

const BaseFields = {
  id: { type: String },
  code: { type: String },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
  status: { type: String, default: 'active' },
};

function createBaseSchema(fields = {}) {
  const schema = new mongoose.Schema(
    { ...BaseFields, ...fields },
    { timestamps: true }
  );

  // Only declare shared base indexes once here. Business-specific indexes
  // (code unique, status+date, customerCode...) must stay in each model or
  // ensureMongoIndexes.js to avoid duplicate schema index warnings.
  schema.index({ id: 1 }, { name: 'idx_base_id' });

  // Mongoose 8 supports promise/sync middleware. Do not call next() here.
  schema.pre('validate', function assignStableId() {
    if (!this.id) this.id = generateId();
  });

  schema.virtual('_key').get(function getKey() {
    return this.id;
  });

  schema.set('toJSON', { virtuals: true });
  schema.set('toObject', { virtuals: true });

  return schema;
}

module.exports = { createBaseSchema };
