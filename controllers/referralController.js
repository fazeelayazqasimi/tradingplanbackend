const Referral = require('../models/Referral');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getMyReferralCode = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('referralCode');
    sendSuccess(res, { referralCode: user.referralCode, referralLink: `${process.env.FRONTEND_URL}/register?ref=${user.referralCode}` });
  } catch (error) { next(error); }
};

exports.getReferralStats = async (req, res, next) => {
  try {
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

    const freeRegEarnings = await WalletTransaction.aggregate([
      { $match: { userId: req.user._id, category: 'bonus', description: /Free registration/i } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    sendSuccess(res, {
      directReferrals: directCount,
      indirectReferrals: indirectCount,
      totalEarnings: earnings[0]?.total || 0,
      pendingCommission: pendingCommissions[0]?.total || 0,
      pendingReferrals: pendingCount,
      activeReferrals: activeCount,
      freeRegistrationEarnings: freeRegEarnings[0]?.total || 0,
    });
  } catch (error) { next(error); }
};

async function buildTree(userId, currentLevel = 1, maxDepth = 10) {
  if (currentLevel > maxDepth) return [];
  const referrals = await Referral.find({ referrerId: userId, level: 1 })
    .populate('referredUserId', 'firstName lastName email createdAt')
    .lean();
  const nodes = [];
  for (const ref of referrals) {
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
    const tree = await buildTree(req.user._id);

    const allRefs = await Referral.find({ referrerId: req.user._id })
      .populate('referredUserId', 'firstName lastName email createdAt')
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

    sendSuccess(res, {
      tree,
      direct,
      indirect,
      stats: {
        totalDirect: direct.length,
        totalIndirect: indirect.length,
        totalReferrals: direct.length + indirect.length,
        totalCommission: Math.round(totalCommission * 100) / 100,
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
