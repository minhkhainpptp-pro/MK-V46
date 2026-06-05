const fs = require('fs');
const path = require('path');

const modules = [
  '../src/models/SalesOrder',
  '../src/models/MasterOrder',
  '../src/models/ReturnOrder',
  '../src/models/ArLedger',
  '../src/models/FundLedger',
  '../src/models/Inventory',
  '../src/models/Journal',
  '../src/models/OperationLog',
  '../src/models/AuditLog',
  '../src/models/ApiLog',

  '../src/constants/status.constants',
  '../src/constants/ledger.constants',
  '../src/constants/collection.constants',
  '../src/constants/role.constants',

  '../src/validators/base.validator',
  '../src/validators/product.validator',
  '../src/validators/customer.validator',
  '../src/validators/salesOrder.validator',
  '../src/validators/delivery.validator',
  '../src/validators/accounting.validator',
  '../src/validators/returnOrder.validator',

  '../src/core/withTransaction',
  '../src/core/idempotencyGuard',
  '../src/core/operationGuard',
  '../src/core/audit',
  '../src/core/auditLog',
  '../src/core/balanceGuard',
  '../src/core/postingEngine',

  '../src/services/ledger/arLedger.service',
  '../src/services/ledger/fundLedger.service',
  '../src/services/ledger/inventoryLedger.service',
  '../src/services/ledger/journal.service',

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
  '../src/routes/debt.routes',
  '../src/routes/inventory.routes',
  '../src/routes/warehouse.routes',
  '../src/routes/auth.routes',

  '../tests/full-flow.test',
];

for (const modulePath of modules) {
  require(path.join(__dirname, modulePath));
  console.log('[STATIC_CHECK_OK]', modulePath);
}

const ROOT = path.join(__dirname, '..');
const TRANSACTION_MODEL_FILES = new Set([
  'SalesOrder.js',
  'MasterOrder.js',
  'ReturnOrder.js',
  'ArLedger.js',
  'FundLedger.js',
  'Inventory.js',
  'Journal.js',
]);

function walk(dir) {
  const out = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules', '.git'].includes(item)) continue;
      out.push(...walk(full));
    } else if (item.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function assertDocsExist() {
  const docs = [
    'docs/architecture.md',
    'docs/business-rules.md',
    'docs/api-rules.md',
    'docs/ledger-rules.md',
    'docs/status-rules.md',
    'docs/performance-rules.md',
    'docs/migration-rules.md',
    'docs/release-checklist.md',
    'docs/architecture-freeze-v46.md',
  ];

  for (const rel of docs) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      throw new Error(`[DOCS_MISSING] ${rel}`);
    }
  }
}

function assertNoForbiddenPatterns() {
  const files = walk(path.join(ROOT, 'src'));
  const violations = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');

    // Unbounded transaction collection queries are prohibited.
    for (const modelFile of TRANSACTION_MODEL_FILES) {
      const modelName = modelFile.replace(/\.js$/, '');
      const directFindPattern = new RegExp(`\\b${modelName}\\.find\\s*\\(\\s*\\{\\s*\\}\\s*\\)`);
      if (directFindPattern.test(text)) {
        violations.push(`${rel}: unbounded ${modelName}.find({})`);
      }
    }

    // Direct balance writes are prohibited.
    const directBalanceFields = [
      'debtAmount',
      'customerDebt',
      'remainingDebt',
      'orderDebt',
      'stock',
      'quantityOnHand',
      'warehouseStock',
    ];

    for (const field of directBalanceFields) {
      const assignment = new RegExp(`\\.${field}\\s*=`);
      if (assignment.test(text) && !rel.includes('balanceGuard.js')) {
        violations.push(`${rel}: direct balance mutation .${field}=`);
      }
    }
  }

  if (violations.length) {
    console.error('[STATIC_GUARD_FAILED]');
    for (const violation of violations) console.error(' -', violation);
    throw new Error(`Static guard found ${violations.length} violation(s)`);
  }
}

assertDocsExist();
assertNoForbiddenPatterns();

console.log('[STATIC_GUARD_OK] Architecture rules, docs, modules and forbidden patterns checked.');
console.log('[STATIC_CHECK_DONE] MK-V46 guardrails loaded successfully.');
