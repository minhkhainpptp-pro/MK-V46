const path = require('path');

const modules = [
  '../src/models/SalesOrder',
  '../src/models/MasterOrder',
  '../src/models/ReturnOrder',
  '../src/models/ArLedger',
  '../src/models/FundLedger',
  '../src/models/Journal',
  '../src/models/OperationLog',
  '../src/models/AuditLog',
  '../src/models/ApiLog',
  '../src/core/operationGuard',
  '../src/core/audit',
  '../src/middlewares/apiMonitor.middleware',
  '../src/utils/validation.util',
  '../src/utils/response.util',
  '../src/services/salesOrderService',
  '../src/services/masterOrderService',
  '../src/services/mobile/delivery.service',
  '../src/services/accountingService',
  '../src/services/reportService',
  '../src/routes/salesOrder.routes',
  '../src/routes/masterOrder.routes',
  '../src/routes/accounting.routes',
  '../src/routes/report.routes',
  '../src/routes/journal.routes',
];

for (const modulePath of modules) {
  require(path.join(__dirname, modulePath));
  console.log('[STATIC_CHECK_OK]', modulePath);
}

console.log('[STATIC_CHECK_DONE] MK-V46 core modules loaded successfully.');
