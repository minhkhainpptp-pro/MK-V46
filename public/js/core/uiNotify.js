(function () {
  'use strict';

  function ensureToastRoot() {
    var root = document.getElementById('toastRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toastRoot';
      root.className = 'toast-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function toast(type, message, timeout) {
    var root = ensureToastRoot();
    var item = document.createElement('div');
    item.className = 'toast toast-' + type;
    item.textContent = message || (type === 'success' ? 'Thành công' : 'Có lỗi xảy ra');
    root.appendChild(item);
    setTimeout(function () { item.classList.add('show'); }, 10);
    setTimeout(function () {
      item.classList.remove('show');
      setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, 250);
    }, timeout || 3500);
  }

  function showLoading(message) {
    var node = document.getElementById('globalLoading');
    if (!node) return;
    var text = node.querySelector('.loading-text');
    if (text) text.textContent = message || 'Đang xử lý...';
    node.classList.remove('hidden');
  }

  function hideLoading() {
    var node = document.getElementById('globalLoading');
    if (!node) return;
    node.classList.add('hidden');
  }

  function setBusy(button, busy, text) {
    if (!button) return;
    if (busy) {
      button.dataset.oldText = button.textContent;
      button.disabled = true;
      button.textContent = text || 'Đang xử lý...';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.oldText || button.textContent;
    }
  }

  window.MKNotify = {
    showSuccess: function (message) { toast('success', message); },
    showError: function (message) { toast('error', message, 5000); },
    showInfo: function (message) { toast('info', message); },
    showLoading: showLoading,
    hideLoading: hideLoading,
    setBusy: setBusy
  };
}());
