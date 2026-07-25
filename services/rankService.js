const mongoose = require('mongoose');
const User = require('../models/User');
const Rank = require('../models/Rank');
const UserRank = require('../models/UserRank');
const Referral = require('../models/Referral');
const { sendRankPromotionEmail } = require('./emailService');
const ActivityLog = require('../models/ActivityLog');

const checkAndPromoteRank = async (userId) => {
  const userRank = await UserRank.findOne({ userId })
    .populate('currentRankId')
    .lean();

  if (!userRank) return null;

  const userRankDoc = await UserRank.findOne({ userId });
  if (userRankDoc.isLocked) {
    return { promoted: false, locked: true, currentRank: userRank.currentRankId };
  }

  const directReferrals = await Referral.countDocuments({
    referrerId: userId,
    level: 1,
    status: { $in: ['converted', 'paid'] }
  });

  const indirectReferrals = await Referral.countDocuments({
    referrerId: userId,
    level: { $gte: 2 },
    status: { $in: ['converted', 'paid'] }
  });

  const totalReferrals = directReferrals + indirectReferrals;

  const user = await User.findById(userId).lean();
  if (!user) return null;

  const revenueResult = await Referral.aggregate([
    { $match: { referrerId: new mongoose.Types.ObjectId(userId), status: { $in: ['converted', 'paid'] } } },
    { $group: { _id: null, total: { $sum: '$conversionAmount' } } }
  ]);
  const computedRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

  userRankDoc.totalReferrals = totalReferrals;
  userRankDoc.indirectReferrals = indirectReferrals;
  userRankDoc.totalRevenue = computedRevenue;
  await userRankDoc.save();

  const allRanks = await Rank.find({ isActive: true }).sort({ order: 1 }).lean();
  if (!allRanks.length) return null;

  const totalTeam = directReferrals + indirectReferrals;

  let qualifyingRank = allRanks[0];
  for (const rank of allRanks) {
    let meets = true;

    if (rank.minDirectReferrals > 0 && directReferrals < rank.minDirectReferrals) meets = false;
    if (rank.minTeamMembers > 0 && totalTeam < rank.minTeamMembers) meets = false;

    if (rank.minRequiredRank && rank.minRequiredRankCount > 0) {
      const requiredRank = allRanks.find(r => r.name === rank.minRequiredRank);
      if (requiredRank) {
        const qualifiedRefs = await Referral.countDocuments({
          referrerId: userId,
          level: 1,
          status: { $in: ['converted', 'paid'] }
        });
        const usersWithRank = await UserRank.countDocuments({
          userId: { $in: (await Referral.find({ referrerId: userId, level: 1 }).distinct('referredUserId')) },
          currentRankId: { $ne: null }
        });
        const qualifiedCount = Math.min(qualifiedRefs, usersWithRank);
        if (qualifiedCount < rank.minRequiredRankCount) meets = false;
      }
    }

    if (meets) {
      qualifyingRank = rank;
    }
  }

  const currentRankOrder = userRank.currentRankId ? userRank.currentRankId.order : 0;

  if (qualifyingRank.order > currentRankOrder) {
    const previousRankId = userRankDoc.currentRankId;
    userRankDoc.currentRankId = qualifyingRank._id;
    userRankDoc.rankHistory.push({
      rankId: qualifyingRank._id,
      achievedAt: new Date(),
      reason: `Automatic promotion: ${totalReferrals} referrals, $${computedRevenue.toFixed(2)} revenue`,
      changedBy: null,
      changeType: 'automatic'
    });
    userRankDoc.eligibleForPromotion = false;
    await userRankDoc.save();

    try {
      await sendRankPromotionEmail(user, qualifyingRank);
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
          totalReferrals,
          totalRevenue: computedRevenue
        },
        status: 'success'
      });
    } catch (_) {}

    return { promoted: true, previousRank: userRank.currentRankId, newRank: qualifyingRank };
  }

  return { promoted: false, currentRank: userRank.currentRankId };
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
  adminOverrideRank,
  lockRank,
  unlockRank,
  getRankDistribution,
  resetRanks
};
