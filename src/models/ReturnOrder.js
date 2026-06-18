const flexModel = require('./_flexModel');
module.exports = flexModel('ReturnOrder', 'returnOrders', {
  id: String,
  code: String,
  customerId: String,
  customerCode: String,
  customerName: String,

  // Khai báo rõ các field được dùng trong strictQuery và tìm kiếm.
  date: String,
  documentDate: String,
  deliveryDate: String,
  returnDate: String,
  salesStaffId: String,
  salesStaffCode: String,
  salesStaffName: String,
  salesmanCode: String,
  salesmanName: String,
  deliveryStaffId: String,
  deliveryStaffCode: String,
  deliveryStaffName: String,
  deliveryCode: String,
  deliveryName: String,
  nvghCode: String,
  nvghName: String,
  nvbhCode: String,
  nvbhName: String,
  note: String,

  sourceOrderId: String,
  salesOrderId: String,
  salesOrderCode: String,
  orderId: String,
  orderCode: String,
  masterOrderId: String,
  masterOrderCode: String,
  items: Array,
  amount: Number,
  returnAmount: Number,
  status: String,
  returnStatus: String,

  // A5 - Return state machine
  returnState: String,
  stateChangedAt: String,
  stateChangedBy: String,
  stateHistory: Array,

  // Trạng thái gộp tách biệt hoàn toàn với vòng đời phiếu trả.
  returnMergeStatus: String,
  masterReturnOrderId: String,
  masterReturnOrderCode: String,

  warehouseStatus: String,
  warehouseReceiveStatus: String,
  stockReceiveStatus: String,
  stockPosted: Boolean,
  stockPostedAt: String,
  receivedAt: String,
  receivedBy: String,

  accountingStatus: String,
  accountingConfirmed: Boolean,
  accountingConfirmedAt: String,
  accountingBatchId: String,
  accountingConfirmedBy: String,
  accountingNote: String,

  arPosted: Boolean,
  arPostedAt: String,
  arLedgerId: String,

  // Integration status is separate from business returnState. In S3 mode,
  // accounting confirmation creates an outbox command instead of local stock/AR posting.
  s3SyncStatus: { type: String, default: 'not_requested' },
  s3SyncEventId: String,
  s3SyncAttemptCount: { type: Number, default: 0 },
  s3SyncError: Object,
  s3SyncRequestedAt: String,
  s3SyncCompletedAt: String,
  s3ReceiptId: String,
  s3ReceiptCode: String,
  s3ReceiptDate: String,
  s3PostedAt: String,

  createdAt: String,
  updatedAt: String
});
