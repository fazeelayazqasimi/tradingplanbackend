const Rank = require('../models/Rank');
const UserRank = require('../models/UserRank');
const User = require('../models/User');
const { getRankQualification } = require('../services/rankService');
const { sendSuccess, sendError } = require('../helpers/response');

const DEFAULT_RANKS = [
  { name: 'D1', order: 1, minDirectReferrals: 0, minTeamMembers: 0, minRequiredRank: null, minRequiredRankCount: 0, activationGain: 30, quantification: 4, indirectIncome: 0, minReferrals: 0, minRevenue: 0, commissionPercent: 0, perks: ['Base member'], isActive: true },
  { name: 'D2', order: 2, minDirectReferrals: 3, minTeamMembers: 20, minRequiredRank: 'D1', minRequiredRankCount: 3, activationGain: 40, quantification: 6, indirectIncome: 10, minReferrals: 3, minRevenue: 300, commissionPercent: 10, perks: ['Direct Referral Bonus', 'Copy Trading Share'], isActive: true },
  { name: 'D3', order: 3, minDirectReferrals: 5, minTeamMembers: 100, minRequiredRank: 'D2', minRequiredRankCount: 3, activationGain: 50, quantification: 8, indirectIncome: 20, minReferrals: 5, minRevenue: 1000, commissionPercent: 15, perks: ['Priority Support'], isActive: true },
  { name: 'D4', order: 4, minDirectReferrals: 8, minTeamMembers: 300, minRequiredRank: 'D3', minRequiredRankCount: 3, activationGain: 60, quantification: 10, indirectIncome: 30, minReferrals: 8, minRevenue: 2500, commissionPercent: 20, perks: ['VIP Support', 'Exclusive Signals'], isActive: true },
  { name: 'D5', order: 5, minDirectReferrals: 12, minTeamMembers: 800, minRequiredRank: 'D4', minRequiredRankCount: 3, activationGain: 65, quantification: 11, indirectIncome: 35, minReferrals: 12, minRevenue: 5000, commissionPercent: 25, perks: ['Personal Mentor', 'Custom Strategies'], isActive: true },
  { name: 'D6', order: 6, minDirectReferrals: 20, minTeamMembers: 1500, minRequiredRank: 'D5', minRequiredRankCount: 3, activationGain: 70, quantification: 12, indirectIncome: 40, minReferrals: 20, minRevenue: 10000, commissionPercent: 30, perks: ['Elite Mentorship', 'Revenue Sharing'], isActive: true },
];

exports.getRanks = async (req, res, next) => {
  try {
    let ranks = await Rank.find({ isActive: true }).sort({ order: 1 });
    if (ranks.length === 0) {
      ranks = await Rank.insertMany(DEFAULT_RANKS.map((r) => ({ ...r, slug: r.name.toLowerCase() })));
      console.log('[RANKS] Auto-seeded default ranks');
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

    // Rank qualification counts ACTIVE members only (converted/paid) - free
    // registrations (pending) are excluded. Qualified legs are computed from
    // the real network, one qualifying rank member per direct leg.
    const qualification = await getRankQualification(req.user._id, {
      requiredRankName: nextRank?.minRequiredRank || null,
      qualifiedLegsRequired: nextRank?.minRequiredRankCount || 0
    });

    sendSuccess(res, {
      userRank,
      nextRank,
      allRanks,
      directCount: qualification.directReferrals,
      totalTeam: qualification.activeTeamMembers,
      qualifiedLegs: qualification.qualifiedLegs,
      qualifiedLegsRequired: nextRank?.minRequiredRankCount || 0,
      requiredRankName: nextRank?.minRequiredRank || null,
    });
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
    const data = { ...req.body };
    if (data.order === undefined || data.order === null) {
      const lastRank = await Rank.findOne().sort({ order: -1 });
      data.order = (lastRank?.order ?? 0) + 1;
    }
    if (!data.slug && data.name) {
      data.slug = data.name.toLowerCase().replace(/\s+/g, '-');
    }
    const rank = await Rank.create(data);
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
