const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Rank = require('../models/Rank');

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected...\n');

    const rankConfig = [
      { order: 1, name: 'V1', slug: 'v1', activationGain: 30, quantification: 4, indirectIncome: 0 },
      { order: 2, name: 'V2', slug: 'v2', activationGain: 40, quantification: 6, indirectIncome: 10 },
      { order: 3, name: 'V3', slug: 'v3', activationGain: 50, quantification: 8, indirectIncome: 20 },
      { order: 4, name: 'V4', slug: 'v4', activationGain: 60, quantification: 10, indirectIncome: 30 },
      { order: 5, name: 'V5', slug: 'v5', activationGain: 65, quantification: 11, indirectIncome: 35 },
      { order: 6, name: 'V6', slug: 'v6', activationGain: 70, quantification: 12, indirectIncome: 40 },
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
          $set: {
            activationGain: cfg.activationGain,
            quantification: cfg.quantification,
            indirectIncome: cfg.indirectIncome
          }
        });
        console.log(`Replaced ${oldRank.slug} (already had ${cfg.slug}), updated ${cfg.name} commission values`);
      } else {
        await Rank.findByIdAndUpdate(oldRank._id, {
          $set: {
            name: cfg.name,
            slug: cfg.slug,
            activationGain: cfg.activationGain,
            quantification: cfg.quantification,
            indirectIncome: cfg.indirectIncome
          }
        });
        console.log(`Renamed ${oldRank.slug} → ${cfg.name} with commission values`);
      }
    }

    for (const cfg of rankConfig) {
      const rank = await Rank.findOneAndUpdate(
        { slug: cfg.slug },
        {
          $set: {
            activationGain: cfg.activationGain,
            quantification: cfg.quantification,
            indirectIncome: cfg.indirectIncome
          }
        },
        { new: true }
      );
      if (rank) {
        console.log(`Updated: ${rank.name} (${rank.slug}) → activationGain=${rank.activationGain}, quantification=${rank.quantification}%, indirectIncome=${rank.indirectIncome}`);
      }
    }

    const allRanks = await Rank.find({}).sort({ order: 1 }).lean();
    console.log('\n📊 Final ranks in DB:');
    allRanks.forEach(r => {
      console.log(`  ${r.name} (${r.slug}): gain=${r.activationGain}, quant=${r.quantification}%, indirect=${r.indirectIncome}`);
    });

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

migrate();
