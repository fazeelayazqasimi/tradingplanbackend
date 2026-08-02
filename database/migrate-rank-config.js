/**
 * Backfills rank qualification configuration for existing ranks.
 *
 * The legacy seed inserted rank settings under field names that do not exist
 * in the Rank model (minTeamSize / minAtLeast / minAtLeastRank), so rank
 * qualification never worked. This script fills the correct fields
 * (minDirectReferrals / minTeamMembers / minRequiredRank / minRequiredRankCount)
 * from order-based defaults.
 *
 * It NEVER overrides values that are already configured (admin-customized
 * ranks are left untouched).
 *
 * Usage: node database/migrate-rank-config.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Rank = require('../models/Rank');

const DEFAULT_CONFIG = [
  { order: 1, minDirectReferrals: 0, minTeamMembers: 0, minRequiredRank: null, minRequiredRankCount: 0, activationGain: 30 },
  { order: 2, minDirectReferrals: 3, minTeamMembers: 20, minRequiredRank: 'D1', minRequiredRankCount: 3, activationGain: 40 },
  { order: 3, minDirectReferrals: 5, minTeamMembers: 100, minRequiredRank: 'D2', minRequiredRankCount: 3, activationGain: 50 },
  { order: 4, minDirectReferrals: 8, minTeamMembers: 300, minRequiredRank: 'D3', minRequiredRankCount: 3, activationGain: 60 },
  { order: 5, minDirectReferrals: 12, minTeamMembers: 800, minRequiredRank: 'D4', minRequiredRankCount: 3, activationGain: 65 },
  { order: 6, minDirectReferrals: 20, minTeamMembers: 1500, minRequiredRank: 'D5', minRequiredRankCount: 3, activationGain: 70 },
];

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected for rank config migration...');

  const ranks = await Rank.find({ isActive: true }).sort({ order: 1 }).lean();
  if (!ranks.length) {
    console.log('No active ranks found. Nothing to do.');
    process.exit(0);
  }

  let updated = 0;
  let skipped = 0;

  for (const rank of ranks) {
    const cfg = DEFAULT_CONFIG.find((c) => c.order === rank.order);
    if (!cfg) {
      skipped++;
      continue;
    }

    const update = {};
    if (!rank.minDirectReferrals && cfg.minDirectReferrals) update.minDirectReferrals = cfg.minDirectReferrals;
    if (!rank.minTeamMembers && cfg.minTeamMembers) update.minTeamMembers = cfg.minTeamMembers;
    if (!rank.minRequiredRank && cfg.minRequiredRank) update.minRequiredRank = cfg.minRequiredRank;
    if (!rank.minRequiredRankCount && cfg.minRequiredRankCount) update.minRequiredRankCount = cfg.minRequiredRankCount;
    if (!rank.activationGain && cfg.activationGain) update.activationGain = cfg.activationGain;

    if (Object.keys(update).length === 0) {
      console.log(`  Skipped ${rank.name} (already configured)`);
      skipped++;
      continue;
    }

    await Rank.updateOne({ _id: rank._id }, { $set: update });
    console.log(`  Updated ${rank.name} -> ${JSON.stringify(update)}`);
    updated++;
  }

  console.log(`\nMigration complete: ${updated} rank(s) updated, ${skipped} skipped.`);
  process.exit(0);
};

migrate().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});
