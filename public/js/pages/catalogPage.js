(function () {
  'use strict';
  var F = window.MKFormat;

  async function loadProducts() {
    var res = await window.MKApi.get('/api/products', { q: document.getElementById('catalogProductQ').value.trim(), limit: 100 });
    var rows = F.getRows(res);
    document.getElementById('catalogProducts').innerHTML = rows.map(function (p) { return '<tr><td><b>' + F.esc(p.code) + '</b></td><td>' + F.esc(p.name) + '</td><td>' + F.money(p.salePrice || 0) + '</td><td>' + F.esc(p.defaultWarehouse || p.defaultWarehouseCode || '') + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">Chưa có sản phẩm.</td></tr>';
  }

  async function loadCustomers() {
    var res = await window.MKApi.get('/api/customers', { q: document.getElementById('catalogCustomerQ').value.trim(), limit: 100 });
    var rows = F.getRows(res);
    document.getElementById('catalogCustomers').innerHTML = rows.map(function (c) { return '<tr><td><b>' + F.esc(c.customerCode || c.code) + '</b></td><td>' + F.esc(c.customerName || c.name) + '</td><td>' + F.esc(c.salesStaffCode || '') + '</td><td>' + F.esc(c.deliveryStaffCode || '') + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">Chưa có khách hàng.</td></tr>';
  }

  async function loadUsers() {
    var res = await window.MKApi.get('/api/users', { limit: 100 });
    var rows = F.getRows(res);
    document.getElementById('catalogUsers').innerHTML = rows.map(function (u) { return '<tr><td><b>' + F.esc(u.userCode || u.code) + '</b></td><td>' + F.esc(u.userName || u.name || u.username) + '</td><td>' + F.esc(u.roleCode || u.roleName || '') + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="muted">Chưa có nhân sự.</td></tr>';
  }

  async function loadWarehouses() {
    var res = await window.MKApi.get('/api/warehouses', { limit: 100 });
    var rows = F.getRows(res);
    document.getElementById('catalogWarehouses').innerHTML = rows.map(function (w) { return '<tr><td><b>' + F.esc(w.code || w.warehouseCode) + '</b></td><td>' + F.esc(w.name || w.warehouseName) + '</td><td>' + F.esc(w.status || '') + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="muted">Chưa có kho.</td></tr>';
  }

  window.MKApp.registerPage('catalog', {
    title: 'Danh mục',
    subtitle: 'Sản phẩm, khách hàng, nhân sự, kho',
    template: function () {
      return '<div class="grid-2"><div class="card"><h3>Sản phẩm</h3><div class="inline-search"><input id="catalogProductQ" placeholder="Tìm mã/tên sản phẩm"><button id="loadProductsBtn" class="primary">Tìm</button></div><table><thead><tr><th>Mã</th><th>Tên</th><th>Giá</th><th>Kho</th></tr></thead><tbody id="catalogProducts"></tbody></table></div><div class="card"><h3>Khách hàng</h3><div class="inline-search"><input id="catalogCustomerQ" placeholder="Tìm mã/tên khách hàng"><button id="loadCustomersBtn" class="primary">Tìm</button></div><table><thead><tr><th>Mã</th><th>Tên</th><th>NVBH</th><th>NVGH</th></tr></thead><tbody id="catalogCustomers"></tbody></table></div><div class="card"><h3>Nhân sự</h3><div class="actions"><button id="loadUsersBtn" class="primary">Tải nhân sự</button></div><table><thead><tr><th>Mã</th><th>Tên</th><th>Vai trò</th></tr></thead><tbody id="catalogUsers"></tbody></table></div><div class="card"><h3>Kho</h3><div class="actions"><button id="loadWarehousesBtn" class="primary">Tải kho</button></div><table><thead><tr><th>Mã</th><th>Tên</th><th>Trạng thái</th></tr></thead><tbody id="catalogWarehouses"></tbody></table></div></div>';
    },
    mount: function () {
      document.getElementById('loadProductsBtn').onclick = loadProducts;
      document.getElementById('loadCustomersBtn').onclick = loadCustomers;
      document.getElementById('loadUsersBtn').onclick = loadUsers;
      document.getElementById('loadWarehousesBtn').onclick = loadWarehouses;
    }
  });
}());
