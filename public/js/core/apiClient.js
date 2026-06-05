(function () {
  'use strict';

  var DEFAULT_TIMEOUT_MS = 30000;

  function toQuery(params) {
    var search = new URLSearchParams();
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '' || value === 'all') return;
      search.append(key, String(value));
    });
    var text = search.toString();
    return text ? '?' + text : '';
  }

  function getToken() {
    try { return localStorage.getItem('mk_v46_token') || ''; } catch (e) { return ''; }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem('mk_v46_token', token);
      else localStorage.removeItem('mk_v46_token');
    } catch (e) {}
  }

  function getRole() {
    try { return localStorage.getItem('mk_v46_role') || ''; } catch (e) { return ''; }
  }

  function setRole(role) {
    try {
      if (role) localStorage.setItem('mk_v46_role', role);
      else localStorage.removeItem('mk_v46_role');
    } catch (e) {}
  }

  async function request(method, url, body, options) {
    options = options || {};
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, options.timeoutMs || DEFAULT_TIMEOUT_MS);
    var startedAt = Date.now();
    var headers = Object.assign({ 'Accept': 'application/json' }, options.headers || {});
    var token = getToken();
    var role = getRole();
    if (token) headers.Authorization = 'Bearer ' + token;
    if (role) headers['x-user-role'] = role;

    var fetchOptions = { method: method, headers: headers, signal: controller.signal };
    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      var res = await fetch(url, fetchOptions);
      var text = await res.text();
      var data = null;
      try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { ok: false, raw: text }; }
      var ms = Date.now() - startedAt;
      if (!res.ok || data.ok === false) {
        var message = (data && (data.message || data.error)) || ('HTTP ' + res.status);
        var error = new Error(message);
        error.status = res.status;
        error.data = data;
        error.ms = ms;
        throw error;
      }
      data.__ms = ms;
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  var api = {
    get: function (url, params, options) { return request('GET', url + toQuery(params), null, options); },
    post: function (url, body, options) { return request('POST', url, body || {}, options); },
    put: function (url, body, options) { return request('PUT', url, body || {}, options); },
    delete: function (url, body, options) { return request('DELETE', url, body || {}, options); },
    setToken: setToken,
    getToken: getToken,
    setRole: setRole,
    getRole: getRole,
    toQuery: toQuery
  };

  window.MKApi = api;
}());
