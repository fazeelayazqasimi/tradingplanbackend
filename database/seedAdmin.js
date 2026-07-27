const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Rank = require('../models/Rank');
const UserRank = require('../models/UserRank');

const seedAdmin = async () => {
  try {
    const adminEmail = 'admin@the4xhub.com';
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      console.log('[SEED] Admin already exists:', adminEmail);
      return;
    }

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'The4xHub',
      email: adminEmail,
      password: 'Admin123!',
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
      isApproved: true,
      subscriptionStatus: 'active',
    });

    const walletTypes = ['main', 'funding', 'ib'];
    for (const type of walletTypes) {
      await Wallet.findOneAndUpdate(
        { userId: admin._id, type },
        { $setOnInsert: { userId: admin._id, type } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    const lowestRank = await Rank.findOne({ isActive: true }).sort({ order: 1 });
    if (lowestRank) {
      await UserRank.create({
        userId: admin._id,
        currentRankId: lowestRank._id,
        rankHistory: [{
          rankId: lowestRank._id,
          achievedAt: new Date(),
          reason: 'Assigned on admin seed',
          changeType: 'automatic',
        }],
      });
    }

    console.log('[SEED] Admin created successfully:', adminEmail);
  } catch (error) {
    console.error('[SEED] Admin creation error:', error.message);
  }
};

module.exports = seedAdmin;
