(function () {
  'use strict';
  var F = window.MKFormat;
  async function checkHealth() {
    var res = await window.MKApi.get('/health');
    document.getElementById('systemResult').textContent = JSON.stringify(res, null, 2);
  }
  async function login() {
    var res = await window.MKApi.post('/api/auth/login', { username: document.getElementById('loginUsername').value, password: document.getElementById('loginPassword').value });
    if (res.token) window.MKApi.setToken(res.token);
    var user = res.user || res.data || {};
    if (user.roleCode || user.role) window.MKApi.setRole(user.roleCode || user.role);
    window.MKNotify.showSuccess('Đăng nhập OK');
    document.getElementById('systemResult').textContent = JSON.stringify(res, null, 2);
  }
  window.MKApp.registerPage('system', {
    title: 'Hệ thống',
    subtitle: 'Health, login, quyền UI, checklist production',
    template: function () {
      return '<div class="grid-2"><div class="card"><h3>Login kiểm thử</h3><label>Username</label><input id="loginUsername" value="admin"><label>Password</label><input id="loginPassword" type="password" value="admin"><div class="actions"><button id="loginBtn" class="primary">Login</button><button id="healthBtn">Health check</button></div><pre id="systemResult"></pre></div><div class="card"><h3>Production checklist</h3><ul><li>Không còn 404/500 trên Console</li><li>Danh sách giao hàng dưới 300ms</li><li>Chi tiết giao hàng dưới 500ms</li><li>Xác nhận giao dưới 700ms</li><li>Dashboard dưới 1000ms</li><li>Backup MongoDB trước migrate</li><li>Tag GitHub release</li><li>Ghi version Render</li></ul></div></div>';
    },
    mount: function () { document.getElementById('loginBtn').onclick = login; document.getElementById('healthBtn').onclick = checkHealth; }
  });
}());
