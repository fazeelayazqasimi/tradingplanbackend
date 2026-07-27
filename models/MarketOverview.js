const mongoose = require('mongoose');

const marketOverviewSchema = new mongoose.Schema({
  goldTrend: {
    type: String,
    enum: ['bullish', 'bearish', 'neutral'],
    default: 'neutral',
  },
  marketNews: {
    type: String,
    default: '',
    maxlength: 5000,
  },
  nextLiveClassDate: {
    type: String,
    default: '',
  },
  nextLiveClassTime: {
    type: String,
    default: '',
  },
  nextLiveClassLink: {
    type: String,
    default: '',
  },
  dailyMarketSummary: {
    type: String,
    default: '',
    maxlength: 10000,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

marketOverviewSchema.statics.getOrCreate = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

module.exports = mongoose.model('MarketOverview', marketOverviewSchema);
