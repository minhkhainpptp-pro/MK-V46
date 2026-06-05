(function () {
  'use strict';

  var pages = {};

  function registerPage(name, page) {
    pages[name] = page;
  }

  function setActiveNav(name) {
    document.querySelectorAll('[data-page]').forEach(function (node) {
      node.classList.toggle('active', node.getAttribute('data-page') === name);
    });
  }

  async function openPage(name) {
    var page = pages[name] || pages.dashboard;
    if (!page) return;
    setActiveNav(name);
    var title = document.getElementById('pageTitle');
    var subtitle = document.getElementById('pageSubtitle');
    var content = document.getElementById('pageContent');
    if (title) title.textContent = page.title || name;
    if (subtitle) subtitle.textContent = page.subtitle || '';
    if (content) content.innerHTML = typeof page.template === 'function' ? page.template() : (page.template || '');
    if (typeof page.mount === 'function') {
      try { await page.mount(); } catch (err) { window.MKNotify.showError(err.message); }
    }
  }

  function bindNav() {
    document.querySelectorAll('[data-page]').forEach(function (node) {
      node.addEventListener('click', function () {
        var page = node.getAttribute('data-page');
        location.hash = page;
      });
    });
  }

  function applyUserRole(role) {
    role = role || window.MKApi.getRole() || 'admin';
    window.MKApi.setRole(role);
    var roleSelect = document.getElementById('roleSelect');
    if (roleSelect) roleSelect.value = role;
    document.querySelectorAll('[data-role-only]').forEach(function (node) {
      var allowed = String(node.getAttribute('data-role-only') || '').split(',').map(function (x) { return x.trim(); });
      node.classList.toggle('hidden', allowed.indexOf(role) === -1 && role !== 'admin');
    });
  }

  function initRoleSelector() {
    var roleSelect = document.getElementById('roleSelect');
    if (!roleSelect) return;
    roleSelect.value = window.MKApi.getRole() || 'admin';
    roleSelect.addEventListener('change', function () { applyUserRole(roleSelect.value); });
    applyUserRole(roleSelect.value);
  }

  function boot() {
    bindNav();
    initRoleSelector();
    window.addEventListener('hashchange', function () {
      openPage((location.hash || '#dashboard').replace('#', ''));
    });
    openPage((location.hash || '#dashboard').replace('#', ''));
  }

  window.MKApp = { registerPage: registerPage, openPage: openPage, applyUserRole: applyUserRole };
  document.addEventListener('DOMContentLoaded', boot);
}());
