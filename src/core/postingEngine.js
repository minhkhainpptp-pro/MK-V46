const arLedgerService = require('../services/arLedger.service');

async function postAccountingForMaster({ masterOrder, salesOrders, paymentDrafts = [], createdBy = '' }) {
  const arRows = [];
  for (const order of salesOrders || []) {
    const row = await arLedgerService.postSaleAr(order, createdBy);
    if (row) arRows.push(row);
  }

  const receiptRows = [];
  for (const payment of paymentDrafts || []) {
    const amount = Number(payment.amount || payment.cashAmount || 0) + Number(payment.bankAmount || 0);
    if (amount <= 0) continue;
    const row = await arLedgerService.postReceiptAr({
      ...payment,
      amount,
      masterOrderId: masterOrder && masterOrder.id,
      masterOrderCode: masterOrder && masterOrder.code,
      createdBy,
    });
    if (row) receiptRows.push(row);
  }

  return { skipped: false, arCount: arRows.length + receiptRows.length, fundCount: 0, arRows, receiptRows };
}

module.exports = { postAccountingForMaster };
