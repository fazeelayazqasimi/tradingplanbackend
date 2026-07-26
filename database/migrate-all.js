const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Rank = require('../models/Rank');
const UserRank = require('../models/UserRank');
const CoursePurchase = require('../models/CoursePurchase');
const WalletTransaction = require('../models/WalletTransaction');
const Wallet = require('../models/Wallet');
const UserProgress = require('../models/UserProgress');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected...\n');

    // ===== 1. RANKS: Rename D1-D6 → D1-D6 with commission values =====
    console.log('--- Step 1: Ranks ---');
    const rankConfig = [
      { order: 1, name: 'D1', slug: 'd1', activationGain: 30, quantification: 4, indirectIncome: 0 },
      { order: 2, name: 'D2', slug: 'd2', activationGain: 40, quantification: 6, indirectIncome: 10 },
      { order: 3, name: 'D3', slug: 'd3', activationGain: 50, quantification: 8, indirectIncome: 20 },
      { order: 4, name: 'D4', slug: 'd4', activationGain: 60, quantification: 10, indirectIncome: 30 },
      { order: 5, name: 'D5', slug: 'd5', activationGain: 65, quantification: 11, indirectIncome: 35 },
      { order: 6, name: 'D6', slug: 'd6', activationGain: 70, quantification: 12, indirectIncome: 40 },
    ];

    const oldSlugs = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
    const oldRanks = await Rank.find({ slug: { $in: oldSlugs } }).lean();
    for (const oldRank of oldRanks) {
      const idx = oldSlugs.indexOf(oldRank.slug);
      if (idx === -1) continue;
      const cfg = rankConfig[idx];
      const existingNew = await Rank.findOne({ slug: cfg.slug });
      if (existingNew) {
        await Rank.findByIdAndDelete(oldRank._id);
        await Rank.findByIdAndUpdate(existingNew._id, {
          $set: { activationGain: cfg.activationGain, quantification: cfg.quantification, indirectIncome: cfg.indirectIncome }
        });
        console.log(`  Replaced ${oldRank.slug} → ${cfg.name} (merged)`);
      } else {
        await Rank.findByIdAndUpdate(oldRank._id, {
          $set: { name: cfg.name, slug: cfg.slug, activationGain: cfg.activationGain, quantification: cfg.quantification, indirectIncome: cfg.indirectIncome }
        });
        console.log(`  Renamed ${oldRank.slug} → ${cfg.name}`);
      }
    }

    for (const cfg of rankConfig) {
      const r = await Rank.findOneAndUpdate(
        { slug: cfg.slug },
        { $set: { activationGain: cfg.activationGain, quantification: cfg.quantification, indirectIncome: cfg.indirectIncome } },
        { new: true }
      );
      if (r) console.log(`  Updated: ${r.name} (gain=${r.activationGain}, quant=${r.quantification}%)`);
    }

    const firstRank = await Rank.findOne({ isActive: true }).sort({ order: 1 });
    if (!firstRank) { console.log('  No ranks found!'); process.exit(1); }
    console.log(`  First rank: ${firstRank.name} (${firstRank._id})\n`);

    // ===== 2. USERRANK: Create for users with any purchase (pending/active) but no rank =====
    console.log('--- Step 2: UserRanks ---');
    const allPurchases = await CoursePurchase.find({ status: { $in: ['pending', 'active'] } }).lean();
    const userIdsWithPurchase = [...new Set(allPurchases.map(p => p.userId.toString()))];
    console.log(`  Users with purchases (pending/active): ${userIdsWithPurchase.length}`);

    let rankCreated = 0;
    for (const userId of userIdsWithPurchase) {
      const existing = await UserRank.findOne({ userId });
      if (!existing) {
        await UserRank.create({
          userId,
          currentRankId: firstRank._id,
          rankHistory: [{
            rankId: firstRank._id,
            achievedAt: new Date(),
            reason: `Assigned ${firstRank.name} during migration (had purchase)`,
            changeType: 'automatic'
          }]
        });
        rankCreated++;
      }
    }

    const approvedUsers = await User.find({ isApproved: true, role: 'student' }).lean();
    let approvedRankCreated = 0;
    for (const user of approvedUsers) {
      const existing = await UserRank.findOne({ userId: user._id });
      if (!existing) {
        await UserRank.create({
          userId: user._id,
          currentRankId: firstRank._id,
          rankHistory: [{
            rankId: firstRank._id,
            achievedAt: new Date(),
            reason: `Assigned ${firstRank.name} during migration (user was approved)`,
            changeType: 'automatic'
          }]
        });
        approvedRankCreated++;
      }
    }
    console.log(`  Created UserRank for ${rankCreated + approvedRankCreated} users\n`);

    // ===== 3. USERPROGRESS: Create for purchases without enrollment =====
    console.log('--- Step 3: UserProgress ---');
    let progressCreated = 0;
    for (const purchase of allPurchases) {
      if (!purchase.courseId) continue;
      const existing = await UserProgress.findOne({ userId: purchase.userId, courseId: purchase.courseId });
      if (!existing) {
        try {
          await UserProgress.create({
            userId: purchase.userId,
            courseId: purchase.courseId,
            enrolledAt: purchase.approvedAt || purchase.createdAt,
            completedLessons: [],
            progress: 0,
            isCompleted: false
          });
          progressCreated++;
        } catch (_) {}
      }
    }
    console.log(`  Created UserProgress for ${progressCreated} purchases\n`);

    // ===== 4. WALLET: Refund orphaned debits =====
    console.log('--- Step 4: Orphaned Wallet Debits ---');
    const allPurchaseIds = new Set(allPurchases.map(p => p._id.toString()));

    const orphanedDebits = await WalletTransaction.find({
      type: 'debit',
      category: 'purchase',
      referenceModel: 'CoursePurchase',
      status: 'completed'
    }).lean();

    let refunded = 0;
    for (const tx of orphanedDebits) {
      const isOrphaned = !tx.referenceId || !allPurchaseIds.has(tx.referenceId.toString());
      if (isOrphaned) {
        await Wallet.findOneAndUpdate(
          { userId: tx.userId },
          { $inc: { availableBalance: tx.amount, totalEarned: tx.amount } }
        );
        await WalletTransaction.create({
          walletId: tx.walletId,
          userId: tx.userId,
          type: 'credit',
          category: 'refund',
          amount: tx.amount,
          balanceAfter: 0,
          description: 'Auto-refund: purchase failed, wallet debited without purchase',
          referenceModel: 'User',
          referenceId: tx.userId,
          status: 'completed'
        });
        refunded++;
        console.log(`  Refunded $${tx.amount} to user ${tx.userId}`);
      }
    }
    console.log(`  Refunded ${refunded} orphaned debit(s)\n`);

    // ===== SUMMARY =====
    console.log('═══════════════════════════════');
    console.log('  ✅ Migration Complete!');
    console.log('═══════════════════════════════');
    console.log(`  Ranks updated:      6`);
    console.log(`  UserRanks created:  ${rankCreated + approvedRankCreated}`);
    console.log(`  UserProgress made:  ${progressCreated}`);
    console.log(`  Orphan refunds:     ${refunded}`);
    console.log('═══════════════════════════════');

    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
