(function () {
  'use strict';
  var F = window.MKFormat;

  async function loadReturns() {
    var res = await window.MKApi.get('/api/return-orders', { salesOrderId: document.getElementById('returnSalesOrderFilter').value.trim(), limit: 100 });
    var rows = F.getRows(res);
    document.getElementById('returnRows').innerHTML = rows.map(function (r) { return '<tr><td><b>' + F.esc(r.code || r.id) + '</b></td><td>' + F.esc(r.salesOrderCode || r.salesOrderId || '') + '</td><td>' + F.esc(r.customerName || '') + '</td><td>' + F.money(r.totalReturnAmount || r.amount || 0) + '</td><td>' + F.esc(r.status || '') + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="muted">Chưa có hàng trả.</td></tr>';
  }

  async function createReturn() {
    var btn = document.getElementById('createReturnBtn');
    window.MKNotify.setBusy(btn, true);
    try {
      var payload = JSON.parse(document.getElementById('returnJson').value || '{}');
      var res = await window.MKApi.post('/api/return-orders', payload);
      document.getElementById('returnResult').textContent = JSON.stringify(res, null, 2);
      window.MKNotify.showSuccess('Đã tạo phiếu trả hàng');
      await loadReturns();
    } catch (err) { window.MKNotify.showError(err.message); }
    finally { window.MKNotify.setBusy(btn, false); }
  }

  window.MKApp.registerPage('returns', {
    title: 'Trả hàng',
    subtitle: 'Nguồn chuẩn: returnOrders, giá lấy từ đơn gốc',
    template: function () {
      var sample = '{\n  "salesOrderId": "SO...",\n  "items": [\n    { "productCode": "P001", "productName": "Sản phẩm test", "returnQty": 1 }\n  ],\n  "note": "Tạo từ UI"\n}';
      return '<div class="grid-2"><div class="card"><h3>Tạo phiếu trả</h3><textarea id="returnJson" rows="10">' + F.esc(sample) + '</textarea><button id="createReturnBtn" class="primary">Tạo RO</button><pre id="returnResult"></pre></div><div class="card"><h3>Danh sách hàng trả</h3><div class="actions"><input id="returnSalesOrderFilter" placeholder="Lọc SalesOrder"><button id="loadReturnsBtn">Tải</button></div><table><thead><tr><th>Mã RO</th><th>Đơn bán</th><th>Khách</th><th>Tiền trả</th><th>Trạng thái</th></tr></thead><tbody id="returnRows"></tbody></table></div></div>';
    },
    mount: function () { document.getElementById('createReturnBtn').onclick = createReturn; document.getElementById('loadReturnsBtn').onclick = loadReturns; }
  });
}());
