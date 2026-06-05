(function () {
  'use strict';
  var F = window.MKFormat;

  async function loadInventory() {
    var result = await window.MKApi.get('/api/inventory/balance', {
      productCode: document.getElementById('inventoryProductCode').value.trim(),
      warehouseCode: document.getElementById('inventoryWarehouseCode').value.trim(),
      onlyPositive: document.getElementById('inventoryOnlyPositive').checked ? '1' : ''
    });
    var rows = F.getRows(result);
    document.getElementById('inventoryRows').innerHTML = rows.map(function (r) {
      return '<tr><td><b>' + F.esc(r.productCode || r.productId) + '</b></td><td>' + F.esc(r.productName || '') + '</td><td>' + F.esc(r.warehouseCode || r.warehouseId || '') + '</td><td>' + F.money(r.inQty || 0) + '</td><td>' + F.money(r.outQty || 0) + '</td><td><b>' + F.money(r.qty || r.balanceQty || 0) + '</b></td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Chưa có tồn kho.</td></tr>';
    document.getElementById('inventoryPerf').textContent = 'API: ' + (result.__ms || 0) + 'ms | rows: ' + rows.length + ' | nguồn: inventories/snapshot';
  }

  window.MKApp.registerPage('inventory', {
    title: 'Tồn kho',
    subtitle: 'Nguồn chuẩn: inventories, snapshot chỉ để tăng tốc',
    template: function () {
      return '<div class="card"><div class="grid"><div><label>Mã SP</label><input id="inventoryProductCode"></div><div><label>Kho</label><input id="inventoryWarehouseCode" placeholder="KHO_HC"></div><div><label>Chỉ tồn dương</label><select id="inventoryOnlyPositiveSelect"><option value="0">Không</option><option value="1">Có</option></select><input id="inventoryOnlyPositive" class="hidden" type="checkbox"></div></div><div class="actions"><button id="loadInventoryBtn" class="primary">Tải tồn kho</button></div><div id="inventoryPerf" class="perf"></div></div><div class="card table-wrap"><table><thead><tr><th>Mã SP</th><th>Tên SP</th><th>Kho</th><th>Nhập</th><th>Xuất</th><th>Tồn</th></tr></thead><tbody id="inventoryRows"></tbody></table></div>';
    },
    mount: async function () {
      var select = document.getElementById('inventoryOnlyPositiveSelect');
      select.onchange = function () { document.getElementById('inventoryOnlyPositive').checked = select.value === '1'; };
      document.getElementById('loadInventoryBtn').onclick = loadInventory;
    }
  });
}());
