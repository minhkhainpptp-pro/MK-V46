(function () {
  'use strict';
  var F = window.MKFormat;
  var selectedOrder = null;
  var selectedDetail = null;

  function badge(status) {
    var s = String(status || 'pending');
    return '<span class="badge badge-' + F.esc(s) + '">' + F.esc(s) + '</span>';
  }

  function getFilters() {
    return {
      deliveryDate: document.getElementById('deliveryDate').value,
      deliveryStaffCode: document.getElementById('deliveryStaffSearch').value.trim(),
      salesStaffCode: document.getElementById('salesStaffSearch').value.trim(),
      status: document.getElementById('deliveryStatus').value
    };
  }

  function renderRows(rows) {
    if (!rows.length) return '<div class="muted">Không có đơn giao phù hợp bộ lọc.</div>';
    return rows.map(function (o) {
      var debt = Number(o.debtAmount || 0);
      return '<div class="order-card" data-order-id="' + F.esc(o.salesOrderId || o.id || o.code) + '">'
        + '<div class="order-top"><div><div class="order-code">' + F.esc(o.code || o.salesOrderCode || '') + '</div>'
        + '<div>' + F.esc(o.customerName || '') + ' - ' + F.esc(o.customerCode || '') + '</div>'
        + '<div class="muted">NVBH: ' + F.esc(o.salesStaffCode || o.salesStaffName || '') + ' | NVGH: ' + F.esc(o.deliveryStaffCode || o.deliveryStaffName || '') + '</div></div>'
        + '<div>' + badge(o.accountingStatus === 'posted' ? 'posted' : (o.deliveryStatus || o.status)) + '</div></div>'
        + '<div class="money-line">'
        + '<span class="money-pill">Đơn: ' + F.money(o.totalAmount || o.finalAmount || 0) + '</span>'
        + '<span class="money-pill">Trả: ' + F.money(o.returnAmount || 0) + '</span>'
        + '<span class="money-pill">Thu: ' + F.money(o.paidAmount || 0) + '</span>'
        + '<span class="money-pill">Còn: ' + F.money(debt) + '</span>'
        + '</div></div>';
    }).join('');
  }

  async function loadOrders() {
    var result = await window.MKApi.get('/api/mobile/delivery/orders', getFilters());
    var rows = F.getRows(result);
    document.getElementById('deliveryRows').innerHTML = renderRows(rows);
    document.getElementById('deliveryPerf').textContent = 'API: ' + ((result.perf && result.perf.totalMs) || result.__ms || 0) + 'ms | rows: ' + rows.length;
    document.querySelectorAll('[data-order-id]').forEach(function (node) {
      node.addEventListener('click', function () { openDetail(node.getAttribute('data-order-id')); });
    });
  }

  function rowQty(row) {
    return Number(row.orderedQty || row.quantity || row.qty || 0);
  }

  async function openDetail(id) {
    selectedOrder = id;
    var payload = await window.MKApi.get('/api/mobile/delivery/orders/' + encodeURIComponent(id));
    selectedDetail = payload.data || payload.order || payload;
    if (payload.order && !selectedDetail.items) selectedDetail = payload.order;
    var items = selectedDetail.items || [];
    var html = '<div class="detail-panel"><div class="detail-head"><div><b>' + F.esc(selectedDetail.salesOrderCode || selectedDetail.code || id) + '</b><div class="muted">' + F.esc(selectedDetail.customerName || '') + ' - ' + F.esc(selectedDetail.customerCode || '') + '</div></div><button id="closeDeliveryDetail">Đóng</button></div>'
      + '<div class="detail-body"><h3>Sản phẩm giao / trả</h3><div class="table-wrap"><table><thead><tr><th>Mã SP</th><th>Tên SP</th><th>SL đặt</th><th>Đơn giá</th><th>Thành tiền</th><th>SL trả</th></tr></thead><tbody>'
      + items.map(function (it, index) {
        var qty = rowQty(it);
        var price = Number(it.salePrice || it.price || 0);
        return '<tr><td>' + F.esc(it.productCode) + '</td><td>' + F.esc(it.productName) + '</td><td>' + qty + '</td><td>' + F.money(price) + '</td><td>' + F.money(qty * price) + '</td><td><input class="return-input" data-index="' + index + '" min="0" max="' + qty + '" type="number" value="' + Number(it.returnQty || 0) + '"></td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<div class="grid-3 card"><div><label>Tiền mặt</label><input id="cashAmount" type="number" value="0"></div><div><label>Chuyển khoản</label><input id="bankAmount" type="number" value="0"></div><div><label>Trả thưởng</label><input id="bonusAmount" type="number" value="0"></div><div style="grid-column:1/-1"><label>Ghi chú</label><input id="deliveryNote" placeholder="Ghi chú giao hàng"></div></div>'
      + '<div id="deliveryPreview" class="preview-box"></div><div class="actions" style="margin-top:12px"><button id="confirmDeliveredBtn" class="success">Xác nhận giao</button><button id="confirmFailedBtn" class="danger">Không giao được</button></div></div></div>';
    document.getElementById('deliveryDetail').innerHTML = html;
    document.getElementById('closeDeliveryDetail').onclick = function () { document.getElementById('deliveryDetail').innerHTML = ''; };
    document.querySelectorAll('.return-input,#cashAmount,#bankAmount,#bonusAmount').forEach(function (node) { node.addEventListener('input', updatePreview); });
    document.getElementById('confirmDeliveredBtn').onclick = function () { confirmDelivery('delivered'); };
    document.getElementById('confirmFailedBtn').onclick = function () { confirmDelivery('failed'); };
    updatePreview();
  }

  function collectReturnLines() {
    var items = (selectedDetail && selectedDetail.items) || [];
    return Array.prototype.slice.call(document.querySelectorAll('.return-input')).map(function (input) {
      var index = Number(input.getAttribute('data-index'));
      var item = items[index] || {};
      var max = rowQty(item);
      var returnQty = Math.max(0, Math.min(Number(input.value || 0), max));
      input.value = returnQty;
      return { productCode: item.productCode, productName: item.productName, returnQty: returnQty, orderedQty: max };
    }).filter(function (line) { return Number(line.returnQty || 0) > 0; });
  }

  function updatePreview() {
    var items = (selectedDetail && selectedDetail.items) || [];
    var returnLines = collectReturnLines();
    var returnAmount = returnLines.reduce(function (sum, line) {
      var item = items.find(function (x) { return x.productCode === line.productCode; }) || {};
      return sum + Number(line.returnQty || 0) * Number(item.salePrice || item.price || 0);
    }, 0);
    var total = Number((selectedDetail && selectedDetail.totalAmount) || 0);
    var paid = Number(document.getElementById('cashAmount').value || 0) + Number(document.getElementById('bankAmount').value || 0) + Number(document.getElementById('bonusAmount').value || 0);
    document.getElementById('deliveryPreview').innerHTML = '<b>Xem trước</b><div class="delivery-summary"><div class="box">Tiền đơn<b>' + F.money(total) + '</b></div><div class="box">Tiền trả<b>' + F.money(returnAmount) + '</b></div><div class="box">Tiền thu<b>' + F.money(paid) + '</b></div><div class="box">Còn lại<b>' + F.money(total - returnAmount - paid) + '</b></div></div>';
  }

  async function confirmDelivery(status) {
    var btn = status === 'delivered' ? document.getElementById('confirmDeliveredBtn') : document.getElementById('confirmFailedBtn');
    window.MKNotify.setBusy(btn, true);
    try {
      var payload = {
        operationId: 'UI_CONFIRM_DELIVERY:' + selectedOrder + ':' + Date.now(),
        salesOrderId: selectedOrder,
        deliveryStatus: status,
        returnLines: collectReturnLines(),
        cashAmount: Number(document.getElementById('cashAmount').value || 0),
        bankAmount: Number(document.getElementById('bankAmount').value || 0),
        bonusAmount: Number(document.getElementById('bonusAmount').value || 0),
        note: document.getElementById('deliveryNote').value || ''
      };
      await window.MKApi.post('/api/mobile/delivery/confirm', payload);
      window.MKNotify.showSuccess(status === 'delivered' ? 'Đã xác nhận giao' : 'Đã lưu trạng thái không giao');
      document.getElementById('deliveryDetail').innerHTML = '';
      await loadOrders();
    } catch (err) {
      window.MKNotify.showError(err.message);
    } finally {
      window.MKNotify.setBusy(btn, false);
    }
  }

  window.MKApp.registerPage('delivery', {
    title: 'Đơn giao hàng hôm nay',
    subtitle: 'Lọc ngày giao, NVGH, NVBH, trạng thái. Click đơn để xử lý giao hàng.',
    template: function () {
      return '<div class="card"><div class="grid"><div><label>Ngày giao</label><input id="deliveryDate" type="date"></div><div><label>NVGH</label><input id="deliveryStaffSearch" placeholder="VD: GH001"></div><div><label>NVBH</label><input id="salesStaffSearch" placeholder="VD: NV001"></div><div><label>Trạng thái</label><select id="deliveryStatus"><option value="all">Tất cả</option><option value="assigned">Chưa giao</option><option value="delivered">Đã giao</option><option value="failed">Không giao</option><option value="posted">Đã kế toán</option></select></div></div><div class="actions"><button id="loadDeliveryBtn" class="primary">Tải danh sách</button></div><div id="deliveryPerf" class="perf"></div></div><div class="card"><div id="deliveryRows" class="order-list"></div></div><div id="deliveryDetail"></div>';
    },
    mount: async function () {
      document.getElementById('deliveryDate').value = F.today();
      document.getElementById('loadDeliveryBtn').onclick = loadOrders;
      await loadOrders();
    }
  });
}());
