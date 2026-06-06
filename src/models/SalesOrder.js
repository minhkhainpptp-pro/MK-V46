const mongoose = require('mongoose');
const { createBaseSchema } = require('../core/baseSchema');

const SalesOrderItemSchema = new mongoose.Schema({
  productId: { type: String, default: '' },
  productCode: { type: String, required: true },
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
  code: { type: String, required: true, unique: true },
  normalizedCode: { type: String, required: true, unique: true },

  customerId: { type: String, default: '' },
  customerCode: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, default: '' },
  customerAddress: { type: String, default: '' },

  salesStaffCode: { type: String, default: '' },
  salesStaffName: { type: String, default: '' },
  deliveryStaffCode: { type: String, default: '' },
  deliveryStaffName: { type: String, default: '' },
  deliveryDate: { type: String, default: '' },

  source: { type: String, enum: ['MANUAL', 'DMS', 'S3', 'MOBILE', 'manual', 'dms', 's3', 'mobile'], default: 'MANUAL' },
  items: { type: [SalesOrderItemSchema], default: [] },
  itemCount: { type: Number, default: 0 },

  totalAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  payableAmount: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },

  status: { type: String, enum: ['pending', 'assigned', 'delivered', 'cancelled', 'accounting_confirmed'], default: 'pending' },
  deliveryStatus: { type: String, enum: ['pending', 'assigned', 'delivered', 'failed', 'cancelled'], default: 'pending' },
  accountingStatus: { type: String, enum: ['pending', 'posted', 'cancelled', 'confirmed'], default: 'pending' },

  masterOrderId: { type: String, default: '' },
  masterOrderCode: { type: String, default: '' },

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

schema.index({ id: 1 }, { name: 'idx_so_id' });
schema.index({ deliveryDate: 1, status: 1 }, { name: 'idx_so_delivery_status' });
schema.index({ deliveryDate: 1, deliveryStaffCode: 1, status: 1 }, { name: 'idx_so_delivery_staff_status' });
schema.index({ deliveryDate: 1, salesStaffCode: 1, status: 1 }, { name: 'idx_so_delivery_sales_status' });
schema.index({ masterOrderId: 1 }, { name: 'idx_so_master_order_id' });
schema.index({ masterOrderCode: 1 }, { name: 'idx_so_master_order_code' });
schema.index({ customerCode: 1, deliveryDate: 1 }, { name: 'idx_so_customer_delivery_date' });

module.exports = mongoose.models.SalesOrder || mongoose.model('SalesOrder', schema, 'salesOrders');
