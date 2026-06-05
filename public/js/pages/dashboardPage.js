(function () {
  'use strict';
  var F = window.MKFormat;

  function metric(label, value) {
    return '<div class="metric"><div class="label">' + F.esc(label) + '</div><div class="value">' + F.esc(value) + '</div></div>';
  }

  window.MKApp.registerPage('dashboard', {
    title: 'Dashboard',
    subtitle: 'Tổng quan vận hành V46 từ ledger chuẩn',
    template: function () {
      return '<div class="card"><div id="dashboardMetrics" class="metric-grid"></div><div id="dashboardAlerts" class="card"></div><div id="dashboardPerf" class="perf"></div></div>';
    },
    mount: async function () {
      var data = await window.MKApi.get('/api/reports/dashboard');
      var summary = data.summary || data.data || data || {};
      document.getElementById('dashboardMetrics').innerHTML = [
        metric('Số đơn', summary.orderCount || 0),
        metric('Doanh số', F.money(summary.salesAmount || 0)),
        metric('Hàng trả', F.money(summary.returnAmount || 0)),
        metric('AR Debit', F.money(summary.arDebit || 0)),
        metric('AR Credit', F.money(summary.arCredit || 0)),
        metric('Quỹ tiền', F.money(summary.fundAmount || 0)),
        metric('Inventory Ledger', summary.inventoryLedgerCount || 0),
        metric('Journal', summary.journalCount || 0)
      ].join('');
      var alerts = [];
      if ((summary.pendingAccountingCount || 0) > 0) alerts.push('Có ' + summary.pendingAccountingCount + ' đơn đã giao chưa xác nhận kế toán');
      if ((summary.slowApiCount || 0) > 0) alerts.push('Có API chậm cần kiểm tra');
      document.getElementById('dashboardAlerts').innerHTML = '<h3>Cảnh báo vận hành</h3>' + (alerts.length ? alerts.map(function (x) { return '<div class="warn">• ' + F.esc(x) + '</div>'; }).join('') : '<div class="ok">Không có cảnh báo nghiêm trọng</div>');
      document.getElementById('dashboardPerf').textContent = 'API: ' + (data.__ms || 0) + 'ms';
    }
  });
}());
