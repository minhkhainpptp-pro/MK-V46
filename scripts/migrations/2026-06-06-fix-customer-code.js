/**
 * Idempotent sample migration.
 * Backfills customerCode/customerName from legacy code/name.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../../src/models/Customer');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await Customer.updateMany(
    {
      $or: [
        { customerCode: { $exists: false } },
        { customerCode: '' },
        { customerName: { $exists: false } },
        { customerName: '' },
      ],
    },
    [
      {
        $set: {
          customerCode: { $ifNull: ['$customerCode', '$code'] },
          customerName: { $ifNull: ['$customerName', '$name'] },
          code: { $ifNull: ['$code', '$customerCode'] },
          name: { $ifNull: ['$name', '$customerName'] },
        },
      },
    ],
    { updatePipeline: true }
  );
  console.log('[MIGRATION_DONE]', result.modifiedCount);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[MIGRATION_FAILED]', err);
    process.exit(1);
  });
}
