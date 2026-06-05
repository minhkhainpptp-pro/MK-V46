(function () {
  'use strict';
  var F = window.MKFormat;
  var selectedCustomer = null;
  var cart = [];

  function setActive(tab) {
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  }

  function renderCustomers() {
    setActive('customers');
    document.getElementById('salesMobileContent').innerHTML = '<h3>Khách hàng</h3><input id="mobileCustomerQ" placeholder="Tìm khách"><button id="mobileSearchCustomer" class="primary">Tìm</button><div id="mobileCustomerRows" class="order-list"></div>';
    document.getElementById('mobileSearchCustomer').onclick = async function () {
      var res = await window.MKApi.get('/api/customers', { q: document.getElementById('mobileCustomerQ').value, limit: 50 });
      var rows = F.getRows(res);
      document.getElementById('mobileCustomerRows').innerHTML = rows.map(function (c) { return '<div class="order-card" data-customer="' + F.esc(c.customerCode || c.code) + '"><b>' + F.esc(c.customerName || c.name) + '</b><div class="muted">' + F.esc(c.customerCode || c.code) + '</div></div>'; }).join('');
      document.querySelectorAll('[data-customer]').forEach(function (node) { node.onclick = function () { selectedCustomer = rows.find(function (c) { return (c.customerCode || c.code) === node.getAttribute('data-customer'); }); window.MKNotify.showSuccess('Đã chọn khách'); renderCart(); }; });
    };
  }

  function renderCart() {
    setActive('cart');
    var customer = selectedCustomer ? (selectedCustomer.customerName || selectedCustomer.name) + ' - ' + (selectedCustomer.customerCode || selectedCustomer.code) : 'Chưa chọn khách';
    document.getElementById('salesMobileContent').innerHTML = '<h3>Đặt hàng</h3><div class="card">' + F.esc(customer) + '</div><textarea id="mobileItems" rows="8">' + F.esc(JSON.stringify(cart.length ? cart : [{ productCode: 'P001', productName: 'Sản phẩm test', quantity: 1, price: 10000, warehouseCode: 'KHO_HC' }], null, 2)) + '</textarea><label>Ngày giao</label><input id="mobileDeliveryDate" type="date" value="' + F.today() + '"><label>NVBH</label><input id="mobileSalesStaffCode" value="NV001"><label>NVGH</label><input id="mobileDeliveryStaffCode" value="GH001"><button id="mobileCreateOrder" class="primary">Gửi đơn pending</button><pre id="mobileOrderResult"></pre>';
    document.getElementById('mobileCreateOrder').onclick = async function () {
      if (!selectedCustomer) return window.MKNotify.showError('Chọn khách trước');
      var payload = { customerCode: selectedCustomer.customerCode || selectedCustomer.code, customerName: selectedCustomer.customerName || selectedCustomer.name, deliveryDate: document.getElementById('mobileDeliveryDate').value, salesStaffCode: document.getElementById('mobileSalesStaffCode').value, deliveryStaffCode: document.getElementById('mobileDeliveryStaffCode').value, source: 'MOBILE_SALES', items: JSON.parse(document.getElementById('mobileItems').value || '[]') };
      var res = await window.MKApi.post('/api/sales-orders', payload);
      document.getElementById('mobileOrderResult').textContent = JSON.stringify(res, null, 2);
    };
  }

  async function renderOrders() {
    setActive('orders');
    document.getElementById('salesMobileContent').innerHTML = '<h3>Báo cáo đơn</h3><button id="mobileLoadOrders" class="primary">Tải đơn</button><div id="mobileOrderRows" class="order-list"></div>';
    document.getElementById('mobileLoadOrders').onclick = async function () {
      var res = await window.MKApi.get('/api/sales-orders', { limit: 50 });
      var rows = F.getRows(res);
      document.getElementById('mobileOrderRows').innerHTML = rows.map(function (o) { return '<div class="order-card"><b>' + F.esc(o.code) + '</b><div>' + F.esc(o.customerName || '') + '</div><div class="money-line"><span class="money-pill">' + F.money(o.totalAmount || 0) + '</span><span class="money-pill">' + F.esc(o.status) + '</span></div></div>'; }).join('');
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('[data-tab="customers"]').onclick = renderCustomers;
    document.querySelector('[data-tab="cart"]').onclick = renderCart;
    document.querySelector('[data-tab="orders"]').onclick = renderOrders;
    renderCustomers();
  });
}());
