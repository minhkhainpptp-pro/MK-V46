require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const bootstrap = require('./core/bootstrap');
const { ensureMongoIndexes } = require('./core/ensureMongoIndexes');
const { seedDefaults } = require('./core/seedDefaults');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('tiny'));

// Static UI, if public files exist.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health routes MUST be declared before the 404 handler.
app.get('/', (req, res) => {
  res.json({
    ok: true,
    app: 'MK-V46 Clean Core',
    status: 'running',
    time: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    app: 'MK-V46 Clean Core',
    time: new Date().toISOString(),
  });
});

app.use('/api/health', require('./routes/health.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/customers', require('./routes/customer.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/sales-orders', require('./routes/salesOrder.routes'));
app.use('/api/master-orders', require('./routes/masterOrder.routes'));
app.use('/api/return-orders', require('./routes/returnOrder.routes'));
app.use('/api/ar-ledgers', require('./routes/arLedger.routes'));
app.use('/api/mobile/delivery', require('./routes/mobile/delivery.routes'));
app.use('/api/mobile/collection', require('./routes/mobile/collection.routes'));
app.use('/api/mobile/report', require('./routes/mobile/report.routes'));
app.use('/api/accounting', require('./routes/accounting.routes'));
app.use('/api/debts', require('./routes/debt.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/reports', require('./routes/report.routes'));

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: 'API not found',
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({
    ok: false,
    message: err.message || 'Server error',
  });
});

async function main() {
  await bootstrap();

  const port = Number(process.env.PORT || 10000);
  app.listen(port, () => {
    console.log(`[API] MK-V46 running on port ${port}`);
  });
}

main().catch((err) => {
  console.error('[BOOT_ERROR]', err);
  process.exit(1);
});
