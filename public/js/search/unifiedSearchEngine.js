(function (global) {
  'use strict';

  const cache = new Map();
  const DEFAULT_LIMIT = 20;

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ');
  }

  async function requestJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Search API error: ' + res.status);
    return res.json();
  }

  async function search(endpoint, keyword, options) {
    const q = String(keyword || '').trim();
    const limit = Math.min(Number((options && options.limit) || DEFAULT_LIMIT), 50);
    const params = { q, keyword: q, limit: String(limit) };
    Object.keys(options || {}).forEach((name) => {
      if (options[name] !== undefined && options[name] !== null && options[name] !== '') {
        params[name] = String(options[name]);
      }
    });
    const key = endpoint + '|' + normalizeText(q) + '|' + JSON.stringify(params);
    if (cache.has(key)) return cache.get(key);
    const url = endpoint + '?' + new URLSearchParams(params).toString();
    const data = await requestJson(url);
    const rows = data.rows || data.data || [];
    cache.set(key, rows);
    return rows;
  }

  global.UnifiedSearchEngine = {
    normalizeText,
    // Customer search is intentionally limited to customerCode, customerName and phone on the API.
    searchCustomer: (keyword, options) => search('/api/customers', keyword, options),
    searchProduct: (keyword, options) => search('/api/products', keyword, options),
    searchSalesStaff: (keyword, options) => search('/api/users', keyword, { ...(options || {}), role: 'sales' }),
    searchDeliveryStaff: (keyword, options) => search('/api/users', keyword, { ...(options || {}), role: 'delivery' }),
    clearCache: () => cache.clear(),
  };
})(window);
