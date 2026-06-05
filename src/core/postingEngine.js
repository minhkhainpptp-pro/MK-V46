const ArLedger = require('../models/ArLedger');
const FundLedger = require('../models/FundLedger');
const ReturnOrder = require('../models/ReturnOrder');
const { roundMoney } = require('../utils/money.util');

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function postAccountingForMaster({ masterOrder, salesOrders, paymentDrafts = [] }) {
  const existing = await ArLedger.exists({ masterOrderId: masterOrder.id, type: 'AR-SALE' });
  if (existing) return { skipped: true, reason: 'already_posted' };

  const orderIds = salesOrders.map(o => o.id).filter(Boolean);
  const orderCodes = salesOrders.map(o => o.code).filter(Boolean);
  const returns = await ReturnOrder.find({
    status: 'active',
    $or: [{ salesOrderId: { $in: orderIds } }, { salesOrderCode: { $in: orderCodes } }],
  }).lean();

  const arDocs = [];
  const fundDocs = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const order of salesOrders) {
    const saleAmount = roundMoney(order.totalAmount);
    if (saleAmount > 0) {
      arDocs.push({
        id: makeId('AR'), code: `AR-SALE-${order.code}`, type: 'AR-SALE', date: today,
        customerCode: order.customerCode, customerName: order.customerName,
        salesOrderId: order.id, salesOrderCode: order.code, masterOrderId: masterOrder.id,
        debit: saleAmount, credit: 0, amount: saleAmount, note: 'Ghi nhận công nợ bán hàng',
      });
    }

    const returnAmount = returns
      .filter(r => r.salesOrderId === order.id || r.salesOrderCode === order.code)
      .reduce((s, r) => s + roundMoney(r.amount), 0);
    if (returnAmount > 0) {
      arDocs.push({
        id: makeId('AR'), code: `AR-RETURN-${order.code}`, type: 'AR-RETURN', date: today,
        customerCode: order.customerCode, customerName: order.customerName,
        salesOrderId: order.id, salesOrderCode: order.code, masterOrderId: masterOrder.id,
        debit: 0, credit: returnAmount, amount: returnAmount, note: 'Giảm công nợ do hàng trả',
      });
    }
  }

  for (const p of paymentDrafts) {
    const cashAmount = roundMoney(p.cashAmount);
    const bankAmount = roundMoney(p.bankAmount);
    const amount = cashAmount + bankAmount;
    if (amount <= 0) continue;
    arDocs.push({
      id: makeId('AR'), code: `AR-RECEIPT-${p.salesOrderCode || makeId('NO')}`, type: 'AR-RECEIPT', date: today,
      customerCode: p.customerCode, customerName: p.customerName,
      salesOrderId: p.salesOrderId, salesOrderCode: p.salesOrderCode, masterOrderId: masterOrder.id,
      debit: 0, credit: amount, amount, note: 'Thu tiền giao hàng',
    });
    fundDocs.push({
      id: makeId('FUND'), type: cashAmount > 0 ? 'CASH_RECEIPT' : 'BANK_RECEIPT', date: today,
      customerCode: p.customerCode, customerName: p.customerName,
      salesOrderId: p.salesOrderId, masterOrderId: masterOrder.id,
      cashAmount, bankAmount, amount, note: 'Thu tiền giao hàng',
    });
  }

  if (arDocs.length) await ArLedger.insertMany(arDocs, { ordered: false });
  if (fundDocs.length) await FundLedger.insertMany(fundDocs, { ordered: false });
  return { skipped: false, arCount: arDocs.length, fundCount: fundDocs.length };
}

module.exports = { postAccountingForMaster };
