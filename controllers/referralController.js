const Referral = require('../models/Referral');
const User = require('../models/User');
const Setting = require('../models/Setting');
const WalletTransaction = require('../models/WalletTransaction');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { processReferralCommission } = require('../services/referralService');

exports.getMyReferralCode = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('referralCode');
    sendSuccess(res, { referralCode: user.referralCode, referralLink: `https://the4xhub.com/register?ref=${user.referralCode}` });
  } catch (error) { next(error); }
};

async function processPendingForUser(userId) {
  try {
    const setting = await Setting.findOne({ key: 'membership_price' });
    const amount = (setting && Number(setting.value)) || 120;
    const pending = await Referral.find({ referrerId: userId, status: 'pending' }).populate('referredUserId', 'isApproved subscriptionStatus').lean();
    for (const ref of pending) {
      if (ref.referredUserId && (ref.referredUserId.isApproved || ref.referredUserId.subscriptionStatus === 'active')) {
        await processReferralCommission(ref.referredUserId._id, amount, 'subscription');
      }
    }
  } catch (e) {
    console.error('[REFERRAL] processPendingForUser error:', e.message);
  }
}

exports.getReferralStats = async (req, res, next) => {
  try {
    await processPendingForUser(req.user._id);
    const directCount = await Referral.countDocuments({ referrerId: req.user._id, level: 1 });
    const indirectCount = await Referral.countDocuments({ referrerId: req.user._id, level: { $gte: 2 } });
    const earnings = await Referral.aggregate([
      { $match: { referrerId: req.user._id, status: { $in: ['converted', 'paid'] } } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const pendingCommissions = await Referral.aggregate([
      { $match: { referrerId: req.user._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const pendingCount = await Referral.countDocuments({ referrerId: req.user._id, status: 'pending' });
    const activeCount = await Referral.countDocuments({ referrerId: req.user._id, status: { $in: ['converted', 'paid'] } });
    const activeMembers = await Referral.countDocuments({ referrerId: req.user._id, level: 1, status: { $in: ['converted', 'paid'] } });

    const freeRegEarnings = await WalletTransaction.aggregate([
      { $match: { userId: req.user._id, category: 'registration' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    sendSuccess(res, {
      directReferrals: directCount,
      indirectReferrals: indirectCount,
      totalEarnings: earnings[0]?.total || 0,
      pendingCommission: pendingCommissions[0]?.total || 0,
      pendingReferrals: pendingCount,
      activeReferrals: activeCount,
      activeMembers,
      freeRegistrationEarnings: freeRegEarnings[0]?.total || 0,
    });
  } catch (error) { next(error); }
};

async function buildTree(userId, currentLevel = 1, maxDepth = 10) {
  if (currentLevel > maxDepth || !userId) return [];
  const referrals = await Referral.find({ referrerId: userId, level: 1 })
    .populate('referredUserId', 'firstName lastName email createdAt isApproved subscriptionStatus')
    .lean();
  const nodes = [];
  for (const ref of referrals) {
    if (!ref.referredUserId) continue;
    const children = await buildTree(ref.referredUserId._id, currentLevel + 1, maxDepth);
    nodes.push({
      _id: ref._id,
      user: ref.referredUserId,
      level: currentLevel,
      status: ref.status,
      commission: ref.commissionAmount,
      conversionType: ref.conversionType,
      conversionAmount: ref.conversionAmount,
      createdAt: ref.createdAt,
      children
    });
  }
  return nodes;
}

exports.getReferralTree = async (req, res, next) => {
  try {
    await processPendingForUser(req.user._id);
    const tree = await buildTree(req.user._id);

    const allRefs = await Referral.find({ referrerId: req.user._id })
      .populate('referredUserId', 'firstName lastName email createdAt isApproved subscriptionStatus')
      .sort({ createdAt: -1 })
      .lean();

    const direct = allRefs.filter(r => (r.level || 1) === 1).map(r => ({
      _id: r._id,
      user: r.referredUserId,
      level: r.level || 1,
      status: r.status,
      commission: r.commissionAmount,
      conversionType: r.conversionType,
      conversionAmount: r.conversionAmount,
      createdAt: r.createdAt,
    }));

    const indirect = allRefs.filter(r => (r.level || 1) > 1).map(r => ({
      _id: r._id,
      user: r.referredUserId,
      level: r.level || 2,
      status: r.status,
      commission: r.commissionAmount,
      conversionType: r.conversionType,
      conversionAmount: r.conversionAmount,
      createdAt: r.createdAt,
    }));

    const totalCommission = allRefs.reduce((sum, r) => sum + (r.commissionAmount || 0), 0);

    const activeMembers = allRefs.filter((r) => {
      const u = r.referredUserId;
      return u && (u.isApproved || u.subscriptionStatus === 'active');
    }).length;

    sendSuccess(res, {
      tree,
      direct,
      indirect,
      stats: {
        totalDirect: direct.length,
        totalIndirect: indirect.length,
        totalReferrals: direct.length + indirect.length,
        totalCommission: Math.round(totalCommission * 100) / 100,
        activeMembers,
        freeMembers: allRefs.length - activeMembers,
      },
    });
  } catch (error) { next(error); }
};

exports.getReferralEarnings = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const total = await Referral.countDocuments({ referrerId: req.user._id });
    const earnings = await Referral.find({ referrerId: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('referredUserId', 'firstName lastName');
    sendPaginated(res, earnings, total, page, limit);
  } catch (error) { next(error); }
};

exports.deleteReferral = async (req, res, next) => {
  try {
    const referral = await Referral.findByIdAndDelete(req.params.id);
    if (!referral) return sendError(res, 'Referral not found', 404);
    sendSuccess(res, null, 'Referral deleted');
  } catch (error) { next(error); }
};
