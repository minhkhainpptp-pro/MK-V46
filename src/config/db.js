const mongoose = require('mongoose');

async function connectMongo() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is required');
    }
    await mongoose.connect(mongoUri, {
      autoIndex: process.env.NODE_ENV !== 'production' && process.env.MONGO_AUTOINDEX !== '0',
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB Error', error);
    throw error;
  }
}

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  connectMongo,
  isMongoConnected
};
