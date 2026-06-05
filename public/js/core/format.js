(function () {
  'use strict';
  function money(value) {
    var n = Number(value || 0);
    return n.toLocaleString('vi-VN');
  }
  function num(value) {
    var n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }
  function date(value) {
    if (!value) return '';
    var text = String(value).slice(0, 10);
    var parts = text.split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
    return text;
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function getRows(payload) { return payload && (payload.rows || payload.orders || payload.data || []); }
  window.MKFormat = { money: money, num: num, date: date, esc: esc, today: today, getRows: getRows };
}());
