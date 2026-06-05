const mongoose = require('mongoose');
const { connectMongo } = require('../config/db');
const { ensureMongoIndexes } = require('./ensureMongoIndexes');
const { seedDefaults } = require('./seedDefaults');

async function bootstrap() {
  await connectMongo();

  if (typeof ensureMongoIndexes === 'function') {
    await ensureMongoIndexes();
  }

  if (typeof seedDefaults === 'function') {
    await seedDefaults();
  }
}

process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('Mongo Closed');
  } finally {
    process.exit(0);
  }
});

module.exports = bootstrap;


async function seedWarehouses(){ /* KHO_HC + KHO_PC seed */ }
