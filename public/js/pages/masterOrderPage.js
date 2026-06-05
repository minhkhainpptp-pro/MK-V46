(function () {
  'use strict';
  var F = window.MKFormat;
  var pendingOrders = [];

  function statusBadge(status) {
    var s = String(status || 'pending');
    return '<span class="badge badge-' + F.esc(s) + '">' + F.esc(s) + '</span>';
  }

  function selectedIds() {
    return Array.prototype.slice.call(document.querySelectorAll('.mo-pick:checked')).map(function (x) { return x.value; });
  }

  function renderPickedSummary() {
    var ids = selectedIds();
    var selected = pendingOrders.filter(function (o) { return ids.indexOf(o.id || o.code) !== -1; });
    var amount = selected.reduce(function (sum, o) { return sum + Number(o.totalAmount || o.finalAmount || 0); }, 0);
    document.getElementById('moPickSummary').innerHTML = '<b>Đã chọn: ' + ids.length + ' đơn</b> | Tổng tiền: <b>' + F.money(amount) + '</b>';
  }

  async function loadPendingOrders() {
    var res = await window.MKApi.get('/api/sales-orders', {
      deliveryDate: document.getElementById('moCreateDate').value,
      status: 'pending',
      deliveryStaffCode: document.getElementById('moCreateStaffCode').value.trim(),
      limit: 200
    });
    pendingOrders = F.getRows(res);
    document.getElementById('moPendingRows').innerHTML = pendingOrders.map(function (o) {
      var key = o.id || o.code;
      return '<tr><td><input class="mo-pick" type="checkbox" value="' + F.esc(key) + '"></td><td><b>' + F.esc(o.code || o.id) + '</b></td><td>' + F.esc(o.customerName || '') + '<div class="muted">' + F.esc(o.customerCode || '') + '</div></td><td>' + F.date(o.deliveryDate) + '</td><td>' + F.esc(o.deliveryStaffCode || '') + '</td><td>' + F.money(o.totalAmount || o.finalAmount || 0) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Không có đơn pending phù hợp. Hãy tạo đơn bán hoặc bỏ lọc NVGH.</td></tr>';
    document.querySelectorAll('.mo-pick').forEach(function (node) { node.onchange = renderPickedSummary; });
    renderPickedSummary();
    document.getElementById('moPendingPerf').textContent = 'API: ' + (res.__ms || 0) + 'ms | pending: ' + pendingOrders.length;
  }

  async function loadMasters() {
    var res = await window.MKApi.get('/api/master-orders', {
      deliveryDate: document.getElementById('moDeliveryDate').value,
      deliveryStaffCode: document.getElementById('moDeliveryStaffCode').value.trim(),
      limit: 100
    });
    var rows = F.getRows(res);
    document.getElementById('masterOrderRows').innerHTML = rows.map(function (m) {
      return '<tr><td><b>' + F.esc(m.code || m.id) + '</b></td><td>' + F.date(m.deliveryDate) + '</td><td>' + F.esc(m.deliveryStaffCode || '') + '</td><td>' + (m.orderCount || (m.salesOrderIds || []).length || 0) + '</td><td>' + F.money(m.totalAmount || 0) + '</td><td>' + statusBadge(m.status) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Chưa có đơn tổng phù hợp.</td></tr>';
    document.getElementById('masterOrderPerf').textContent = 'API: ' + (res.__ms || 0) + 'ms | rows: ' + rows.length;
  }

  async function createMaster() {
    var ids = selectedIds();
    if (!ids.length) return window.MKNotify.showError('Chọn ít nhất 1 đơn pending để gộp');
    var payload = {
      deliveryDate: document.getElementById('moCreateDate').value,
      deliveryStaffCode: document.getElementById('moCreateStaffCode').value.trim(),
      deliveryStaffName: document.getElementById('moCreateStaffName').value.trim(),
      salesOrderIds: ids
    };
    var btn = document.getElementById('createMasterBtn');
    window.MKNotify.setBusy(btn, true);
    try {
      var res = await window.MKApi.post('/api/master-orders/create', payload);
      document.getElementById('masterOrderResult').classList.remove('hidden');
      document.getElementById('masterOrderResult').innerHTML = '<div class="result-title">Gộp đơn thành công</div><pre>' + F.esc(JSON.stringify(res, null, 2)) + '</pre>';
      window.MKNotify.showSuccess('Đã gộp đơn tổng');
      await loadPendingOrders();
      await loadMasters();
    } catch (err) {
      window.MKNotify.showError(err.message);
      document.getElementById('masterOrderResult').classList.remove('hidden');
      document.getElementById('masterOrderResult').innerHTML = '<div class="result-title">Lỗi gộp đơn</div><pre>' + F.esc(JSON.stringify(err.data || { message: err.message }, null, 2)) + '</pre>';
    } finally {
      window.MKNotify.setBusy(btn, false);
    }
  }

  window.MKApp.registerPage('master-orders', {
    title: 'Đơn tổng',
    subtitle: 'Chọn đơn pending để gộp thành chuyến giao, không nhập mã thủ công',
    template: function () {
      return '<div class="grid-2">'
        + '<div class="card"><h3>Gộp đơn tổng</h3><div class="grid"><div><label>Ngày giao</label><input id="moCreateDate" type="date"></div><div><label>NVGH code</label><input id="moCreateStaffCode" value="GH001"></div><div><label>NVGH name</label><input id="moCreateStaffName" value="NV giao hàng test"></div></div><div class="actions" style="margin-top:10px"><button id="loadPendingOrdersBtn" class="primary">Tải đơn pending</button><button id="selectAllPendingBtn">Chọn tất cả</button><button id="unselectAllPendingBtn">Bỏ chọn</button></div><div id="moPendingPerf" class="perf"></div><div id="moPickSummary" class="preview-box">Chưa chọn đơn.</div><div class="table-wrap"><table><thead><tr><th></th><th>Mã đơn</th><th>Khách</th><th>Ngày giao</th><th>NVGH</th><th>Tiền</th></tr></thead><tbody id="moPendingRows"></tbody></table></div><div class="actions"><button id="createMasterBtn" class="success">Gộp đơn đã chọn</button></div><div id="masterOrderResult" class="result-panel hidden"></div></div>'
        + '<div class="card"><h3>Danh sách đơn tổng</h3><div class="grid"><input id="moDeliveryDate" type="date"><input id="moDeliveryStaffCode" placeholder="NVGH"></div><div class="actions" style="margin-top:10px"><button id="loadMastersBtn" class="primary">Tải đơn tổng</button><button id="clearMoDateBtn">Bỏ lọc ngày</button></div><div id="masterOrderPerf" class="perf"></div><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Ngày giao</th><th>NVGH</th><th>Số đơn</th><th>Tiền</th><th>Trạng thái</th></tr></thead><tbody id="masterOrderRows"></tbody></table></div></div></div>';
    },
    mount: async function () {
      ['moCreateDate', 'moDeliveryDate'].forEach(function (id) { document.getElementById(id).value = F.today(); });
      document.getElementById('loadPendingOrdersBtn').onclick = loadPendingOrders;
      document.getElementById('loadMastersBtn').onclick = loadMasters;
      document.getElementById('createMasterBtn').onclick = createMaster;
      document.getElementById('selectAllPendingBtn').onclick = function () { document.querySelectorAll('.mo-pick').forEach(function (x) { x.checked = true; }); renderPickedSummary(); };
      document.getElementById('unselectAllPendingBtn').onclick = function () { document.querySelectorAll('.mo-pick').forEach(function (x) { x.checked = false; }); renderPickedSummary(); };
      document.getElementById('clearMoDateBtn').onclick = function () { document.getElementById('moDeliveryDate').value = ''; loadMasters(); };
      await loadPendingOrders();
      await loadMasters();
    }
  });
}());
