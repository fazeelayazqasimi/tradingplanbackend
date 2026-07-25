const Referral = require('../models/Referral');
const User = require('../models/User');
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
    const pending = await Referral.aggregate([
      { $match: { referrerId: req.user._id, status: 'converted' } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    sendSuccess(res, { directReferrals: directCount, indirectReferrals: indirectCount, totalEarnings: earnings[0]?.total || 0, pendingCommission: pending[0]?.total || 0 });
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
    sendSuccess(res, tree);
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
