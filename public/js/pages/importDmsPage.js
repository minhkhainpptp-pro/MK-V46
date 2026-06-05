(function () {
  'use strict';
  var F = window.MKFormat;
  var previewRows = [];

  function parseRows() {
    try { return JSON.parse(document.getElementById('importJson').value || '[]'); }
    catch (e) { throw new Error('JSON import không hợp lệ'); }
  }

  function renderPreview(rows) {
    return rows.map(function (r) {
      var cls = r.status === 'ok' ? 'ok' : (r.status === 'warning' ? 'warn' : 'error');
      return '<tr><td><span class="' + cls + '">' + F.esc(r.status || '') + '</span></td><td>' + F.esc(r.orderCode || r.code || '') + '</td><td>' + F.esc(r.customerCode || '') + '</td><td>' + F.esc(r.customerName || '') + '</td><td>' + F.money(r.totalAmount || 0) + '</td><td>' + F.esc((r.messages || []).join('; ')) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Chưa có preview.</td></tr>';
  }

  async function preview() {
    var res = await window.MKApi.post('/api/sales-orders/import-preview', { rows: parseRows() });
    previewRows = F.getRows(res);
    document.getElementById('importPreviewRows').innerHTML = renderPreview(previewRows);
    window.MKNotify.showSuccess('Đã preview import');
  }

  async function confirmImport() {
    var res = await window.MKApi.post('/api/sales-orders/import-confirm', { previewRows: previewRows });
    document.getElementById('importResult').textContent = JSON.stringify(res, null, 2);
    window.MKNotify.showSuccess('Đã import đơn hợp lệ');
  }

  window.MKApp.registerPage('import-dms', {
    title: 'Import DMS',
    subtitle: 'Preview trước, chỉ confirm dòng hợp lệ',
    template: function () {
      var sample = '[\n  {\n    "orderCode": "HU_TEST_001",\n    "customerCode": "KH001",\n    "customerName": "Cửa hàng test",\n    "deliveryDate": "' + F.today() + '",\n    "salesStaffCode": "NV001",\n    "deliveryStaffCode": "GH001",\n    "items": [{ "productCode": "P001", "productName": "Sản phẩm test", "quantity": 1, "price": 10000, "warehouseCode": "KHO_HC" }]\n  }\n]';
      return '<div class="card"><h3>Dữ liệu import JSON tạm thời</h3><textarea id="importJson" rows="12">' + F.esc(sample) + '</textarea><div class="actions"><button id="previewImportBtn" class="primary">Preview</button><button id="confirmImportBtn" class="success">Confirm import</button></div></div><div class="card table-wrap"><table><thead><tr><th>TT</th><th>Mã đơn</th><th>Mã KH</th><th>Khách</th><th>Tiền</th><th>Thông báo</th></tr></thead><tbody id="importPreviewRows"></tbody></table><pre id="importResult"></pre></div>';
    },
    mount: function () { document.getElementById('previewImportBtn').onclick = preview; document.getElementById('confirmImportBtn').onclick = confirmImport; }
  });
}());
