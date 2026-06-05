(function () {
  'use strict';
  var F = window.MKFormat;

  async function loadSalesOrders() {
    var res = await window.MKApi.get('/api/sales-orders', {
      q: document.getElementById('soQ').value.trim(),
      deliveryDate: document.getElementById('soDeliveryDate').value,
      status: document.getElementById('soStatus').value,
      limit: 100
    });
    var rows = F.getRows(res);
    document.getElementById('salesOrderRows').innerHTML = rows.map(function (o) {
      return '<tr><td><b>' + F.esc(o.code || o.id) + '</b></td><td>' + F.esc(o.customerName || '') + '</td><td>' + F.date(o.deliveryDate) + '</td><td>' + F.money(o.totalAmount || o.payableAmount || 0) + '</td><td>' + F.esc(o.status || '') + '</td><td>' + F.esc(o.accountingStatus || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Chưa có đơn.</td></tr>';
  }

  async function createSalesOrder() {
    var btn = document.getElementById('createSalesOrderBtn');
    window.MKNotify.setBusy(btn, true);
    try {
      var payload = JSON.parse(document.getElementById('salesOrderJson').value || '{}');
      var res = await window.MKApi.post('/api/sales-orders', payload);
      document.getElementById('salesOrderResult').textContent = JSON.stringify(res, null, 2);
      window.MKNotify.showSuccess('Đã tạo đơn bán');
      await loadSalesOrders();
    } catch (err) { window.MKNotify.showError(err.message); }
    finally { window.MKNotify.setBusy(btn, false); }
  }

  window.MKApp.registerPage('sales-orders', {
    title: 'Đơn bán',
    subtitle: 'Tạo/list đơn pending, chưa sinh công nợ',
    template: function () {
      var sample = '{\n  "customerCode": "KH001",\n  "customerName": "Cửa hàng test",\n  "salesStaffCode": "NV001",\n  "salesStaffName": "NV bán hàng test",\n  "deliveryStaffCode": "GH001",\n  "deliveryStaffName": "NV giao hàng test",\n  "deliveryDate": "' + F.today() + '",\n  "items": [\n    { "productCode": "P001", "productName": "Sản phẩm test", "quantity": 1, "price": 10000, "warehouseCode": "KHO_HC" }\n  ]\n}';
      return '<div class="grid-2"><div class="card"><h3>Tạo đơn bán</h3><textarea id="salesOrderJson" rows="15">' + F.esc(sample) + '</textarea><button id="createSalesOrderBtn" class="primary">Tạo đơn pending</button><pre id="salesOrderResult"></pre></div><div class="card"><h3>Danh sách đơn</h3><div class="grid"><input id="soQ" placeholder="Tìm đơn/khách"><input id="soDeliveryDate" type="date"><select id="soStatus"><option value="all">Tất cả</option><option value="pending">pending</option><option value="assigned">assigned</option><option value="delivered">delivered</option><option value="cancelled">cancelled</option></select></div><button id="loadSalesOrdersBtn" style="margin-top:10px">Tải đơn</button><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Khách</th><th>Ngày giao</th><th>Tiền</th><th>Trạng thái</th><th>Kế toán</th></tr></thead><tbody id="salesOrderRows"></tbody></table></div></div></div>';
    },
    mount: function () {
      document.getElementById('loadSalesOrdersBtn').onclick = loadSalesOrders;
      document.getElementById('createSalesOrderBtn').onclick = createSalesOrder;
      document.getElementById('soDeliveryDate').value = F.today();
    }
  });
}());
