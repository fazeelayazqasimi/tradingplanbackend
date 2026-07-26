const Rank = require('../models/Rank');
const UserRank = require('../models/UserRank');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../helpers/response');

exports.getRanks = async (req, res, next) => {
  try {
    let ranks = await Rank.find({ isActive: true }).sort({ order: 1 });
    if (ranks.length === 0) {
      const defaultRanks = [
        { name: 'D1', order: 1, minDirectReferrals: 0, minTeamSize: 0, minAtLeast: 0, minAtLeastRank: null, activationGain: 30, quantification: 4, indirectIncome: 0, minRevenue: 0, perks: ['Base member'], isActive: true },
        { name: 'D2', order: 2, minDirectReferrals: 3, minTeamSize: 20, minAtLeast: 0, minAtLeastRank: null, activationGain: 40, quantification: 6, indirectIncome: 10, minRevenue: 300, perks: ['Direct Referral Bonus', 'Copy Trading Share'], isActive: true },
        { name: 'D3', order: 3, minDirectReferrals: 5, minTeamSize: 100, minAtLeast: 3, minAtLeastRank: 'D2', activationGain: 50, quantification: 8, indirectIncome: 20, minRevenue: 1000, perks: ['Priority Support'], isActive: true },
        { name: 'D4', order: 4, minDirectReferrals: 8, minTeamSize: 300, minAtLeast: 3, minAtLeastRank: 'D3', activationGain: 60, quantification: 10, indirectIncome: 30, minRevenue: 2500, perks: ['VIP Support', 'Exclusive Signals'], isActive: true },
        { name: 'D5', order: 5, minDirectReferrals: 12, minTeamSize: 800, minAtLeast: 3, minAtLeastRank: 'D4', activationGain: 65, quantification: 11, indirectIncome: 35, minRevenue: 5000, perks: ['Personal Mentor', 'Custom Strategies'], isActive: true },
        { name: 'D6', order: 6, minDirectReferrals: 20, minTeamSize: 1500, minAtLeast: 3, minAtLeastRank: 'D5', activationGain: 70, quantification: 12, indirectIncome: 40, minRevenue: 10000, perks: ['Elite Mentorship', 'Revenue Sharing'], isActive: true },
      ];
      ranks = await Rank.insertMany(defaultRanks);
      console.log('[RANKS] Auto-seeded 6 default ranks');
    }
    sendSuccess(res, ranks);
  } catch (error) { next(error); }
};

exports.getMyRank = async (req, res, next) => {
  try {
    let userRank = await UserRank.findOne({ userId: req.user._id }).populate('currentRankId');
    if (!userRank) {
      const defaultRank = await Rank.findOne({ isActive: true }).sort({ order: 1 });
      if (!defaultRank) return sendError(res, 'No ranks configured', 404);
      userRank = await UserRank.create({ userId: req.user._id, currentRankId: defaultRank._id });
    }
    const allRanks = await Rank.find({ isActive: true }).sort({ order: 1 });
    const currentOrder = userRank.currentRankId?.order || 0;
    const nextRank = allRanks.find(r => r.order > currentOrder);

    const Referral = require('../models/Referral');
    const directCount = await Referral.countDocuments({ referrerId: req.user._id, level: 1 });
    const totalTeam = await Referral.countDocuments({ referrerId: req.user._id });

    sendSuccess(res, { userRank, nextRank, allRanks, directCount, totalTeam });
  } catch (error) { next(error); }
};

exports.getRankDistribution = async (req, res, next) => {
  try {
    const distribution = await UserRank.aggregate([
      { $lookup: { from: 'ranks', localField: 'currentRankId', foreignField: '_id', as: 'rank' } },
      { $unwind: { path: '$rank', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$rank.name', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    sendSuccess(res, distribution);
  } catch (error) { next(error); }
};

exports.adminOverrideRank = async (req, res, next) => {
  try {
    const { userId, rankId, reason } = req.body;
    const userRank = await UserRank.findOne({ userId });
    if (!userRank) return sendError(res, 'User rank not found', 404);
    const oldRank = userRank.currentRankId;
    userRank.currentRankId = rankId;
    userRank.rankHistory.push({ rankId, achievedAt: new Date(), reason, changedBy: req.user._id, changeType: 'manual' });
    await userRank.save();
    sendSuccess(res, userRank, 'Rank overridden');
  } catch (error) { next(error); }
};

exports.lockRank = async (req, res, next) => {
  try {
    const userRank = await UserRank.findOne({ userId: req.params.userId });
    if (!userRank) return sendError(res, 'Not found', 404);
    userRank.isLocked = true;
    userRank.lockedBy = req.user._id;
    userRank.lockedAt = new Date();
    userRank.lockReason = req.body.reason || 'Admin lock';
    await userRank.save();
    sendSuccess(res, userRank, 'Rank locked');
  } catch (error) { next(error); }
};

exports.unlockRank = async (req, res, next) => {
  try {
    const userRank = await UserRank.findOne({ userId: req.params.userId });
    if (!userRank) return sendError(res, 'Not found', 404);
    userRank.isLocked = false;
    userRank.lockedBy = undefined;
    userRank.lockedAt = undefined;
    userRank.lockReason = undefined;
    await userRank.save();
    sendSuccess(res, userRank, 'Rank unlocked');
  } catch (error) { next(error); }
};

exports.updateRank = async (req, res, next) => {
  try {
    const rank = await Rank.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!rank) return sendError(res, 'Rank not found', 404);
    sendSuccess(res, rank, 'Rank updated');
  } catch (error) { next(error); }
};

exports.createRank = async (req, res, next) => {
  try {
    const rank = await Rank.create(req.body);
    sendSuccess(res, rank, 'Rank created', 201);
  } catch (error) { next(error); }
};

exports.deleteRank = async (req, res, next) => {
  try {
    const rank = await Rank.findByIdAndDelete(req.params.id);
    if (!rank) return sendError(res, 'Rank not found', 404);
    await UserRank.deleteMany({ currentRankId: req.params.id });
    sendSuccess(res, null, 'Rank deleted');
  } catch (error) { next(error); }
};
