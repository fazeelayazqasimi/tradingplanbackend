const Referral = require('../models/Referral');
const User = require('../models/User');
const Setting = require('../models/Setting');
const WalletTransaction = require('../models/WalletTransaction');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { processReferralCommission, generateReferralCode } = require('../services/referralService');

const USER_SELECT = 'firstName lastName email createdAt isApproved subscriptionStatus';

const isActiveMember = (u) => !!(u && (u.isApproved || u.subscriptionStatus === 'active'));

exports.getMyReferralCode = async (req, res, next) => {
  try {
    let user = await User.findById(req.user._id).select('referralCode firstName');

    if (!user.referralCode) {
      const code = await generateReferralCode(user.firstName);
      user = await User.findByIdAndUpdate(req.user._id, { referralCode: code }, { new: true });
    }

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

/**
 * BFS over level-1 referral links starting from `userId`.
 * Cycle-safe via visited set; returns every downline member tagged with depth
 * (1 = direct, 2+ = indirect). No depth cap, so full downline is always counted.
 */
async function getDownlineMembers(userId, startDate, endDate) {
  // Single aggregation using $graphLookup to walk the entire downline in ONE
  // query (eliminates the previous N+1 BFS). Each referral is stored with
  // level:1 relative to its immediate referrer, so following only level-1
  // edges reproduces the full tree and preserves each node's depth.
  const USER_PROJECT = {
    firstName: 1,
    lastName: 1,
    email: 1,
    createdAt: 1,
    isApproved: 1,
    subscriptionStatus: 1,
  };

  const matchFilter = {
    referrerId: userId,
    referredUserId: { $exists: true, $ne: null },
  };
  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const docs = await Referral.aggregate([
    {
      $match: matchFilter,
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $graphLookup: {
        from: 'referrals',
        startWith: '$referredUserId',
        connectFromField: 'referredUserId',
        connectToField: 'referrerId',
        as: 'descendants',
        maxDepth: 50,
        depthField: '_gdepth',
      },
    },
    {
      $project: {
        direct: [{
          _id: '$_id',
          referredUserId: '$referredUserId',
          status: '$status',
          commissionAmount: '$commissionAmount',
          conversionType: '$conversionType',
          conversionAmount: '$conversionAmount',
          createdAt: '$createdAt',
          level: '$level',
          depth: 1,
        }],
        descendants: {
          $map: {
            input: {
              $filter: {
                input: '$descendants',
                as: 'd',
                cond: { $eq: ['$$d.level', 1] },
              },
            },
            as: 'd',
            in: {
              _id: '$$d._id',
              referredUserId: '$$d.referredUserId',
              status: '$$d.status',
              commissionAmount: '$$d.commissionAmount',
              conversionType: '$$d.conversionType',
              conversionAmount: '$$d.conversionAmount',
              createdAt: '$$d.createdAt',
              level: '$$d.level',
              depth: { $add: ['$$d._gdepth', 2] },
            },
          },
        },
      },
    },
    { $project: { items: { $concatArrays: ['$direct', '$descendants'] } } },
    { $unwind: '$items' },
    { $replaceRoot: { newRoot: '$items' } },
    {
      $lookup: {
        from: 'users',
        let: { uid: '$referredUserId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
          { $project: USER_PROJECT },
        ],
        as: 'user',
      },
    },
    { $match: { $expr: { $gt: [{ $size: '$user' }, 0] } } },
    { $addFields: { referredUserId: { $arrayElemAt: ['$user', 0] } } },
    { $project: { user: 0 } },
    // Dedupe by user (mirrors the original BFS visited-set): the same downline
    // member can have multiple referral records across different upline referrers.
    { $group: { _id: '$referredUserId._id', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
  ]);

  return docs.map((d) => ({ ref: d, depth: d.depth }));
}

/**
 * Climb the referral chain from `targetId` up to `maxHops` levels to verify
 * it belongs to `rootId`'s downline (or is root itself).
 */
async function isInDownline(rootId, targetId, maxHops = 50) {
  if (!targetId) return false;
  if (rootId.toString() === targetId.toString()) return true;
  let current = targetId.toString();
  for (let i = 0; i < maxHops; i++) {
    const ref = await Referral.findOne({ referredUserId: current }).select('referrerId').lean();
    if (!ref) return false;
    if (ref.referrerId.toString() === rootId.toString()) return true;
    current = ref.referrerId.toString();
  }
  return false;
}

const mapReferral = (ref, level) => ({
  _id: ref._id,
  user: ref.referredUserId,
  level,
  status: ref.status,
  commission: ref.commissionAmount,
  conversionType: ref.conversionType,
  conversionAmount: ref.conversionAmount,
  createdAt: ref.createdAt,
});

/**
 * Returns one level of children for a user (lazy tree expansion),
 * each node carrying its own child count.
 */
async function buildChildren(userId, startDate, endDate) {
  const matchFilter = {};
  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }
  const refs = await Referral.find({ referrerId: userId, level: 1, ...matchFilter })
    .populate('referredUserId', USER_SELECT)
    .sort({ createdAt: -1 })
    .lean();
  const ids = refs.filter(r => r.referredUserId).map(r => r.referredUserId._id);
  const countByUser = new Map();
  if (ids.length > 0) {
    const counts = await Referral.aggregate([
      { $match: { referrerId: { $in: ids }, level: 1 } },
      { $group: { _id: '$referrerId', count: { $sum: 1 } } },
    ]);
    for (const c of counts) countByUser.set(c._id.toString(), c.count);
  }
  return refs
    .filter(r => r.referredUserId)
    .map(ref => ({
      ...mapReferral(ref, 1),
      childCount: countByUser.get(ref.referredUserId._id.toString()) || 0,
    }));
}

exports.getReferralStats = async (req, res, next) => {
  try {
    await processPendingForUser(req.user._id);

    // Date filter support
    const { startDate, endDate } = req.query;
    let matchFilter = { referrerId: req.user._id };
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const members = await getDownlineMembers(req.user._id, startDate, endDate);
    const directCount = members.filter(m => m.depth === 1).length;
    const indirectCount = members.filter(m => m.depth >= 2).length;
    const totalDownline = members.length;
    const activeMembers = members.filter(m => isActiveMember(m.ref.referredUserId)).length;
    const freeMembers = totalDownline - activeMembers;

    const earnings = await Referral.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const pendingCommissions = await Referral.aggregate([
      { $match: { ...matchFilter, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const pendingCount = await Referral.countDocuments({ ...matchFilter, status: 'pending' });
    const activeCount = await Referral.countDocuments({ ...matchFilter, status: { $in: ['converted', 'paid'] } });

    const freeRegEarnings = await WalletTransaction.aggregate([
      { $match: { userId: req.user._id, category: 'registration' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    sendSuccess(res, {
      directReferrals: directCount,
      indirectReferrals: indirectCount,
      totalReferrals: totalDownline,
      totalTeam: totalDownline,
      totalDownline,
      totalEarnings: (earnings[0]?.total || 0) + (freeRegEarnings[0]?.total || 0),
      pendingCommission: pendingCommissions[0]?.total || 0,
      pendingReferrals: pendingCount,
      activeReferrals: activeCount,
      activeMembers,
      freeMembers,
      active: activeMembers,
      free: freeMembers,
      freeRegistrationEarnings: freeRegEarnings[0]?.total || 0,
    });
  } catch (error) { next(error); }
};

exports.getReferralTree = async (req, res, next) => {
  try {
    await processPendingForUser(req.user._id);

    const { startDate, endDate } = req.query;

    // Root + first level only; deeper branches are loaded lazily via /tree/:userId
    const tree = await buildChildren(req.user._id, startDate, endDate);

    const members = await getDownlineMembers(req.user._id, startDate, endDate);
    const direct = members.filter(m => m.depth === 1).map(m => mapReferral(m.ref, 1));
    const indirect = members.filter(m => m.depth >= 2).map(m => mapReferral(m.ref, m.depth));

    const commissionAgg = await Referral.aggregate([
      { $match: { referrerId: req.user._id } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);

    const totalDownline = members.length;
    const active = members.filter(m => isActiveMember(m.ref.referredUserId)).length;

    sendSuccess(res, {
      tree,
      direct,
      indirect,
      stats: {
        totalDirect: direct.length,
        totalIndirect: indirect.length,
        totalReferrals: totalDownline,
        totalDownline,
        active,
        free: totalDownline - active,
        totalCommission: Math.round((commissionAgg[0]?.total || 0) * 100) / 100,
        activeMembers: active,
        freeMembers: totalDownline - active,
      },
    });
  } catch (error) { next(error); }
};

exports.getReferralChildren = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) return sendError(res, 'User ID is required', 400);
    const allowed = await isInDownline(req.user._id, userId);
    if (!allowed) return sendError(res, 'Not authorized to view this branch', 403);
    const nodes = await buildChildren(userId);
    sendSuccess(res, { nodes });
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

exports.getDownlineMembers = getDownlineMembers;
