const mobileDeliveryService = require('../services/mobile/delivery.service');

async function listOrders(query = {}) {
  return mobileDeliveryService.listDeliveryOrders(query);
}

async function getOrderDetail(id) {
  return mobileDeliveryService.getDeliveryOrderDetail(id);
}

async function confirm(input = {}) {
  return mobileDeliveryService.confirmDelivery(input);
}

module.exports = { listOrders, getOrderDetail, confirm };
