const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState >= 1) return;
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Sync indexes with schema to drop stale indexes (e.g. old userId_1 unique index on wallets)
    // that conflict with the current compound unique index { userId: 1, type: 1 }
    try {
      const Wallet = require('../models/Wallet');
      const collection = mongoose.connection.db.collection('wallets');
      const beforeIndexes = await collection.indexes();
      const oldUserIdIndex = beforeIndexes.find(i => JSON.stringify(i.key) === '{"userId":1}' && i.unique);
      if (oldUserIdIndex) {
        console.warn(`[DB] Found stale unique index on wallets.userId — attempting to drop via syncIndexes()`);
      }

      await Wallet.syncIndexes();

      const afterIndexes = await collection.indexes();
      const oldUserIdIndexAfter = afterIndexes.find(i => JSON.stringify(i.key) === '{"userId":1}' && i.unique);
      if (oldUserIdIndexAfter) {
        console.error(`[DB] CRITICAL: Stale unique index "userId_1" on wallets collection could NOT be dropped.`);
        console.error(`[DB] Run "node database/migrate-wallet-index.js" manually, or drop the index via MongoDB shell:`);
        console.error(`[DB]   db.wallets.dropIndex("userId_1")`);
      } else if (oldUserIdIndex) {
        console.log('[DB] Successfully dropped stale unique index on wallets.userId');
      }
      console.log('Wallet indexes synced with schema');
    } catch (indexErr) {
      console.error('[DB] Index sync error:', indexErr.message);
      console.error('[DB] Run "node database/migrate-wallet-index.js" to fix stale indexes.');
    }
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
