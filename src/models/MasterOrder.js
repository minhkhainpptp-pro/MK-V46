const flexModel = require('./_flexModel');
module.exports = flexModel('MasterOrder', 'master_orders', {
  id: String,
  code: String,
  childOrderIds: Array,
  childOrderCodes: Array,
  children: Array,
  deliveryStaffId: String,
  deliveryStaffCode: String,
  deliveryStaffName: String,

  // Immutable S3 mirror identity. V45 owns only execution fields.
  sourceSystem: String,
  sourceMasterOrderId: String,
  sourceVersion: String,
  sourceHash: String,
  sourceUpdatedAt: String,
  sourceImportedAt: String,
  sourceSyncRunId: String,
  sourceActive: { type: Boolean, default: true },
  sourceReadOnly: { type: Boolean, default: false },

  executionStatus: String,
  executionStartedAt: String,
  executionCompletedAt: String,
  executionVersion: { type: Number, default: 0 },
  syncConflict: { type: Boolean, default: false },
  syncConflictReason: String,
  syncConflictAt: String,
  pendingSourceHash: String,
  pendingSourcePayload: Object,

  masterOrderDate: String,
  deliveryDate: String,
  routeName: String,
  note: String,
  deliveryNote: String,
  status: String,
  totalAmount: Number,
  createdAt: String,
  updatedAt: String
});
