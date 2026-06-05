(function () {
  'use strict';
  var F = window.MKFormat;
  var selectedOrder = null;
  var selectedItems = [];

  function orderKey(order) { return order.id || order.code || order.salesOrderId || order.salesOrderCode || ''; }

  async function loadCandidateOrders() {
    var res = await window.MKApi.get('/api/sales-orders', {
      q: document.getElementById('returnOrderQ').value.trim(),
      deliveryDate: document.getElementById('returnDeliveryDate').value,
      status: document.getElementById('returnOrderStatus').value,
      limit: 100
    });
    var rows = F.getRows(res);
    document.getElementById('returnOrderRows').innerHTML = rows.map(function (o, index) {
      return '<tr><td><button class="pick-return-order" data-index="' + index + '">Chọn</button></td><td><b>' + F.esc(o.code || o.id) + '</b></td><td>' + F.esc(o.customerName || '') + '<div class="muted">' + F.esc(o.customerCode || '') + '</div></td><td>' + F.date(o.deliveryDate) + '</td><td>' + F.money(o.totalAmount || o.finalAmount || 0) + '</td><td>' + F.esc(o.status || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Không có đơn phù hợp.</td></tr>';
    document.querySelectorAll('.pick-return-order').forEach(function (btn) {
      btn.onclick = function () { selectOrder(rows[Number(btn.dataset.index)]); };
    });
    document.getElementById('returnOrderPerf').textContent = 'API: ' + (res.__ms || 0) + 'ms | rows: ' + rows.length;
  }

  async function selectOrder(order) {
    selectedOrder = order;
    var detail = order;
    try {
      var res = await window.MKApi.get('/api/sales-orders/' + encodeURIComponent(orderKey(order)));
      detail = res.data || res.order || res;
    } catch (err) {}
    selectedItems = (detail.items || order.items || []).map(function (it) {
      return {
        productCode: it.productCode,
        productName: it.productName,
        orderedQty: Number(it.quantity || it.qty || 0),
        price: Number(it.price || it.salePrice || 0),
        returnQty: 0
      };
    });
    document.getElementById('returnSelectedOrder').innerHTML = '<b>' + F.esc(order.code || order.id) + '</b><div class="muted">' + F.esc(order.customerName || '') + ' - ' + F.esc(order.customerCode || '') + '</div>';
    renderReturnItems();
  }

  function renderReturnItems() {
    document.getElementById('returnItemRows').innerHTML = selectedItems.map(function (it, index) {
      return '<tr><td><b>' + F.esc(it.productCode) + '</b></td><td>' + F.esc(it.productName) + '</td><td>' + it.orderedQty + '</td><td>' + F.money(it.price) + '</td><td><input class="ro-qty" data-index="' + index + '" type="number" min="0" max="' + it.orderedQty + '" value="' + Number(it.returnQty || 0) + '"></td><td><b>' + F.money(Number(it.returnQty || 0) * Number(it.price || 0)) + '</b></td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Chưa chọn đơn hoặc đơn không có sản phẩm.</td></tr>';
    document.querySelectorAll('.ro-qty').forEach(function (node) {
      node.oninput = function () {
        var item = selectedItems[Number(node.dataset.index)];
        item.returnQty = Math.max(0, Math.min(Number(node.value || 0), Number(item.orderedQty || 0)));
        node.value = item.returnQty;
        renderReturnItems();
      };
    });
    var total = selectedItems.reduce(function (sum, it) { return sum + Number(it.returnQty || 0) * Number(it.price || 0); }, 0);
    document.getElementById('returnPreview').innerHTML = 'Tiền trả dự kiến: <b>' + F.money(total) + '</b>';
  }

  async function createReturn() {
    if (!selectedOrder) return window.MKNotify.showError('Chọn đơn bán trước');
    var lines = selectedItems.filter(function (it) { return Number(it.returnQty || 0) > 0; }).map(function (it) {
      return { productCode: it.productCode, productName: it.productName, returnQty: it.returnQty };
    });
    if (!lines.length) return window.MKNotify.showError('Nhập số lượng trả lớn hơn 0');
    var btn = document.getElementById('createReturnBtn');
    window.MKNotify.setBusy(btn, true);
    try {
      var payload = { salesOrderId: orderKey(selectedOrder), items: lines, returnLines: lines, note: document.getElementById('returnNote').value.trim() };
      var res = await window.MKApi.post('/api/return-orders', payload);
      document.getElementById('returnResult').classList.remove('hidden');
      document.getElementById('returnResult').innerHTML = '<div class="result-title">Tạo phiếu trả thành công</div><pre>' + F.esc(JSON.stringify(res, null, 2)) + '</pre>';
      window.MKNotify.showSuccess('Đã tạo phiếu trả hàng');
      await loadReturns();
    } catch (err) {
      window.MKNotify.showError(err.message);
    } finally {
      window.MKNotify.setBusy(btn, false);
    }
  }

  async function loadReturns() {
    var res = await window.MKApi.get('/api/return-orders', { salesOrderId: document.getElementById('returnSalesOrderFilter').value.trim(), limit: 100 });
    var rows = F.getRows(res);
    document.getElementById('returnRows').innerHTML = rows.map(function (r) {
      return '<tr><td><b>' + F.esc(r.code || r.id) + '</b></td><td>' + F.esc(r.salesOrderCode || r.salesOrderId || '') + '</td><td>' + F.esc(r.customerName || '') + '</td><td>' + F.money(r.totalReturnAmount || r.amount || 0) + '</td><td>' + F.esc(r.status || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">Chưa có hàng trả.</td></tr>';
  }

  window.MKApp.registerPage('returns', {
    title: 'Trả hàng',
    subtitle: 'Chọn đơn, hiện sản phẩm gốc, nhập số lượng trả; không nhập JSON thô',
    template: function () {
      return '<div class="grid-2">'
        + '<div class="card"><h3>Tạo phiếu trả</h3><div class="grid"><div><label>Tìm kiếm</label><input id="returnOrderQ" placeholder="Mã đơn / khách hàng"></div><div><label>Ngày giao</label><input id="returnDeliveryDate" type="date"></div><div><label>Trạng thái</label><select id="returnOrderStatus"><option value="all">Tất cả</option><option value="assigned">assigned</option><option value="delivered">delivered</option><option value="pending">pending</option></select></div></div><div class="actions"><button id="loadReturnCandidatesBtn" class="primary">Tải đơn</button><button id="clearReturnDateBtn">Bỏ lọc ngày</button></div><div id="returnOrderPerf" class="perf"></div><div class="table-wrap"><table><thead><tr><th></th><th>Mã đơn</th><th>Khách</th><th>Ngày</th><th>Tiền</th><th>Trạng thái</th></tr></thead><tbody id="returnOrderRows"></tbody></table></div><div class="selected-box" id="returnSelectedOrder">Chưa chọn đơn</div><div class="table-wrap"><table><thead><tr><th>Mã SP</th><th>Tên SP</th><th>SL đặt</th><th>Giá</th><th>SL trả</th><th>Tiền trả</th></tr></thead><tbody id="returnItemRows"></tbody></table></div><div id="returnPreview" class="preview-box">Tiền trả dự kiến: 0</div><label>Ghi chú</label><input id="returnNote" placeholder="Ghi chú trả hàng"><button id="createReturnBtn" class="primary">Tạo phiếu trả</button><div id="returnResult" class="result-panel hidden"></div></div>'
        + '<div class="card"><h3>Danh sách hàng trả</h3><div class="inline-search"><input id="returnSalesOrderFilter" placeholder="Lọc theo mã đơn bán"><button id="loadReturnsBtn" class="primary">Tìm</button></div><table><thead><tr><th>Mã RO</th><th>Đơn bán</th><th>Khách</th><th>Tiền trả</th><th>Trạng thái</th></tr></thead><tbody id="returnRows"></tbody></table></div></div>';
    },
    mount: async function () {
      document.getElementById('returnDeliveryDate').value = F.today();
      document.getElementById('loadReturnCandidatesBtn').onclick = loadCandidateOrders;
      document.getElementById('clearReturnDateBtn').onclick = function () { document.getElementById('returnDeliveryDate').value = ''; loadCandidateOrders(); };
      document.getElementById('createReturnBtn').onclick = createReturn;
      document.getElementById('loadReturnsBtn').onclick = loadReturns;
      renderReturnItems();
      await loadCandidateOrders();
      await loadReturns();
    }
  });
}());
