(function () {
  'use strict';
  var F = window.MKFormat;

  function params() {
    return {
      deliveryDate: document.getElementById('accDeliveryDate').value,
      deliveryStaffCode: document.getElementById('accDeliveryStaffCode').value.trim(),
      status: 'delivered'
    };
  }

  function rowHtml(o) {
    var debt = Number(o.debtAmount || 0);
    var posted = o.accountingStatus === 'posted';
    return '<tr class="' + (posted ? 'accounting-row-posted' : '') + '"><td>' + F.date(o.deliveryDate) + '</td><td><b>' + F.esc(o.code || o.salesOrderCode) + '</b></td><td>' + F.esc(o.customerName || '') + '</td><td>' + F.money(o.totalAmount || 0) + '</td><td>' + F.money(o.returnAmount || 0) + '</td><td>' + F.money(o.paidAmount || 0) + '</td><td>' + F.money(debt) + '</td><td>' + F.esc(o.accountingStatus || '') + '</td><td>' + (posted ? '<span class="ok">Đã xác nhận</span>' : '<button class="primary" data-confirm-accounting="' + F.esc(o.salesOrderId || o.id || o.code) + '">Xác nhận</button>') + '</td></tr>';
  }

  async function loadRows() {
    var result = await window.MKApi.get('/api/mobile/delivery/orders', params());
    var rows = F.getRows(result).filter(function (o) { return o.deliveryStatus === 'delivered' || o.status === 'delivered'; });
    document.getElementById('accountingRows').innerHTML = rows.map(rowHtml).join('') || '<tr><td colspan="9" class="muted">Không có đơn đã giao chờ xác nhận.</td></tr>';
    document.getElementById('accountingPerf').textContent = 'API: ' + ((result.perf && result.perf.totalMs) || result.__ms || 0) + 'ms | rows: ' + rows.length;
    document.querySelectorAll('[data-confirm-accounting]').forEach(function (btn) {
      btn.addEventListener('click', function () { confirmOne(btn.getAttribute('data-confirm-accounting'), btn); });
    });
  }

  async function confirmOne(salesOrderId, btn) {
    window.MKNotify.setBusy(btn, true);
    try {
      await window.MKApi.post('/api/accounting/confirm-delivery', {
        salesOrderId: salesOrderId,
        operationId: 'UI_CONFIRM_ACCOUNTING:' + salesOrderId + ':' + Date.now()
      });
      window.MKNotify.showSuccess('Đã xác nhận kế toán');
      await loadRows();
    } catch (err) { window.MKNotify.showError(err.message); }
    finally { window.MKNotify.setBusy(btn, false); }
  }

  window.MKApp.registerPage('accounting', {
    title: 'Xác nhận kế toán',
    subtitle: 'Chỉ kế toán/admin mới sinh AR, Inventory và Journal',
    template: function () {
      return '<div class="card"><div class="grid"><div><label>Ngày giao</label><input id="accDeliveryDate" type="date"></div><div><label>NVGH</label><input id="accDeliveryStaffCode" placeholder="VD: GH001"></div></div><div class="actions"><button id="loadAccountingBtn" class="primary">Tải đơn đã giao</button></div><div id="accountingPerf" class="perf"></div></div><div class="card table-wrap"><table><thead><tr><th>Ngày giao</th><th>Mã đơn</th><th>Khách hàng</th><th>Tiền đơn</th><th>Trả</th><th>Thu</th><th>Còn</th><th>Kế toán</th><th>Thao tác</th></tr></thead><tbody id="accountingRows"></tbody></table></div>';
    },
    mount: async function () {
      document.getElementById('accDeliveryDate').value = F.today();
      document.getElementById('loadAccountingBtn').onclick = loadRows;
    }
  });
}());
