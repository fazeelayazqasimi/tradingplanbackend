const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Setting = require('../models/Setting');
const TradingStrategy = require('../models/TradingStrategy');

const DEFAULT_STRATEGIES = [
  { name: 'TITAN EDGE', tag: 'Trend', minAmount: 250, maxAmount: 5000, sortOrder: 1 },
  { name: 'APEX PRIME', tag: 'Balanced', minAmount: 250, maxAmount: 2500, sortOrder: 2 },
  { name: 'PHOENIX ELITE', tag: 'Advanced', minAmount: 250, maxAmount: 25000, sortOrder: 3 },
  { name: 'QUANTUM FLOW', tag: 'Adaptive AI', minAmount: 250, maxAmount: 10000, sortOrder: 4 },
];

const seedStrategies = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected...');

    await Setting.setByKey(
      'bot_connect_fee_amount',
      20,
      null
    );
    await Setting.updateOne(
      { key: 'bot_connect_fee_amount' },
      {
        $set: {
          category: 'trading',
          description: 'Fee charged from main wallet when connecting a real trading bot account (USD)',
        },
      }
    );
    console.log('Bot connect fee setting ensured (default 20)');

    for (const s of DEFAULT_STRATEGIES) {
      const existing = await TradingStrategy.findOne({ name: s.name });
      if (existing) {
        console.log(`Strategy exists, skipping: ${s.name}`);
        continue;
      }
      await TradingStrategy.create({ ...s, isActive: true });
      console.log(`Strategy created: ${s.name}`);
    }

    console.log('\n✅ Trading strategies seed completed');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedStrategies();
