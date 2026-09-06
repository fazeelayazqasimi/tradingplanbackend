const mongoose = require('mongoose');
const User = require('../models/User');
const Rank = require('../models/Rank');
const UserRank = require('../models/UserRank');
const Referral = require('../models/Referral');
const { sendRankPromotionEmail } = require('./emailService');
const ActivityLog = require('../models/ActivityLog');

const ACTIVE_REFERRAL_STATUSES = ['converted', 'paid'];
const ALL_REFERRAL_STATUSES = ['converted', 'paid', 'pending', 'registered'];
const MAX_TREE_DEPTH = 30;

const getActiveRanks = () => Rank.find({ isActive: true }).sort({ order: 1 }).lean();

/**
 * Computes rank qualification from the actual network data:
 *  - directReferrals:  active (converted/paid) level-1 referrals
 *  - activeTeamMembers: all active descendants across the whole tree (free members excluded)
 *  - qualifiedLegs:     number of distinct direct legs that contain at least ONE member
 *                       whose rank order >= the required rank order. Multiple qualifying
 *                       members inside the same direct leg count as a single leg only.
 */
const getRankQualification = async (userId, { requiredRankName = null, qualifiedLegsRequired = 0 } = {}) => {
  const result = {
    directReferrals: 0,
    activeTeamMembers: 0,
    qualifiedLegs: 0,
    qualifiedLegsRequired: qualifiedLegsRequired || 0,
    requiredRankName: requiredRankName || null
  };

  let requiredRankOrder = null;
  if (requiredRankName) {
    const requiredRank = await Rank.findOne({ name: requiredRankName, isActive: true }).lean();
    if (requiredRank) requiredRankOrder = requiredRank.order;
  }

  const allRanks = await Rank.find({ isActive: true }).select('name order').lean();
  const orderByRankId = new Map(allRanks.map((r) => [r._id.toString(), r.order]));

  const isQualified = (rankId) => {
    if (requiredRankOrder === null || !rankId) return false;
    const order = orderByRankId.get(rankId.toString());
    return order !== undefined && order >= requiredRankOrder;
  };

  const legs = await Referral.find({
    referrerId: userId,
    level: 1,
    status: { $in: ALL_REFERRAL_STATUSES }
  }).select('_id referredUserId status').lean();

  // Direct referrals count: only converted/paid
  const activeLegs = legs.filter(l => ACTIVE_REFERRAL_STATUSES.includes(l.status));
  result.directReferrals = activeLegs.length;
  
  // Team Size = ALL active members in the entire hierarchy (direct + indirect)
  // Direct active members (converted/paid) must be counted first
  result.activeTeamMembers = activeLegs.length;

  const legQualified = new Set();
  let frontier = legs.map((leg) => ({
    userId: leg.referredUserId.toString(),
    legId: leg._id.toString()
  }));

  let depth = 0;
  while (frontier.length > 0 && depth < MAX_TREE_DEPTH) {
    depth++;
    const ids = frontier.map((f) => f.userId);

    const [userRanks, children] = await Promise.all([
      UserRank.find({ userId: { $in: ids } }).select('userId currentRankId').lean(),
      Referral.find({
        referrerId: { $in: ids },
        level: 1,
        status: { $in: ALL_REFERRAL_STATUSES }
      }).select('referrerId referredUserId').lean()
    ]);

    const rankByUser = new Map(userRanks.map((ur) => [ur.userId.toString(), ur.currentRankId]));
    const childrenByParent = new Map();
    for (const child of children) {
      const key = child.referrerId.toString();
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key).push(child.referredUserId.toString());
    }

    const nextFrontier = [];
    for (const f of frontier) {
      if (requiredRankOrder !== null && !legQualified.has(f.legId)) {
        const rankId = rankByUser.get(f.userId);
        if (rankId && isQualified(rankId)) {
          legQualified.add(f.legId);
          result.qualifiedLegs++;
        }
      }
      for (const childId of childrenByParent.get(f.userId) || []) {
        const user = await User.findById(childId).select('isApproved subscriptionStatus').lean();
        nextFrontier.push({ userId: childId, legId: f.legId });
        if (user && user.isApproved && user.subscriptionStatus === 'active') {
          result.activeTeamMembers++;
        }
      }
    }
    frontier = nextFrontier;
  }

  return result;
};

const updateRankStats = async (userRankDoc, userId) => {
  try {
    const allRefs = await Referral.find({ referrerId: new mongoose.Types.ObjectId(userId), status: { $in: ACTIVE_REFERRAL_STATUSES } }).lean();
    const directCount = allRefs.filter(r => r.level === 1).length;
    const totalReferrals = allRefs.length;

    // Indirect = every active downline member that is NOT a direct referral.
    // Counting the full downline (all levels) rather than only grandchildren.
    const indirectCount = totalReferrals - directCount;

    const totalRevenue = allRefs.reduce((sum, r) => sum + (r.conversionAmount || 0), 0);
    const totalCommission = allRefs.reduce((sum, r) => sum + (r.commissionAmount || 0), 0);

    userRankDoc.totalReferrals = totalReferrals;
    userRankDoc.indirectReferrals = indirectCount;
    userRankDoc.totalRevenue = totalRevenue;
    userRankDoc.totalCommission = totalCommission;
  } catch (e) {
    console.error('[RANK] updateRankStats error:', e.message);
  }
};

const checkAndPromoteRank = async (userId) => {
  const userRankDoc = await UserRank.findOne({ userId });
  if (!userRankDoc) return null;

  if (userRankDoc.isLocked) {
    return { promoted: false, locked: true, currentRank: userRankDoc.currentRankId };
  }

  const allRanks = await getActiveRanks();
  if (!allRanks.length) return null;

  await updateRankStats(userRankDoc, userId);

  const currentRank = allRanks.find((r) => r._id.toString() === userRankDoc.currentRankId.toString());
  const currentOrder = currentRank ? currentRank.order : 0;

  // Test the highest ranks first: qualifying for a higher rank implies qualifying for lower ones
  const higherRanks = allRanks
    .filter((r) => r.order > currentOrder)
    .sort((a, b) => b.order - a.order);

  let qualifyingRank = null;
  let qualification = null;

  for (const rank of higherRanks) {
    const minDirect = rank.minDirectReferrals || 0;
    const minTeam = rank.minTeamMembers || 0;
    const minLegs = rank.minRequiredRank ? (rank.minRequiredRankCount || 0) : 0;

    const q = await getRankQualification(userId, {
      requiredRankName: rank.minRequiredRank || null,
      qualifiedLegsRequired: minLegs
    });

    if (q.directReferrals < minDirect) continue;
    if (q.activeTeamMembers < minTeam) continue;
    if (minLegs > 0 && q.qualifiedLegs < minLegs) continue;

    qualifyingRank = rank;
    qualification = q;
    break;
  }

  if (qualifyingRank) {
    const previousRankId = userRankDoc.currentRankId;
    userRankDoc.currentRankId = qualifyingRank._id;
    userRankDoc.rankHistory.push({
      rankId: qualifyingRank._id,
      achievedAt: new Date(),
      reason: `Automatic promotion: ${qualification.directReferrals} direct referrals, ${qualification.activeTeamMembers} active team members, ${qualification.qualifiedLegs} qualified legs`,
      changedBy: null,
      changeType: 'automatic'
    });
    userRankDoc.eligibleForPromotion = false;
    await userRankDoc.save();

    try {
      const user = await User.findById(userId).lean();
      if (user) await sendRankPromotionEmail(user, qualifyingRank);
    } catch (_) {}

    try {
      await ActivityLog.logActivity({
        userId,
        action: 'rank_promotion',
        entity: 'UserRank',
        entityId: userRankDoc._id,
        changes: {
          previousRankId,
          newRankId: qualifyingRank._id,
          rankName: qualifyingRank.name,
          directReferrals: qualification.directReferrals,
          activeTeamMembers: qualification.activeTeamMembers,
          qualifiedLegs: qualification.qualifiedLegs
        },
        status: 'success'
      });
    } catch (_) {}

    return {
      promoted: true,
      previousRank: previousRankId,
      newRank: qualifyingRank,
      qualification
    };
  }

  return { promoted: false, currentRank: userRankDoc.currentRankId };
};

const adminOverrideRank = async (userId, newRankId, reason, adminId) => {
  const rank = await Rank.findById(newRankId).lean();
  if (!rank) throw new Error('Rank not found');

  let userRank = await UserRank.findOne({ userId });
  if (!userRank) {
    userRank = await UserRank.create({
      userId,
      currentRankId: newRankId,
      rankHistory: [{
        rankId: newRankId,
        achievedAt: new Date(),
        reason: reason || 'Admin manual override',
        changedBy: adminId,
        changeType: 'manual'
      }]
    });
    return { userRank, rank, changed: true };
  }

  const previousRankId = userRank.currentRankId;
  userRank.currentRankId = newRankId;
  userRank.isLocked = false;
  userRank.lockedBy = null;
  userRank.lockedAt = null;
  userRank.lockReason = null;
  userRank.rankHistory.push({
    rankId: newRankId,
    achievedAt: new Date(),
    reason: reason || 'Admin manual override',
    changedBy: adminId,
    changeType: 'manual'
  });
  await userRank.save();

  try {
    const user = await User.findById(userId).lean();
    await sendRankPromotionEmail(user, rank);
  } catch (_) {}

  try {
    await ActivityLog.logActivity({
      userId: adminId,
      action: 'admin_rank_override',
      entity: 'UserRank',
      entityId: userRank._id,
      changes: {
        targetUserId: userId,
        previousRankId,
        newRankId,
        rankName: rank.name,
        reason
      },
      status: 'success'
    });
  } catch (_) {}

  return { userRank, rank, changed: true };
};

const lockRank = async (userId, adminId, reason) => {
  const userRank = await UserRank.findOne({ userId });
  if (!userRank) throw new Error('User rank record not found');

  userRank.isLocked = true;
  userRank.lockedBy = adminId;
  userRank.lockedAt = new Date();
  userRank.lockReason = reason || null;
  await userRank.save();

  try {
    await ActivityLog.logActivity({
      userId: adminId,
      action: 'rank_lock',
      entity: 'UserRank',
      entityId: userRank._id,
      changes: { targetUserId: userId, reason },
      status: 'success'
    });
  } catch (_) {}

  return userRank;
};

const unlockRank = async (userId, adminId) => {
  const userRank = await UserRank.findOne({ userId });
  if (!userRank) throw new Error('User rank record not found');

  userRank.isLocked = false;
  userRank.lockedBy = null;
  userRank.lockedAt = null;
  userRank.lockReason = null;
  await userRank.save();

  try {
    await ActivityLog.logActivity({
      userId: adminId,
      action: 'rank_unlock',
      entity: 'UserRank',
      entityId: userRank._id,
      changes: { targetUserId: userId },
      status: 'success'
    });
  } catch (_) {}

  return userRank;
};

const getRankDistribution = async () => {
  const distribution = await UserRank.aggregate([
    {
      $lookup: {
        from: 'ranks',
        localField: 'currentRankId',
        foreignField: '_id',
        as: 'rank'
      }
    },
    { $unwind: { path: '$rank', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$currentRankId',
        rankName: { $first: '$rank.name' },
        rankSlug: { $first: '$rank.slug' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const allRanks = await Rank.find({ isActive: true }).sort({ order: 1 }).lean();

  const result = allRanks.map((rank) => {
    const found = distribution.find((d) => d._id && d._id.toString() === rank._id.toString());
    return {
      rank: {
        id: rank._id,
        name: rank.name,
        slug: rank.slug,
        order: rank.order
      },
      count: found ? found.count : 0
    };
  });

  const unranked = await UserRank.countDocuments({ currentRankId: null });

  return { distribution: result, unranked };
};

const resetRanks = async (adminId) => {
  const lowestRank = await Rank.findOne({ isActive: true }).sort({ order: 1 }).lean();
  if (!lowestRank) throw new Error('No active ranks found');

  const result = await UserRank.updateMany(
    {},
    {
      $set: {
        currentRankId: lowestRank._id,
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
        lockReason: null,
        eligibleForPromotion: false
      },
      $push: {
        rankHistory: {
          rankId: lowestRank._id,
          achievedAt: new Date(),
          reason: 'System-wide rank reset by admin',
          changedBy: adminId,
          changeType: 'manual'
        }
      }
    }
  );

  try {
    await ActivityLog.logActivity({
      userId: adminId,
      action: 'rank_reset_all',
      entity: 'UserRank',
      entityId: lowestRank._id,
      changes: { usersAffected: result.modifiedCount, resetToRank: lowestRank.name },
      status: 'success'
    });
  } catch (_) {}

  return { modifiedCount: result.modifiedCount, resetToRank: lowestRank.name };
};

module.exports = {
  checkAndPromoteRank,
  getRankQualification,
  adminOverrideRank,
  lockRank,
  unlockRank,
  getRankDistribution,
  resetRanks
};
