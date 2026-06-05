const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const SalesOrderItemSchema = new mongoose.Schema({
  productId: { type: String, default: '' },
  productCode: { type: String, required: true, index: true },
  productName: { type: String, default: '' },
  unit: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 0 },
  qty: { type: Number, default: 0 },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0 },
  amount: { type: Number, required: true, default: 0 },
  warehouseCode: { type: String, default: '' },
  warehouseName: { type: String, default: '' },
  isPromotion: { type: Boolean, default: false },
}, { _id: false });

const schema = createBaseSchema({
  code: { type: String, required: true, unique: true, index: true },
  normalizedCode: { type: String, required: true, unique: true, index: true },

  customerId: { type: String, default: '' },
  customerCode: { type: String, required: true, index: true },
  customerName: { type: String, required: true, index: true },
  customerPhone: { type: String, default: '' },
  customerAddress: { type: String, default: '' },

  salesStaffCode: { type: String, default: '', index: true },
  salesStaffName: { type: String, default: '' },
  deliveryStaffCode: { type: String, default: '', index: true },
  deliveryStaffName: { type: String, default: '' },
  deliveryDate: { type: String, default: '', index: true },

  source: { type: String, enum: ['MANUAL', 'DMS', 'S3', 'MOBILE', 'manual', 'dms', 's3', 'mobile'], default: 'MANUAL', index: true },
  items: { type: [SalesOrderItemSchema], default: [] },
  itemCount: { type: Number, default: 0 },

  totalAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  payableAmount: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },

  status: { type: String, enum: ['pending', 'assigned', 'delivered', 'cancelled', 'accounting_confirmed'], default: 'pending', index: true },
  deliveryStatus: { type: String, enum: ['pending', 'assigned', 'delivered', 'failed', 'cancelled'], default: 'pending', index: true },
  accountingStatus: { type: String, enum: ['pending', 'posted', 'cancelled', 'confirmed'], default: 'pending', index: true },

  masterOrderId: { type: String, default: '', index: true },
  masterOrderCode: { type: String, default: '', index: true },

  cashAmount: { type: Number, default: 0 },
  bankAmount: { type: Number, default: 0 },
  bonusAmount: { type: Number, default: 0 },
  paymentDraft: { type: Object, default: undefined },

  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String, default: '' },
  accountingConfirmed: { type: Boolean, default: false },
  accountingConfirmedAt: { type: Date },
  accountingConfirmedBy: { type: String, default: '' },
  note: { type: String, default: '' },
});

schema.index({ deliveryDate: 1, deliveryStaffCode: 1, status: 1 }, { name: 'idx_so_delivery_staff_status' });
schema.index({ deliveryDate: 1, salesStaffCode: 1, status: 1 }, { name: 'idx_so_delivery_sales_status' });
schema.index({ masterOrderId: 1 }, { name: 'idx_so_master_order_id' });
schema.index({ masterOrderCode: 1 }, { name: 'idx_so_master_order_code' });
schema.index({ customerCode: 1, deliveryDate: 1 }, { name: 'idx_so_customer_delivery_date' });

module.exports = mongoose.models.SalesOrder || mongoose.model('SalesOrder', schema, 'salesOrders');
