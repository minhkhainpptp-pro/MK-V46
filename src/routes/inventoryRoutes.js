'use strict';

const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { requireRole } = require('../middlewares/auth.middleware');
const { blockInventorySourceWrite } = require('../middlewares/integrationAuthority.middleware');

const router = express.Router();
const viewInventory = requireRole(['admin', 'manager', 'accountant', 'warehouse', 'sales', 'delivery']);
const blockUnknownInventoryCommand = blockInventorySourceWrite('ghi hoặc điều chỉnh tồn kho trên V45');

// /check là command-style read, không ghi tồn. Mọi write route bổ sung sau này bị fail-closed.
router.use((req, res, next) => {
  if (req.method === 'GET' || (req.method === 'POST' && req.path === '/check')) return next();
  return blockUnknownInventoryCommand(req, res, next);
});

router.get('/current', requireRole(['admin', 'manager', 'accountant', 'warehouse']), inventoryController.current);
router.post('/check', viewInventory, inventoryController.check);

module.exports = router;
