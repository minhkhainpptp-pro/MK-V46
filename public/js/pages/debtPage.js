(function () {
  'use strict';
  var F = window.MKFormat;

  async function loadCustomers() {
    var result = await window.MKApi.get('/api/debts/customers', { q: document.getElementById('debtKeyword').value.trim(), limit: 200 });
    var rows = F.getRows(result);
    document.getElementById('debtCustomerRows').innerHTML = rows.map(function (c) {
      var code = c.customerCode || c.code || c._id || '';
      return '<tr data-debt-customer="' + F.esc(code) + '"><td><b>' + F.esc(code) + '</b></td><td>' + F.esc(c.customerName || c.name || '') + '</td><td>' + F.money(c.balance || c.debtAmount || c.totalDebt || 0) + '</td><td>' + F.esc(c.salesStaffCode || '') + '</td><td>' + F.esc(c.deliveryStaffCode || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">Không có khách công nợ.</td></tr>';
    document.querySelectorAll('[data-debt-customer]').forEach(function (row) {
      row.addEventListener('click', function () { loadDetail(row.getAttribute('data-debt-customer')); });
    });
  }

  async function loadDetail(customerCode) {
    var result = await window.MKApi.get('/api/debts/customer-detail', { customerCode: customerCode, limit: 500 });
    var rows = F.getRows(result);
    var summary = result.summary || {};
    document.getElementById('debtDetail').innerHTML = '<h3>Chi tiết công nợ: ' + F.esc(customerCode) + '</h3><div class="metric-grid"><div class="metric"><div class="label">Debit</div><div class="value">' + F.money(summary.debit || summary.totalDebit || 0) + '</div></div><div class="metric"><div class="label">Credit</div><div class="value">' + F.money(summary.credit || summary.totalCredit || 0) + '</div></div><div class="metric"><div class="label">Số dư</div><div class="value">' + F.money(summary.balance || summary.debtAmount || 0) + '</div></div></div><div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Loại</th><th>Đơn</th><th>Debit</th><th>Credit</th><th>Ghi chú</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td>' + F.date(r.date || r.createdAt) + '</td><td>' + F.esc(r.type) + '</td><td>' + F.esc(r.salesOrderCode || r.salesOrderId || '') + '</td><td>' + F.money(r.debit || 0) + '</td><td>' + F.money(r.credit || 0) + '</td><td>' + F.esc(r.note || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  window.MKApp.registerPage('debts', {
    title: 'Công nợ',
    subtitle: 'Nguồn chuẩn duy nhất: arLedgers',
    template: function () {
      return '<div class="grid-2"><div class="card"><div class="actions"><input id="debtKeyword" placeholder="Tìm mã/tên khách"><button id="loadDebtBtn" class="primary">Tải khách nợ</button></div><div class="table-wrap"><table><thead><tr><th>Mã KH</th><th>Tên KH</th><th>Tổng nợ</th><th>NVBH</th><th>NVGH</th></tr></thead><tbody id="debtCustomerRows"></tbody></table></div></div><div class="card" id="debtDetail"><div class="muted">Chọn một khách hàng để xem sổ AR Ledger.</div></div></div>';
    },
    mount: async function () { document.getElementById('loadDebtBtn').onclick = loadCustomers; }
  });
}());
