(function () {
  'use strict';
  var F = window.MKFormat;
  var selectedCustomer = null;
  var selectedProduct = null;
  var cart = [];

  function setActive(tab) {
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  }

  function cartTotal() {
    return cart.reduce(function (sum, it) { return sum + Number(it.quantity || 0) * Number(it.price || 0); }, 0);
  }

  function renderCustomers() {
    setActive('customers');
    document.getElementById('salesMobileContent').innerHTML = '<h3>Khách hàng</h3><div class="inline-search"><input id="mobileCustomerQ" placeholder="Tìm mã/tên khách"><button id="mobileSearchCustomer" class="primary">Tìm</button></div><div id="mobileCustomerRows" class="order-list"></div>';
    document.getElementById('mobileSearchCustomer').onclick = async function () {
      var res = await window.MKApi.get('/api/customers', { q: document.getElementById('mobileCustomerQ').value, limit: 50 });
      var rows = F.getRows(res);
      document.getElementById('mobileCustomerRows').innerHTML = rows.map(function (c) {
        return '<div class="order-card" data-customer="' + F.esc(c.customerCode || c.code) + '"><b>' + F.esc(c.customerName || c.name) + '</b><div class="muted">' + F.esc(c.customerCode || c.code) + '</div><div class="muted">NVBH: ' + F.esc(c.salesStaffCode || '') + ' | NVGH: ' + F.esc(c.deliveryStaffCode || '') + '</div></div>';
      }).join('') || '<div class="muted">Không tìm thấy khách.</div>';
      document.querySelectorAll('[data-customer]').forEach(function (node) {
        node.onclick = function () {
          selectedCustomer = rows.find(function (c) { return (c.customerCode || c.code) === node.getAttribute('data-customer'); });
          window.MKNotify.showSuccess('Đã chọn khách');
          renderCart();
        };
      });
    };
    document.getElementById('mobileSearchCustomer').click();
  }

  function renderCartRows() {
    var node = document.getElementById('mobileCartRows');
    if (!node) return;
    node.innerHTML = cart.map(function (it, index) {
      return '<tr><td><b>' + F.esc(it.productCode) + '</b><div>' + F.esc(it.productName) + '</div></td><td><input class="mobile-qty" data-index="' + index + '" type="number" min="1" value="' + Number(it.quantity || 1) + '"></td><td>' + F.money(it.price || 0) + '</td><td>' + F.money(Number(it.quantity || 0) * Number(it.price || 0)) + '</td><td><button class="danger mobile-remove" data-index="' + index + '">Xóa</button></td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">Giỏ hàng trống.</td></tr>';
    document.getElementById('mobileCartTotal').textContent = F.money(cartTotal());
    document.querySelectorAll('.mobile-qty').forEach(function (input) {
      input.oninput = function () {
        cart[Number(input.dataset.index)].quantity = Math.max(1, Number(input.value || 1));
        renderCartRows();
      };
    });
    document.querySelectorAll('.mobile-remove').forEach(function (btn) {
      btn.onclick = function () { cart.splice(Number(btn.dataset.index), 1); renderCartRows(); };
    });
  }

  async function searchProducts() {
    var res = await window.MKApi.get('/api/products', { q: document.getElementById('mobileProductQ').value, limit: 30 });
    var rows = F.getRows(res);
    document.getElementById('mobileProductRows').innerHTML = rows.map(function (p) {
      return '<div class="order-card" data-product="' + F.esc(p.code) + '"><b>' + F.esc(p.name) + '</b><div class="muted">' + F.esc(p.code) + ' | ' + F.money(p.salePrice || 0) + '</div></div>';
    }).join('') || '<div class="muted">Không tìm thấy sản phẩm.</div>';
    document.querySelectorAll('[data-product]').forEach(function (node) {
      node.onclick = function () {
        selectedProduct = rows.find(function (p) { return p.code === node.getAttribute('data-product'); });
        var existed = cart.find(function (it) { return it.productCode === selectedProduct.code; });
        if (existed) existed.quantity += 1;
        else cart.push({ productCode: selectedProduct.code, productName: selectedProduct.name, quantity: 1, price: Number(selectedProduct.salePrice || 0), warehouseCode: selectedProduct.defaultWarehouse || selectedProduct.defaultWarehouseCode || 'KHO_HC' });
        window.MKNotify.showSuccess('Đã thêm sản phẩm');
        renderCartRows();
      };
    });
  }

  function renderCart() {
    setActive('cart');
    var customer = selectedCustomer ? (selectedCustomer.customerName || selectedCustomer.name) + ' - ' + (selectedCustomer.customerCode || selectedCustomer.code) : 'Chưa chọn khách';
    document.getElementById('salesMobileContent').innerHTML = '<h3>Đặt hàng</h3><div class="selected-box">' + F.esc(customer) + '</div><div class="inline-search"><input id="mobileProductQ" placeholder="Tìm sản phẩm"><button id="mobileSearchProduct" class="primary">Tìm SP</button></div><div id="mobileProductRows" class="order-list"></div><div class="table-wrap"><table><thead><tr><th>SP</th><th>SL</th><th>Giá</th><th>Tiền</th><th></th></tr></thead><tbody id="mobileCartRows"></tbody></table></div><div class="preview-box">Tổng giỏ: <b id="mobileCartTotal">0</b></div><label>Ngày giao</label><input id="mobileDeliveryDate" type="date" value="' + F.today() + '"><label>NVBH</label><input id="mobileSalesStaffCode" value="' + F.esc((selectedCustomer && selectedCustomer.salesStaffCode) || 'NV001') + '"><label>NVGH</label><input id="mobileDeliveryStaffCode" value="' + F.esc((selectedCustomer && selectedCustomer.deliveryStaffCode) || 'GH001') + '"><button id="mobileCreateOrder" class="primary">Gửi đơn pending</button><div id="mobileOrderResult" class="result-panel hidden"></div>';
    document.getElementById('mobileSearchProduct').onclick = searchProducts;
    document.getElementById('mobileCreateOrder').onclick = createOrder;
    renderCartRows();
  }

  async function createOrder() {
    if (!selectedCustomer) return window.MKNotify.showError('Chọn khách trước');
    if (!cart.length) return window.MKNotify.showError('Giỏ hàng trống');
    var payload = {
      customerCode: selectedCustomer.customerCode || selectedCustomer.code,
      customerName: selectedCustomer.customerName || selectedCustomer.name,
      deliveryDate: document.getElementById('mobileDeliveryDate').value,
      salesStaffCode: document.getElementById('mobileSalesStaffCode').value,
      deliveryStaffCode: document.getElementById('mobileDeliveryStaffCode').value,
      source: 'MOBILE_SALES',
      items: cart
    };
    var res = await window.MKApi.post('/api/sales-orders', payload);
    document.getElementById('mobileOrderResult').classList.remove('hidden');
    document.getElementById('mobileOrderResult').innerHTML = '<div class="result-title">Đã gửi đơn</div><pre>' + F.esc(JSON.stringify(res, null, 2)) + '</pre>';
    cart = [];
    renderCartRows();
    window.MKNotify.showSuccess('Đã gửi đơn pending');
  }

  async function renderOrders() {
    setActive('orders');
    document.getElementById('salesMobileContent').innerHTML = '<h3>Báo cáo đơn</h3><button id="mobileLoadOrders" class="primary">Tải đơn</button><div id="mobileOrderRows" class="order-list"></div>';
    document.getElementById('mobileLoadOrders').onclick = async function () {
      var res = await window.MKApi.get('/api/sales-orders', { salesStaffCode: document.getElementById('mobileSalesStaffCode') ? document.getElementById('mobileSalesStaffCode').value : '', limit: 50 });
      var rows = F.getRows(res);
      document.getElementById('mobileOrderRows').innerHTML = rows.map(function (o) { return '<div class="order-card"><b>' + F.esc(o.code) + '</b><div>' + F.esc(o.customerName || '') + '</div><div class="money-line"><span class="money-pill">' + F.money(o.totalAmount || 0) + '</span><span class="money-pill">' + F.esc(o.status) + '</span></div></div>'; }).join('') || '<div class="muted">Chưa có đơn.</div>';
    };
    document.getElementById('mobileLoadOrders').click();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('[data-tab="customers"]').onclick = renderCustomers;
    document.querySelector('[data-tab="cart"]').onclick = renderCart;
    document.querySelector('[data-tab="orders"]').onclick = renderOrders;
    renderCustomers();
  });
}());
