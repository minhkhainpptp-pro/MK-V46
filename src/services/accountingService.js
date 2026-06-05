const MasterOrder = require('../models/MasterOrder');
const SalesOrder = require('../models/SalesOrder');
const ReturnOrder = require('../models/ReturnOrder');
const ArLedger = require('../models/ArLedger');
const FundLedger = require('../models/FundLedger');
const Inventory = require('../models/Inventory');
const { roundMoney } = require('../utils/money.util');

function httpError(message, status = 400) { return Object.assign(new Error(message), { status }); }
function cleanText(value) { return String(value || '').trim(); }
function today() { return new Date().toISOString().slice(0, 10); }
function amountOf(value) { return roundMoney(Number(value || 0)); }
function makeCode(prefix, sourceCode) { return `${prefix}-${cleanText(sourceCode) || Date.now()}`; }
function sourceKey(doc) { return cleanText(doc.id || doc._id); }

async function createArOnce(payload) {
  const sourceType = cleanText(payload.sourceType);
  const sourceId = cleanText(payload.sourceId);
  const type = cleanText(payload.type);
  if (sourceType && sourceId && type) {
    const existed = await ArLedger.findOne({ sourceType, sourceId, type }).lean();
    if (existed) return existed;
  }
  const doc = await ArLedger.create({
    id: cleanText(payload.id) || makeCode('AR', payload.sourceCode || sourceId),
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
    id: cleanText(payload.id) || makeCode('FUND', payload.sourceCode || sourceId),
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

async function loadMaster(masterOrderId) {
  const key = cleanText(masterOrderId);
  if (!key) throw httpError('Thiếu masterOrderId', 400);
  const or = [{ id: key }, { code: key }];
  const master = await MasterOrder.findOne({ $or: or }).lean();
  if (!master) throw httpError('Không tìm thấy đơn tổng', 404);
  return master;
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
  if (!deliveredOrders.length) throw httpError('Chưa có đơn con đã giao để xác nhận kế toán', 409);

  const orderIds = deliveredOrders.map((order) => cleanText(order.id || order._id));
  const orderCodes = deliveredOrders.map((order) => cleanText(order.code));
  const returnOrders = await ReturnOrder.find({ status: { $nin: ['cancelled'] }, $or: [{ salesOrderId: { $in: orderIds } }, { salesOrderCode: { $in: orderCodes } }] }).lean();
  const returnsByOrder = new Map();
  for (const ro of returnOrders) {
    for (const key of [ro.salesOrderId, ro.salesOrderCode].map(cleanText).filter(Boolean)) {
      if (!returnsByOrder.has(key)) returnsByOrder.set(key, []);
      returnsByOrder.get(key).push(ro);
    }
  }

  const arLedgers = [];
  const fundLedgers = [];
  const inventoryLedgers = [];
  const now = new Date();

  for (const order of deliveredOrders) {
    const orderId = cleanText(order.id || order._id);
    const orderCode = cleanText(order.code);
    const saleAmount = amountOf(order.payableAmount ?? order.finalAmount ?? order.totalAmount ?? 0);
    if (saleAmount > 0) {
      arLedgers.push(await createArOnce({
        type: 'AR-SALE', date: order.deliveryDate || master.deliveryDate || today(), customerCode: order.customerCode, customerName: order.customerName,
        salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId: master.id, masterOrderCode: master.code,
        debit: saleAmount, credit: 0, amount: saleAmount, note: 'Ghi nhận công nợ bán hàng khi kế toán xác nhận',
        sourceType: 'salesOrder', sourceId: orderId, sourceCode: orderCode, createdBy: confirmedBy,
      }));
    }

    for (const item of order.items || []) {
      const qty = -Math.abs(Number(item.quantity || item.qty || 0));
      const inv = await createInventoryOnce({
        transactionType: 'OUT_SALE', productId: item.productId || item.productCode, productCode: item.productCode, productName: item.productName,
        warehouseId: item.warehouseCode || 'DEFAULT', warehouseCode: item.warehouseCode || 'DEFAULT', warehouseName: item.warehouseName,
        qty, unit: item.unit, referenceType: 'salesOrder', referenceId: `${orderId}:${item.productCode}`, referenceCode: orderCode,
        note: 'Xuất kho bán hàng khi kế toán xác nhận', createdBy: confirmedBy,
      });
      if (inv) inventoryLedgers.push(inv);
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
          type: 'AR-RETURN', date: ro.deliveryDate || order.deliveryDate || today(), customerCode: ro.customerCode, customerName: ro.customerName,
          salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId: master.id, masterOrderCode: master.code,
          debit: 0, credit: returnAmount, amount: returnAmount, note: 'Giảm công nợ do hàng trả',
          sourceType: 'returnOrder', sourceId: roId, sourceCode: ro.code, createdBy: confirmedBy,
        }));
      }
      for (const line of ro.items || []) {
        const inv = await createInventoryOnce({
          transactionType: 'IN_RETURN', productId: line.productCode, productCode: line.productCode, productName: line.productName,
          warehouseId: line.warehouseCode || 'DEFAULT', warehouseCode: line.warehouseCode || 'DEFAULT', qty: Math.abs(Number(line.returnQty || 0)), unit: line.unit,
          referenceType: 'returnOrder', referenceId: `${roId}:${line.productCode}`, referenceCode: ro.code,
          note: 'Nhập kho hàng trả khi kế toán xác nhận', createdBy: confirmedBy,
        });
        if (inv) inventoryLedgers.push(inv);
      }
      await ReturnOrder.updateOne({ _id: ro._id }, { $set: { status: 'posted', accountingStatus: 'posted', confirmedAt: now, confirmedBy: cleanText(confirmedBy), masterOrderId: master.id, masterOrderCode: master.code } });
    }

    const cashAmount = amountOf(order.cashAmount || (order.paymentDraft && order.paymentDraft.cashAmount));
    const bankAmount = amountOf(order.bankAmount || (order.paymentDraft && order.paymentDraft.bankAmount));
    const bonusAmount = amountOf(order.bonusAmount || (order.paymentDraft && order.paymentDraft.bonusAmount));

    if (cashAmount > 0) {
      arLedgers.push(await createArOnce({ type: 'AR-RECEIPT', date: order.deliveryDate || today(), customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId: master.id, masterOrderCode: master.code, debit: 0, credit: cashAmount, amount: cashAmount, note: 'Thu tiền mặt giảm công nợ', sourceType: 'cashReceipt', sourceId: orderId, sourceCode: orderCode, createdBy: confirmedBy }));
      const fund = await createFundOnce({ type: 'CASH_RECEIPT', method: 'cash', amount: cashAmount, date: order.deliveryDate || today(), customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId: master.id, masterOrderCode: master.code, sourceType: 'cashReceipt', sourceId: orderId, sourceCode: orderCode, note: 'Thu tiền mặt từ app giao hàng', createdBy: confirmedBy });
      if (fund) fundLedgers.push(fund);
    }
    if (bankAmount > 0) {
      arLedgers.push(await createArOnce({ type: 'AR-RECEIPT', date: order.deliveryDate || today(), customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId: master.id, masterOrderCode: master.code, debit: 0, credit: bankAmount, amount: bankAmount, note: 'Thu chuyển khoản giảm công nợ', sourceType: 'bankReceipt', sourceId: orderId, sourceCode: orderCode, createdBy: confirmedBy }));
      const fund = await createFundOnce({ type: 'BANK_RECEIPT', method: 'bank', amount: bankAmount, date: order.deliveryDate || today(), customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId: master.id, masterOrderCode: master.code, sourceType: 'bankReceipt', sourceId: orderId, sourceCode: orderCode, note: 'Thu chuyển khoản từ app giao hàng', createdBy: confirmedBy });
      if (fund) fundLedgers.push(fund);
    }
    if (bonusAmount > 0) {
      arLedgers.push(await createArOnce({ type: 'AR-BONUS', date: order.deliveryDate || today(), customerCode: order.customerCode, customerName: order.customerName, salesOrderId: orderId, salesOrderCode: orderCode, masterOrderId: master.id, masterOrderCode: master.code, debit: 0, credit: bonusAmount, amount: bonusAmount, note: 'Trả thưởng giảm công nợ', sourceType: 'bonus', sourceId: orderId, sourceCode: orderCode, createdBy: confirmedBy }));
    }
  }

  await SalesOrder.updateMany({ _id: { $in: deliveredOrders.map((order) => order._id) } }, { $set: { status: 'accounting_confirmed', accountingStatus: 'posted', accountingConfirmed: true, accountingConfirmedAt: now, accountingConfirmedBy: cleanText(confirmedBy) } });
  const updatedMaster = await MasterOrder.findByIdAndUpdate(master._id, { $set: { status: 'accounting_confirmed', accountingStatus: 'posted', accountingConfirmed: true, accountingConfirmedAt: now, accountingConfirmedBy: cleanText(confirmedBy) } }, { new: true }).lean();

  return { ok: true, masterOrder: updatedMaster, postedOrders: deliveredOrders.length, arLedgers, fundLedgers, inventoryLedgers, paymentDraftsIgnored: Array.isArray(paymentDrafts) ? paymentDrafts.length : 0 };
}

module.exports = { confirmMasterOrderAccounting };
