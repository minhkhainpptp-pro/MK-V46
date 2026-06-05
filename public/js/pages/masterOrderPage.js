(function () {
  'use strict';
  var F = window.MKFormat;

  async function loadMasters() {
    var res = await window.MKApi.get('/api/master-orders', { deliveryDate: document.getElementById('moDeliveryDate').value, deliveryStaffCode: document.getElementById('moDeliveryStaffCode').value.trim(), limit: 100 });
    var rows = F.getRows(res);
    document.getElementById('masterOrderRows').innerHTML = rows.map(function (m) { return '<tr><td><b>' + F.esc(m.code || m.id) + '</b></td><td>' + F.date(m.deliveryDate) + '</td><td>' + F.esc(m.deliveryStaffCode || '') + '</td><td>' + (m.orderCount || (m.salesOrderIds || []).length || 0) + '</td><td>' + F.money(m.totalAmount || 0) + '</td><td>' + F.esc(m.status || '') + '</td></tr>'; }).join('') || '<tr><td colspan="6" class="muted">Chưa có đơn tổng.</td></tr>';
  }

  async function createMaster() {
    var ids = document.getElementById('moSalesOrderIds').value.split(/[\n,]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var payload = { deliveryDate: document.getElementById('moCreateDate').value, deliveryStaffCode: document.getElementById('moCreateStaffCode').value.trim(), deliveryStaffName: document.getElementById('moCreateStaffName').value.trim(), salesOrderIds: ids };
    var btn = document.getElementById('createMasterBtn');
    window.MKNotify.setBusy(btn, true);
    try {
      var res = await window.MKApi.post('/api/master-orders/create', payload);
      document.getElementById('masterOrderResult').textContent = JSON.stringify(res, null, 2);
      window.MKNotify.showSuccess('Đã gộp đơn tổng');
      await loadMasters();
    } catch (err) { window.MKNotify.showError(err.message); }
    finally { window.MKNotify.setBusy(btn, false); }
  }

  window.MKApp.registerPage('master-orders', {
    title: 'Đơn tổng',
    subtitle: 'Gộp đơn pending thành chuyến giao',
    template: function () {
      return '<div class="grid-2"><div class="card"><h3>Gộp đơn tổng</h3><div class="grid"><div><label>Ngày giao</label><input id="moCreateDate" type="date"></div><div><label>NVGH code</label><input id="moCreateStaffCode" value="GH001"></div><div><label>NVGH name</label><input id="moCreateStaffName" value="NV giao hàng test"></div></div><label>SalesOrder IDs/Codes, mỗi dòng 1 đơn</label><textarea id="moSalesOrderIds" rows="8" placeholder="SO..."></textarea><button id="createMasterBtn" class="primary">Gộp đơn</button><pre id="masterOrderResult"></pre></div><div class="card"><h3>Danh sách đơn tổng</h3><div class="grid"><input id="moDeliveryDate" type="date"><input id="moDeliveryStaffCode" placeholder="NVGH"></div><button id="loadMastersBtn" style="margin-top:10px">Tải đơn tổng</button><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Ngày giao</th><th>NVGH</th><th>Số đơn</th><th>Tiền</th><th>Trạng thái</th></tr></thead><tbody id="masterOrderRows"></tbody></table></div></div></div>';
    },
    mount: function () { ['moCreateDate','moDeliveryDate'].forEach(function (id) { document.getElementById(id).value = F.today(); }); document.getElementById('createMasterBtn').onclick = createMaster; document.getElementById('loadMastersBtn').onclick = loadMasters; }
  });
}());
