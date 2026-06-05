(function () {
  'use strict';
  var F = window.MKFormat;
  var previewRows = [];

  function splitCsvLine(line) {
    var out = [], cur = '', quote = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') { quote = !quote; continue; }
      if (ch === ',' && !quote) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function normalizeImportRows(rows) {
    return (rows || []).map(function (r) {
      var items = r.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = []; }
      }
      if (!Array.isArray(items) || !items.length) {
        items = [{
          productCode: r.productCode || r['Mã SP'] || r.maSP,
          productName: r.productName || r['Tên SP'] || r.tenSP,
          quantity: Number(r.quantity || r.qty || r['Số lượng'] || 0),
          price: Number(r.price || r['Đơn giá'] || 0),
          warehouseCode: r.warehouseCode || r['Kho'] || 'KHO_HC'
        }];
      }
      return {
        orderCode: r.orderCode || r.code || r['Mã đơn'] || r.soHoaDon,
        customerCode: r.customerCode || r['Mã KH'] || r.maKH,
        customerName: r.customerName || r['Khách'] || r.tenKH,
        deliveryDate: r.deliveryDate || r['Ngày giao'] || F.today(),
        salesStaffCode: r.salesStaffCode || r['NVBH'] || 'NV001',
        deliveryStaffCode: r.deliveryStaffCode || r['NVGH'] || 'GH001',
        items: items
      };
    });
  }

  async function readFileRows(file) {
    var name = (file && file.name || '').toLowerCase();
    if (!file) return [];
    if ((name.endsWith('.xlsx') || name.endsWith('.xls')) && window.XLSX) {
      var buffer = await file.arrayBuffer();
      var wb = window.XLSX.read(buffer, { type: 'array' });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      return window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }
    
    var bufferText = await file.arrayBuffer();
    var text = '';
    try {
      text = new TextDecoder('utf-8').decode(bufferText);
      if (text.indexOf('�') >= 0) {
        text = new TextDecoder('windows-1258').decode(bufferText);
      }
    } catch (e) {
      text = await file.text();
    }
    text = text.replace(/^\uFEFF/, '');

    if (name.endsWith('.json')) return JSON.parse(text);
    var lines = text.split(/\r?\n/).filter(function (x) { return x.trim(); });
    if (!lines.length) return [];
    var headers = splitCsvLine(lines[0]);
    return lines.slice(1).map(function (line) {
      var values = splitCsvLine(line);
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = values[i]; });
      return obj;
    });
  }

  async function loadFile() {
    var file = document.getElementById('importFile').files[0];
    if (!file) return window.MKNotify.showError('Chọn file trước');
    try {
      var rows = normalizeImportRows(await readFileRows(file));
      document.getElementById('importJson').value = JSON.stringify(rows, null, 2);
      window.MKNotify.showSuccess('Đã đọc file import');
    } catch (err) {
      window.MKNotify.showError('Không đọc được file: ' + err.message);
    }
  }

  function parseRows() {
    try { return normalizeImportRows(JSON.parse(document.getElementById('importJson').value || '[]')); }
    catch (e) { throw new Error('Dữ liệu import không hợp lệ'); }
  }

  function renderPreview(rows) {
    return rows.map(function (r, index) {
      var cls = r.status === 'ok' ? 'ok' : (r.status === 'warning' ? 'warn' : 'error');
      return '<tr><td>' + (index + 1) + '</td><td><span class="' + cls + '">' + F.esc(r.statusLabel || r.status || '') + '</span></td><td>' + F.esc(r.orderCode || r.code || '') + '</td><td>' + F.esc(r.customerCode || '') + '</td><td>' + F.esc(r.customerName || '') + '</td><td>' + F.money(r.totalAmount || 0) + '</td><td>' + F.esc((r.messages || []).join('; ')) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="muted">Chưa có preview.</td></tr>';
  }

  async function preview() {
    var btn = document.getElementById('previewImportBtn');
    window.MKNotify.setBusy(btn, true);
    try {
      var res = await window.MKApi.post('/api/sales-orders/import-preview', { rows: parseRows() });
      previewRows = F.getRows(res);
      document.getElementById('importPreviewRows').innerHTML = renderPreview(previewRows);
      document.getElementById('importPerf').textContent = 'API: ' + (res.__ms || 0) + 'ms | rows: ' + previewRows.length;
      window.MKNotify.showSuccess('Đã preview import');
    } catch (err) {
      window.MKNotify.showError(err.message);
    } finally {
      window.MKNotify.setBusy(btn, false);
    }
  }

  async function confirmImport() {
    if (!previewRows.length) return window.MKNotify.showError('Preview trước khi confirm');
    var res = await window.MKApi.post('/api/sales-orders/import-confirm', { previewRows: previewRows });
    document.getElementById('importResult').classList.remove('hidden');
    document.getElementById('importResult').innerHTML = '<div class="result-title">Kết quả import</div><pre>' + F.esc(JSON.stringify(res, null, 2)) + '</pre>';
    window.MKNotify.showSuccess('Đã import đơn hợp lệ');
  }

  window.MKApp.registerPage('import-dms', {
    title: 'Import DMS',
    subtitle: 'Upload Excel/CSV/JSON, preview trước, chỉ confirm dòng hợp lệ',
    template: function () {
      var sample = '[\n  {\n    "orderCode": "HU_TEST_001",\n    "customerCode": "KH001",\n    "customerName": "Cửa hàng test",\n    "deliveryDate": "' + F.today() + '",\n    "salesStaffCode": "NV001",\n    "deliveryStaffCode": "GH001",\n    "items": [{ "productCode": "P001", "productName": "Sản phẩm test", "quantity": 1, "price": 10000, "warehouseCode": "KHO_HC" }]\n  }\n]';
      return '<div class="card"><h3>Import DMS</h3><div class="grid"><div><label>File Excel/CSV/JSON</label><input id="importFile" type="file" accept=".xlsx,.xls,.csv,.json"></div><div><label>&nbsp;</label><button id="loadImportFileBtn">Đọc file</button></div></div><p class="muted">Excel cần có các cột: orderCode, customerCode, customerName, deliveryDate, salesStaffCode, deliveryStaffCode, productCode, productName, quantity, price, warehouseCode. Có thể sửa JSON sau khi đọc file.</p><textarea id="importJson" rows="10">' + F.esc(sample) + '</textarea><div class="actions"><button id="previewImportBtn" class="primary">Preview</button><button id="confirmImportBtn" class="success">Confirm import</button></div><div id="importPerf" class="perf"></div></div><div class="card table-wrap"><table><thead><tr><th>TT</th><th>Trạng thái</th><th>Mã đơn</th><th>Mã KH</th><th>Khách</th><th>Tiền</th><th>Thông báo</th></tr></thead><tbody id="importPreviewRows"></tbody></table><div id="importResult" class="result-panel hidden"></div></div>';
    },
    mount: function () {
      document.getElementById('loadImportFileBtn').onclick = loadFile;
      document.getElementById('previewImportBtn').onclick = preview;
      document.getElementById('confirmImportBtn').onclick = confirmImport;
    }
  });
}());
