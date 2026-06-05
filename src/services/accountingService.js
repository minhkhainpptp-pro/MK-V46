const mongoose = require('mongoose');
const MasterOrder = require('../models/MasterOrder');
const SalesOrder = require('../models/SalesOrder');
const ReturnOrder = require('../models/ReturnOrder');
const ArLedger = require('../models/ArLedger');
const FundLedger = require('../models/FundLedger');
const Inventory = require('../models/Inventory');
const Journal = require('../models/Journal');
const { roundMoney } = require('../utils/money.util');

function httpError(message, status = 400) { return Object.assign(new Error(message), { status }); }
function cleanText(value) { return String(value || '').trim(); }
function today() { return new Date().toISOString().slice(0, 10); }
function amountOf(value) { return roundMoney(Number(value || 0)); }
function makeCode(prefix, sourceCode) { return `${prefix}-${cleanText(sourceCode) || Date.now()}`; }
function sourceKey(doc) { return cleanText(doc && (doc.id || doc._id)); }

function buildOrderLookup(key) {
  const value = cleanText(key);
  if (!value) return null;
  const or = [{ id: value }, { code: value }];
  if (mongoose.Types.ObjectId.isValid(value)) or.push({ _id: value });
  return { $or: or };
}

async function createArOnce(payload) {
  const sourceType = cleanText(payload.sourceType);
  const sourceId = cleanText(payload.sourceId);
  const type = cleanText(payload.type);
  if (sourceType && sourceId && type) {
    const existed = await ArLedger.findOne({ sourceType, sourceId, type }).lean();
    if (existed) return existed;
  }
  const doc = await ArLedger.create({
    id: cleanText(payload.id) || makeCode('AR', `${type}-${sourceId}`),
    code: cleanText(payload.code) || makeCode(type, payload.sourceCode || sourceId),
    type,
    date: cleanText(payload.date) || today(),
    customerCode: cleanText(payload.customerCode),
    customerName: cleanText(payload.customerName),
    salesOrderId: cleanText(payload.salesOrderId),
    salesOrderCode: cleanText(payload.salesOrderCode),
    masterOrderId: cleanText(payload.masterOrderId),
    masterOrderCode: cleanText(payload.masterOrderCode),
    debit: amountOf(payload.debit),
    credit: amountOf(payload.credit),
    amount: amountOf(payload.amount || payload.debit || payload.credit),
    note: cleanText(payload.note),
    sourceType,
    sourceId,
    sourceCode: cleanText(payload.sourceCode),
    createdBy: cleanText(payload.createdBy),
  });
  return doc.toObject();
}

async function createFundOnce(payload) {
  const sourceType = cleanText(payload.sourceType);
  const sourceId = cleanText(payload.sourceId);
  const type = cleanText(payload.type);
  if (sourceType && sourceId && type) {
    const existed = await FundLedger.findOne({ sourceType, sourceId, type }).lean();
    if (existed) return existed;
  }
  const amount = amountOf(payload.amount);
  if (amount <= 0) return null;
  const doc = await FundLedger.create({
    id: cleanText(payload.id) || makeCode('FL', `${type}-${sourceId}`),
    code: cleanText(payload.code) || makeCode(type, payload.sourceCode || sourceId),
    type,
    method: cleanText(payload.method) || (type === 'BANK_RECEIPT' ? 'bank' : 'cash'),
    amount,
    date: cleanText(payload.date) || today(),
    customerCode: cleanText(payload.customerCode),
    customerName: cleanText(payload.customerName),
    salesOrderId: cleanText(payload.salesOrderId),
    salesOrderCode: cleanText(payload.salesOrderCode),
    masterOrderId: cleanText(payload.masterOrderId),
    masterOrderCode: cleanText(payload.masterOrderCode),
    note: cleanText(payload.note),
    sourceType,
    sourceId,
    createdBy: cleanText(payload.createdBy),
  });
  return doc.toObject();
}

async function createInventoryOnce(payload) {
  const sourceType = cleanText(payload.referenceType || payload.sourceType);
  const sourceId = cleanText(payload.referenceId || payload.sourceId);
  const transactionType = cleanText(payload.transactionType);
  const productCode = cleanText(payload.productCode);
  if (sourceType && sourceId && transactionType && productCode) {
    const existed = await Inventory.findOne({ referenceType: sourceType, referenceId: sourceId, transactionType, productCode }).lean();
    if (existed) return existed;
  }
  const qty = Number(payload.qty || 0);
  if (!qty) return null;
  const doc = await Inventory.create({
    transactionType,
    productId: cleanText(payload.productId || payload.productCode),
    productCode,
    productName: cleanText(payload.productName),
    warehouseId: cleanText(payload.warehouseId || payload.warehouseCode || 'DEFAULT'),
    warehouseCode: cleanText(payload.warehouseCode || 'DEFAULT'),
    warehouseName: cleanText(payload.warehouseName),
    qty,
    unit: cleanText(payload.unit),
    referenceType: sourceType,
    referenceId: sourceId,
    referenceCode: cleanText(payload.referenceCode || payload.sourceCode),
    note: cleanText(payload.note),
    createdBy: cleanText(payload.createdBy),
  });
  return doc.toObject();
}

async function createJournalOnce(payload) {
  const sourceType = cleanText(payload.sourceType);
  const sourceId = cleanText(payload.sourceId);
  const type = cleanText(payload.type);
  if (sourceType && sourceId && type) {
    const existed = await Journal.findOne({ sourceType, sourceId, type }).lean();
    if (existed) return existed;
  }
  const amount = amountOf(payload.amount);
  if (amount <= 0) return null;
  const doc = await Journal.create({
    id: cleanText(payload.id) || makeCode('JNL', `${type}-${sourceId}`),
    code: cleanText(payload.code) || makeCode(`JNL-${type}`, payload.sourceCode || sourceId),
    type,
    date: cleanText(payload.date) || today(),
    customerCode: cleanText(payload.customerCode),
    customerName: cleanText(payload.customerName),
    salesOrderId: cleanText(payload.salesOrderId),
    salesOrderCode: cleanText(payload.salesOrderCode),
    masterOrderId: cleanText(payload.masterOrderId),
    masterOrderCode: cleanText(payload.masterOrderCode),
    amount,
    lines: Array.isArray(payload.lines) ? payload.lines : [],
    sourceType,
    sourceId,
    sourceCode: cleanText(payload.sourceCode),
    note: cleanText(payload.note),
    createdBy: cleanText(payload.createdBy),
  });
  return doc.toObject();
}

async function loadMaster(masterOrderId) {
  const key = cleanText(masterOrderId);
  if (!key) throw httpError('Thiếu masterOrderId', 400);
  const or = [{ id: key }, { code: key }];
  if (mongoose.Types.ObjectId.isValid(key)) or.push({ _id: key });
  const master = await MasterOrder.findOne({ $or: or }).lean();
  if (!master) throw httpError('Không tìm thấy đơn tổng', 404);
  return master;
}

async function loadDeliveredOrder(salesOrderId) {
  const filter = buildOrderLookup(salesOrderId);
  if (!filter) throw httpError('Thiếu salesOrderId', 400);
  const order = await SalesOrder.findOne(filter).lean();
  if (!order) throw httpError('Không tìm thấy đơn bán', 404);
  if (order.status === 'cancelled') throw httpError('Đơn đã hủy, không thể xác nhận kế toán', 409);
  if (order.accountingStatus === 'posted' || order.accountingConfirmed) throw httpError('Đơn đã xác nhận kế toán', 409);
  if (!(order.deliveryStatus === 'delivered' || order.status === 'delivered')) {
    throw httpError('Đơn chưa giao, không thể xác nhận kế toán', 409);
  }
  return order;
}

async function postDeliveredOrders({ master = {}, deliveredOrders = [], confirmedBy = '' }) {
  const arLedgers = [];
  const fundLedgers = [];
  const inventoryLedgers = [];
  const journals = [];
  const now = new Date();

  if (!deliveredOrders.length) throw httpError('Chưa có đơn đã giao để xác nhận kế toán', 409);

  const orderIds = deliveredOrders.map((order) => cleanText(order.id || order._id));
  const orderCodes = deliveredOrders.map((order) => cleanText(order.code));
  const returnOrders = await ReturnOrder.find({
    status: { $nin: ['cancelled'] },
    $or: [{ salesOrderId: { $in: orderIds } }, { salesOrderCode: { $in: orderCodes } }],
  }).lean();

  const returnsByOrder = new Map();
  for (const ro of returnOrders) {
    for (const key of [ro.salesOrderId, ro.salesOrderCode].map(cleanText).filter(Boolean)) {
      if (!returnsByOrder.has(key)) returnsByOrder.set(key, []);
      returnsByOrder.get(key).push(ro);
    }
  }

  for (const order of deliveredOrders) {
    const orderId = cleanText(order.id || order._id);
    const orderCode = cleanText(order.code);
    const saleDate = cleanText(order.deliveryDate || master.deliveryDate) || today();
    const saleAmount = amountOf(order.payableAmount ?? order.finalAmount ?? order.totalAmount ?? 0);
    const masterOrderId = cleanText(master.id || order.masterOrderId);
    const masterOrderCode = cleanText(master.code || order.masterOrderCode);

    if (saleAmount > 0) {
      arLedgers.push(await createArOnce({
        type: 'AR-SALE', date: saleDate, customerCode: order.customerCode, customerName: order.customerName,
        salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode,
        debit: saleAmount, credit: 0, amount: saleAmount,
        note: 'Ghi nhận công nợ bán hàng khi kế toán xác nhận',
        sourceType: 'salesOrder', sourceId: orderId, sourceCode: orderCode, createdBy: confirmedBy,
      }));
      const journal = await createJournalOnce({
        type: 'SALE', date: saleDate, amount: saleAmount,
        customerCode: order.customerCode, customerName: order.customerName,
        salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode,
        sourceType: 'salesOrder', sourceId: orderId, sourceCode: orderCode,
        note: 'Journal bán hàng', createdBy: confirmedBy,
        lines: [
          { accountCode: 'PTKH', accountName: 'Phải thu khách hàng', debit: saleAmount, credit: 0 },
          { accountCode: 'DTBH', accountName: 'Doanh thu bán hàng', debit: 0, credit: saleAmount },
        ],
      });
      if (journal) journals.push(journal);
    }

    for (const item of order.items || []) {
      const qty = -Math.abs(Number(item.quantity || item.qty || 0));
      const inv = await createInventoryOnce({
        transactionType: 'OUT_SALE', productId: item.productId || item.productCode,
        productCode: item.productCode, productName: item.productName,
        warehouseId: item.warehouseCode || 'DEFAULT', warehouseCode: item.warehouseCode || 'DEFAULT', warehouseName: item.warehouseName,
        qty, unit: item.unit, referenceType: 'salesOrder', referenceId: `${orderId}:${item.productCode}`, referenceCode: orderCode,
        note: 'Xuất kho bán hàng khi kế toán xác nhận', createdBy: confirmedBy,
      });
      if (inv) inventoryLedgers.push(inv);
      const inventoryAmount = amountOf(Number(item.price || 0) * Math.abs(qty));
      const journal = await createJournalOnce({
        type: 'INVENTORY_OUT', date: saleDate, amount: inventoryAmount || Math.abs(qty),
        customerCode: order.customerCode, customerName: order.customerName,
        salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode,
        sourceType: 'inventoryOut', sourceId: `${orderId}:${item.productCode}`, sourceCode: orderCode,
        note: 'Journal xuất kho bán hàng', createdBy: confirmedBy,
      });
      if (journal) journals.push(journal);
    }

    const orderReturns = [...(returnsByOrder.get(orderId) || []), ...(returnsByOrder.get(orderCode) || [])];
    const seenReturnIds = new Set();
    for (const ro of orderReturns) {
      const roId = sourceKey(ro);
      if (seenReturnIds.has(roId)) continue;
      seenReturnIds.add(roId);
      const returnAmount = amountOf(ro.totalReturnAmount || ro.amount || 0);
      if (returnAmount > 0) {
        arLedgers.push(await createArOnce({
          type: 'AR-RETURN', date: ro.deliveryDate || saleDate, customerCode: ro.customerCode, customerName: ro.customerName,
          salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode,
          debit: 0, credit: returnAmount, amount: returnAmount,
          note: 'Giảm công nợ do hàng trả', sourceType: 'returnOrder', sourceId: roId, sourceCode: ro.code, createdBy: confirmedBy,
        }));
        const journal = await createJournalOnce({
          type: 'RETURN', date: ro.deliveryDate || saleDate, amount: returnAmount,
          customerCode: ro.customerCode, customerName: ro.customerName,
          salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode,
          sourceType: 'returnOrder', sourceId: roId, sourceCode: ro.code,
          note: 'Journal hàng trả giảm công nợ', createdBy: confirmedBy,
          lines: [
            { accountCode: 'HANGTRA', accountName: 'Hàng bán bị trả lại', debit: returnAmount, credit: 0 },
            { accountCode: 'PTKH', accountName: 'Phải thu khách hàng', debit: 0, credit: returnAmount },
          ],
        });
        if (journal) journals.push(journal);
      }
      for (const line of ro.items || []) {
        const inv = await createInventoryOnce({
          transactionType: 'IN_RETURN', productId: line.productCode, productCode: line.productCode, productName: line.productName,
          warehouseId: line.warehouseCode || 'DEFAULT', warehouseCode: line.warehouseCode || 'DEFAULT', warehouseName: line.warehouseName,
          qty: Math.abs(Number(line.returnQty || 0)), unit: line.unit,
          referenceType: 'returnOrder', referenceId: `${roId}:${line.productCode}`, referenceCode: ro.code,
          note: 'Nhập kho hàng trả khi kế toán xác nhận', createdBy: confirmedBy,
        });
        if (inv) inventoryLedgers.push(inv);
        const journal = await createJournalOnce({
          type: 'INVENTORY_IN', date: ro.deliveryDate || saleDate, amount: amountOf(line.returnAmount || line.amount || 0) || Math.abs(Number(line.returnQty || 0)),
          customerCode: ro.customerCode, customerName: ro.customerName,
          salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode,
          sourceType: 'inventoryReturn', sourceId: `${roId}:${line.productCode}`, sourceCode: ro.code,
          note: 'Journal nhập kho hàng trả', createdBy: confirmedBy,
        });
        if (journal) journals.push(journal);
      }
      await ReturnOrder.updateOne({ _id: ro._id }, {
        $set: { status: 'posted', accountingStatus: 'posted', confirmedAt: now, confirmedBy: cleanText(confirmedBy), masterOrderId, masterOrderCode, arPosted: true },
      });
    }

    const cashAmount = amountOf(order.cashAmount || (order.paymentDraft && order.paymentDraft.cashAmount));
    const bankAmount = amountOf(order.bankAmount || (order.paymentDraft && order.paymentDraft.bankAmount));
    const bonusAmount = amountOf(order.bonusAmount || (order.paymentDraft && order.paymentDraft.bonusAmount));

    if (cashAmount > 0) {
      arLedgers.push(await createArOnce({ type: 'AR-RECEIPT', date: saleDate, customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode, debit: 0, credit: cashAmount, amount: cashAmount, note: 'Thu tiền mặt giảm công nợ', sourceType: 'cashReceipt', sourceId: orderId, sourceCode: orderCode, createdBy: confirmedBy }));
      const fund = await createFundOnce({ type: 'CASH_RECEIPT', method: 'cash', amount: cashAmount, date: saleDate, customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode, sourceType: 'cashReceipt', sourceId: orderId, sourceCode: orderCode, note: 'Thu tiền mặt từ app giao hàng', createdBy: confirmedBy });
      if (fund) fundLedgers.push(fund);
    }
    if (bankAmount > 0) {
      arLedgers.push(await createArOnce({ type: 'AR-RECEIPT', date: saleDate, customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode, debit: 0, credit: bankAmount, amount: bankAmount, note: 'Thu chuyển khoản giảm công nợ', sourceType: 'bankReceipt', sourceId: orderId, sourceCode: orderCode, createdBy: confirmedBy }));
      const fund = await createFundOnce({ type: 'BANK_RECEIPT', method: 'bank', amount: bankAmount, date: saleDate, customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode, sourceType: 'bankReceipt', sourceId: orderId, sourceCode: orderCode, note: 'Thu chuyển khoản từ app giao hàng', createdBy: confirmedBy });
      if (fund) fundLedgers.push(fund);
    }
    if (bonusAmount > 0) {
      arLedgers.push(await createArOnce({ type: 'AR-BONUS', date: saleDate, customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode, debit: 0, credit: bonusAmount, amount: bonusAmount, note: 'Trả thưởng giảm công nợ', sourceType: 'bonus', sourceId: orderId, sourceCode: orderCode, createdBy: confirmedBy }));
      const journal = await createJournalOnce({
        type: 'BONUS', date: saleDate, amount: bonusAmount,
        customerCode: order.customerCode, customerName: order.customerName,
        salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId, masterOrderCode,
        sourceType: 'bonus', sourceId: orderId, sourceCode: orderCode,
        note: 'Journal trả thưởng giảm công nợ', createdBy: confirmedBy,
        lines: [
          { accountCode: 'CPBH', accountName: 'Chi phí bán hàng/trả thưởng', debit: bonusAmount, credit: 0 },
          { accountCode: 'PTKH', accountName: 'Phải thu khách hàng', debit: 0, credit: bonusAmount },
        ],
      });
      if (journal) journals.push(journal);
    }
  }

  await SalesOrder.updateMany({ _id: { $in: deliveredOrders.map((order) => order._id) } }, {
    $set: { status: 'accounting_confirmed', accountingStatus: 'posted', accountingConfirmed: true, accountingConfirmedAt: now, accountingConfirmedBy: cleanText(confirmedBy) },
  });

  return { arLedgers, fundLedgers, inventoryLedgers, journals };
}

async function confirmMasterOrderAccounting(masterOrderId, paymentDrafts = [], confirmedBy = '') {
  const master = await loadMaster(masterOrderId);
  if (['posted', 'confirmed'].includes(master.accountingStatus)) throw httpError('Đơn tổng đã xác nhận kế toán', 409);
  if (master.status === 'cancelled') throw httpError('Đơn tổng đã hủy, không thể xác nhận', 409);

  const orders = await SalesOrder.find({
    $or: [
      { masterOrderId: master.id }, { masterOrderCode: master.code },
      { id: { $in: master.salesOrderIds || [] } }, { code: { $in: master.salesOrderCodes || [] } },
    ],
    status: { $ne: 'cancelled' },
  }).lean();
  const deliveredOrders = orders.filter((order) => order.deliveryStatus === 'delivered' || order.status === 'delivered');

  const posted = await postDeliveredOrders({ master, deliveredOrders, confirmedBy });
  const updatedMaster = await MasterOrder.findByIdAndUpdate(master._id, {
    $set: { status: 'accounting_confirmed', accountingStatus: 'posted', accountingConfirmed: true, accountingConfirmedAt: new Date(), accountingConfirmedBy: cleanText(confirmedBy) },
  }, { new: true }).lean();

  return { ok: true, masterOrder: updatedMaster, postedOrders: deliveredOrders.length, ...posted, paymentDraftsIgnored: Array.isArray(paymentDrafts) ? paymentDrafts.length : 0 };
}

async function confirmDeliveryAccounting(salesOrderId, confirmedBy = '') {
  const order = await loadDeliveredOrder(salesOrderId);
  const posted = await postDeliveredOrders({ master: { id: order.masterOrderId, code: order.masterOrderCode, deliveryDate: order.deliveryDate }, deliveredOrders: [order], confirmedBy });
  const updatedOrder = await SalesOrder.findById(order._id).lean();
  return { ok: true, salesOrder: updatedOrder, postedOrders: 1, ...posted };
}

module.exports = {
  confirmMasterOrderAccounting,
  confirmDeliveryAccounting,
  createArOnce,
  createFundOnce,
  createInventoryOnce,
  createJournalOnce,
};
