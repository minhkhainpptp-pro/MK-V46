(function () {
  'use strict';
  var F = window.MKFormat;
  var selectedCustomer = null;
  var selectedProduct = null;
  var orderItems = [];

  function statusBadge(status) {
    var s = String(status || 'pending');
    return '<span class="badge badge-' + F.esc(s) + '">' + F.esc(s) + '</span>';
  }

  function renderResult(nodeId, data, okTitle) {
    var node = document.getElementById(nodeId);
    if (!node) return;
    node.classList.remove('hidden');
    node.innerHTML = '<div class="result-title">' + F.esc(okTitle || 'Kết quả xử lý') + '</div><pre>' + F.esc(JSON.stringify(data, null, 2)) + '</pre>';
  }

  function itemTotal() {
    return orderItems.reduce(function (sum, item) { return sum + Number(item.quantity || 0) * Number(item.price || 0); }, 0);
  }

  function renderItems() {
    var tbody = document.getElementById('soItemRows');
    if (!tbody) return;
    tbody.innerHTML = orderItems.map(function (it, index) {
      return '<tr>'
        + '<td><b>' + F.esc(it.productCode) + '</b></td>'
        + '<td>' + F.esc(it.productName) + '</td>'
        + '<td><input class="so-item-qty" data-index="' + index + '" type="number" min="1" value="' + Number(it.quantity || 1) + '"></td>'
        + '<td><input class="so-item-price" data-index="' + index + '" type="number" min="0" value="' + Number(it.price || 0) + '"></td>'
        + '<td>' + F.esc(it.warehouseCode || 'KHO_HC') + '</td>'
        + '<td><b>' + F.money(Number(it.quantity || 0) * Number(it.price || 0)) + '</b></td>'
        + '<td><button class="danger so-remove-item" data-index="' + index + '">Xóa</button></td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="7" class="muted">Chưa có sản phẩm trong đơn.</td></tr>';
    document.getElementById('soTotalPreview').textContent = F.money(itemTotal());

    document.querySelectorAll('.so-item-qty').forEach(function (node) {
      node.oninput = function () { orderItems[Number(node.dataset.index)].quantity = Math.max(1, Number(node.value || 1)); renderItems(); };
    });
    document.querySelectorAll('.so-item-price').forEach(function (node) {
      node.oninput = function () { orderItems[Number(node.dataset.index)].price = Math.max(0, Number(node.value || 0)); renderItems(); };
    });
    document.querySelectorAll('.so-remove-item').forEach(function (node) {
      node.onclick = function () { orderItems.splice(Number(node.dataset.index), 1); renderItems(); };
    });
  }

  async function searchCustomers() {
    var q = document.getElementById('soCustomerQ').value.trim();
    var res = await window.MKApi.get('/api/customers', { q: q, limit: 20 });
    var rows = F.getRows(res);
    var box = document.getElementById('soCustomerResults');
    box.innerHTML = rows.map(function (c) {
      var code = c.customerCode || c.code;
      return '<button class="pick-card" data-code="' + F.esc(code) + '"><b>' + F.esc(c.customerName || c.name) + '</b><span>' + F.esc(code) + ' | NVBH: ' + F.esc(c.salesStaffCode || '') + ' | NVGH: ' + F.esc(c.deliveryStaffCode || '') + '</span></button>';
    }).join('') || '<div class="muted">Không tìm thấy khách hàng.</div>';
    document.querySelectorAll('#soCustomerResults [data-code]').forEach(function (node) {
      node.onclick = function () {
        selectedCustomer = rows.find(function (c) { return String(c.customerCode || c.code) === node.dataset.code; });
        document.getElementById('soSelectedCustomer').innerHTML = '<b>' + F.esc(selectedCustomer.customerName || selectedCustomer.name) + '</b><div class="muted">' + F.esc(selectedCustomer.customerCode || selectedCustomer.code) + '</div>';
        document.getElementById('soSalesStaffCode').value = selectedCustomer.salesStaffCode || '';
        document.getElementById('soDeliveryStaffCode').value = selectedCustomer.deliveryStaffCode || '';
        window.MKNotify.showSuccess('Đã chọn khách hàng');
      };
    });
  }

  async function searchProducts() {
    var q = document.getElementById('soProductQ').value.trim();
    var res = await window.MKApi.get('/api/products', { q: q, limit: 20 });
    var rows = F.getRows(res);
    var box = document.getElementById('soProductResults');
    box.innerHTML = rows.map(function (p) {
      return '<button class="pick-card" data-code="' + F.esc(p.code) + '"><b>' + F.esc(p.name) + '</b><span>' + F.esc(p.code) + ' | Giá: ' + F.money(p.salePrice || 0) + ' | Kho: ' + F.esc(p.defaultWarehouse || p.defaultWarehouseCode || 'KHO_HC') + '</span></button>';
    }).join('') || '<div class="muted">Không tìm thấy sản phẩm.</div>';
    document.querySelectorAll('#soProductResults [data-code]').forEach(function (node) {
      node.onclick = function () {
        selectedProduct = rows.find(function (p) { return String(p.code) === node.dataset.code; });
        document.getElementById('soSelectedProduct').innerHTML = '<b>' + F.esc(selectedProduct.name) + '</b><div class="muted">' + F.esc(selectedProduct.code) + '</div>';
        document.getElementById('soProductPrice').value = Number(selectedProduct.salePrice || 0);
        document.getElementById('soWarehouseCode').value = selectedProduct.defaultWarehouse || selectedProduct.defaultWarehouseCode || 'KHO_HC';
      };
    });
  }

  function addItem() {
    if (!selectedProduct) return window.MKNotify.showError('Chọn sản phẩm trước');
    var qty = Math.max(1, Number(document.getElementById('soProductQty').value || 1));
    var price = Math.max(0, Number(document.getElementById('soProductPrice').value || selectedProduct.salePrice || 0));
    var warehouseCode = document.getElementById('soWarehouseCode').value.trim() || 'KHO_HC';
    var existed = orderItems.find(function (it) { return it.productCode === selectedProduct.code && it.warehouseCode === warehouseCode; });
    if (existed) {
      existed.quantity = Number(existed.quantity || 0) + qty;
      existed.price = price;
    } else {
      orderItems.push({ productCode: selectedProduct.code, productName: selectedProduct.name, quantity: qty, price: price, warehouseCode: warehouseCode });
    }
    renderItems();
  }

  async function loadSalesOrders() {
    var res = await window.MKApi.get('/api/sales-orders', {
      q: document.getElementById('soQ').value.trim(),
      deliveryDate: document.getElementById('soDeliveryDate').value,
      status: document.getElementById('soStatus').value,
      limit: 100
    });
    var rows = F.getRows(res);
    document.getElementById('salesOrderRows').innerHTML = rows.map(function (o) {
      return '<tr><td><b>' + F.esc(o.code || o.id) + '</b></td><td>' + F.esc(o.customerName || '') + '<div class="muted">' + F.esc(o.customerCode || '') + '</div></td><td>' + F.date(o.deliveryDate) + '</td><td>' + F.money(o.totalAmount || o.payableAmount || 0) + '</td><td>' + statusBadge(o.status) + '</td><td>' + statusBadge(o.accountingStatus) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Chưa có đơn phù hợp bộ lọc.</td></tr>';
    document.getElementById('salesOrderPerf').textContent = 'API: ' + (res.__ms || (res.perf && res.perf.totalMs) || 0) + 'ms | rows: ' + rows.length;
  }

  async function createSalesOrder() {
    if (!selectedCustomer) return window.MKNotify.showError('Chọn khách hàng trước');
    if (!orderItems.length) return window.MKNotify.showError('Thêm ít nhất 1 sản phẩm');
    var btn = document.getElementById('createSalesOrderBtn');
    window.MKNotify.setBusy(btn, true);
    try {
      var payload = {
        customerCode: selectedCustomer.customerCode || selectedCustomer.code,
        customerName: selectedCustomer.customerName || selectedCustomer.name,
        salesStaffCode: document.getElementById('soSalesStaffCode').value.trim(),
        salesStaffName: document.getElementById('soSalesStaffName').value.trim(),
        deliveryStaffCode: document.getElementById('soDeliveryStaffCode').value.trim(),
        deliveryStaffName: document.getElementById('soDeliveryStaffName').value.trim(),
        deliveryDate: document.getElementById('soCreateDeliveryDate').value,
        source: 'WEB',
        items: orderItems,
        note: document.getElementById('soNote').value.trim()
      };
      var res = await window.MKApi.post('/api/sales-orders', payload);
      renderResult('salesOrderResult', res, 'Tạo đơn thành công');
      window.MKNotify.showSuccess('Đã tạo đơn bán pending');
      orderItems = [];
      renderItems();
      await loadSalesOrders();
    } catch (err) {
      window.MKNotify.showError(err.message);
      renderResult('salesOrderResult', err.data || { message: err.message }, 'Lỗi tạo đơn');
    } finally {
      window.MKNotify.setBusy(btn, false);
    }
  }

  window.MKApp.registerPage('sales-orders', {
    title: 'Đơn bán',
    subtitle: 'Tạo đơn bằng form vận hành, đơn mới chỉ ở pending và chưa sinh công nợ',
    template: function () {
      return '<div class="grid-2">'
        + '<div class="card"><h3>Tạo đơn bán</h3>'
        + '<div class="section-title">1. Khách hàng</div><div class="inline-search"><input id="soCustomerQ" placeholder="Tìm mã/tên khách hàng"><button id="soSearchCustomerBtn">Tìm khách</button></div><div id="soCustomerResults" class="pick-list"></div><div id="soSelectedCustomer" class="selected-box muted">Chưa chọn khách hàng</div>'
        + '<div class="section-title">2. Thông tin giao hàng</div><div class="grid"><div><label>Ngày giao</label><input id="soCreateDeliveryDate" type="date"></div><div><label>NVBH code</label><input id="soSalesStaffCode"></div><div><label>NVBH name</label><input id="soSalesStaffName" placeholder="Nếu có"></div><div><label>NVGH code</label><input id="soDeliveryStaffCode"></div><div><label>NVGH name</label><input id="soDeliveryStaffName" placeholder="Nếu có"></div></div>'
        + '<div class="section-title">3. Sản phẩm</div><div class="inline-search"><input id="soProductQ" placeholder="Tìm mã/tên sản phẩm"><button id="soSearchProductBtn">Tìm SP</button></div><div id="soProductResults" class="pick-list"></div><div id="soSelectedProduct" class="selected-box muted">Chưa chọn sản phẩm</div><div class="grid"><div><label>Số lượng</label><input id="soProductQty" type="number" min="1" value="1"></div><div><label>Đơn giá</label><input id="soProductPrice" type="number" min="0" value="0"></div><div><label>Kho</label><input id="soWarehouseCode" value="KHO_HC"></div></div><div class="actions"><button id="soAddItemBtn">Thêm vào đơn</button></div>'
        + '<div class="table-wrap"><table><thead><tr><th>Mã SP</th><th>Tên SP</th><th>SL</th><th>Giá</th><th>Kho</th><th>Tiền</th><th></th></tr></thead><tbody id="soItemRows"></tbody></table></div><div class="preview-box"><b>Tổng đơn: <span id="soTotalPreview">0</span></b></div><label>Ghi chú</label><input id="soNote" placeholder="Ghi chú đơn hàng"><div class="actions"><button id="createSalesOrderBtn" class="primary">Tạo đơn pending</button></div><div id="salesOrderResult" class="result-panel hidden"></div></div>'
        + '<div class="card"><h3>Danh sách đơn</h3><div class="grid"><input id="soQ" placeholder="Tìm đơn/khách"><input id="soDeliveryDate" type="date"><select id="soStatus"><option value="all">Tất cả</option><option value="pending">pending</option><option value="assigned">assigned</option><option value="delivered">delivered</option><option value="cancelled">cancelled</option></select></div><div class="actions" style="margin-top:10px"><button id="loadSalesOrdersBtn" class="primary">Tải đơn</button><button id="clearSoDateBtn">Bỏ lọc ngày</button></div><div id="salesOrderPerf" class="perf"></div><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Khách</th><th>Ngày giao</th><th>Tiền</th><th>Trạng thái</th><th>Kế toán</th></tr></thead><tbody id="salesOrderRows"></tbody></table></div></div></div>';
    },
    mount: async function () {
      document.getElementById('soCreateDeliveryDate').value = F.today();
      document.getElementById('soDeliveryDate').value = F.today();
      document.getElementById('soSearchCustomerBtn').onclick = searchCustomers;
      document.getElementById('soSearchProductBtn').onclick = searchProducts;
      document.getElementById('soAddItemBtn').onclick = addItem;
      document.getElementById('loadSalesOrdersBtn').onclick = loadSalesOrders;
      document.getElementById('clearSoDateBtn').onclick = function () { document.getElementById('soDeliveryDate').value = ''; loadSalesOrders(); };
      document.getElementById('createSalesOrderBtn').onclick = createSalesOrder;
      renderItems();
      await loadSalesOrders();
    }
  });
}());
