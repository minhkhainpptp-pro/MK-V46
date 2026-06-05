const mongoose = require('mongoose');
const { generateId } = require('../utils/id.util');

const BaseFields = {
  id: { type: String, index: true },
  code: { type: String, index: true },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
  status: { type: String, default: 'active', index: true },
};

function createBaseSchema(fields = {}) {
  const schema = new mongoose.Schema(
    { ...BaseFields, ...fields },
    { timestamps: true }
  );

  schema.index({ id: 1 });
  schema.index({ code: 1 });
  schema.index({ status: 1 });

  // Mongoose 8 supports promise/sync middleware. Do not call next() here;
  // Render was failing on POST with: "next is not a function".
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
