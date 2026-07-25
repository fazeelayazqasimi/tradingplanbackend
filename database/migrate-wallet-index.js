const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Wallet = require('../models/Wallet');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected...\n');

    // ===== 1. DROP OLD unique index on userId =====
    console.log('--- Step 1: Drop old userId unique index ---');
    const collection = mongoose.connection.db.collection('wallets');
    const indexes = await collection.indexes();
    console.log('  Current indexes:');
    for (const idx of indexes) {
      console.log(`    ${idx.name}: ${JSON.stringify(idx.key)} unique=${!!idx.unique}`);
    }

    const oldIndex = indexes.find(i => JSON.stringify(i.key) === '{"userId":1}' && i.unique);
    if (oldIndex) {
      await collection.dropIndex('userId_1');
      console.log('  ✅ Dropped old unique index: userId_1');
    } else {
      console.log('  ⏭️  Old userId_1 unique index not found, skipping');
    }

    // ===== 2. SYNC indexes with schema =====
    console.log('\n--- Step 2: Sync indexes with schema ---');
    await Wallet.syncIndexes();
    console.log('  ✅ Indexes synced with schema');

    const newIndexes = await collection.indexes();
    console.log('  New indexes:');
    for (const idx of newIndexes) {
      console.log(`    ${idx.name}: ${JSON.stringify(idx.key)} unique=${!!idx.unique}`);
    }

    // ===== 3. Create funding & ib wallets for existing users =====
    console.log('\n--- Step 3: Create missing wallets for existing users ---');
    const users = await mongoose.connection.db.collection('users').find({}).project({ _id: 1 }).toArray();
    let created = 0;
    let skipped = 0;

    for (const user of users) {
      const existingWallets = await Wallet.find({ userId: user._id }).lean();
      const existingTypes = existingWallets.map(w => w.type);
      const missingTypes = ['funding', 'ib'].filter(t => !existingTypes.includes(t));

      if (missingTypes.length === 0) {
        skipped++;
        continue;
      }

      // If user has a main wallet, copy its availableBalance to funding
      const mainWallet = existingWallets.find(w => w.type === 'main');
      const initialBalance = mainWallet ? mainWallet.availableBalance : 0;

      for (const type of missingTypes) {
        await Wallet.create({
          userId: user._id,
          type,
          availableBalance: type === 'funding' ? initialBalance : 0,
          totalEarned: type === 'funding' ? initialBalance : 0,
        });
        created++;
        console.log(`  Created ${type} wallet for user ${user._id}`);
      }
    }
    console.log(`  ✅ Created ${created} missing wallets (${skipped} users already had all 3)`);

    // ===== SUMMARY =====
    console.log('\n═══════════════════════════════');
    console.log('  ✅ Wallet Index Migration Complete!');
    console.log('═══════════════════════════════');
    console.log(`  Indexes dropped:     ${oldIndex ? 1 : 0}`);
    console.log(`  Missing wallets:     ${created}`);
    console.log(`  Users skipped:       ${skipped}`);
    console.log('═══════════════════════════════');

    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
