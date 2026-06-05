require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const { ensureMongoIndexes } = require('./core/ensureMongoIndexes');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('tiny'));

app.use('/api/health', require('./routes/health.routes'));
app.use('/api/sales-orders', require('./routes/salesOrder.routes'));
app.use('/api/master-orders', require('./routes/masterOrder.routes'));
app.use('/api/mobile/delivery', require('./routes/mobileDelivery.routes'));
app.use('/api/accounting', require('./routes/accounting.routes'));
app.use('/api/debts', require('./routes/debt.routes'));

app.use((req, res) => res.status(404).json({ ok: false, message: 'API not found' }));
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ ok: false, message: err.message || 'Server error' });
});

async function main() {
  await connectDB();
  await ensureMongoIndexes();
  const port = process.env.PORT || 10000;
  app.listen(port, () => console.log(`[API] MK-V46 running on port ${port}`));
}

main().catch(err => {
  console.error('[BOOT_ERROR]', err);
  process.exit(1);
});
