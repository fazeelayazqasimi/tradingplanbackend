const mongoose = require('mongoose');
const User = require('../models/User');
const Referral = require('../models/Referral');
const UserRank = require('../models/UserRank');
const Rank = require('../models/Rank');
const { creditWallet, runInTransaction } = require('./walletService');
const { sendCommissionReceivedEmail } = require('./emailService');
const { REFERRAL_STATUSES } = require('../utils/constants');
const { checkAndPromoteRank } = require('./rankService');

const MAX_CHAIN_DEPTH = 30;

const generateReferralCode = async (name) => {
  const cleanName = (name || '').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6);
  const year = new Date().getFullYear();
  let code = cleanName ? `${cleanName}${year}` : null;

  if (code) {
    const existing = await User.findOne({ referralCode: code });
    if (!existing) return code;
  }

  let attempts = 0;
  while (attempts < 10) {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    code = cleanName
      ? `${cleanName}${randomPart}`
      : `${randomPart}${year.toString().slice(-2)}`;

    const existing = await User.findOne({ referralCode: code });
    if (!existing) return code;
    attempts++;
  }

  return `REF${Date.now().toString(36).toUpperCase().slice(-6)}`;
};

/**
 * GAP commission model.
 *
 * The direct sponsor receives commission according to their own rank
 * (rank.activationGain = maximum commission configured for that rank).
 *
 * Every upline receives ONLY the GAP commission amount:
 *   gap = ownRank.activationGain - highestCommissionPaidSoFar
 *
 * Because only the incremental difference is paid, the total payout for one
 * joining/transaction can never exceed the highest rank's configured
 * activationGain (e.g. $70 with the default D1-D6 configuration).
 *
 * The whole payout (atomic level-1 claim, wallet credits, referral records)
 * runs inside a single transaction, so partial or duplicate payouts are
 * impossible.
 */
const processReferralCommission = async (referredUserId, purchaseAmount, conversionType = 'subscription') => {
  const referredUser = await User.findById(referredUserId).lean();
  if (!referredUser || !referredUser.referredBy) return null;

  const results = await runInTransaction(async (session) => {
    // ------------------------------------------------------------------
    // 1. Atomically claim the level-1 referral record.
    //    Only one processing pass can convert it (pending -> converted).
    // ------------------------------------------------------------------
    let levelOneDoc = await Referral.findOneAndUpdate(
      {
        referredUserId,
        level: 1,
        referrerId: referredUser.referredBy,
        status: REFERRAL_STATUSES.PENDING
      },
      {
        $set: {
          status: REFERRAL_STATUSES.CONVERTED,
          conversionType,
          conversionAmount: purchaseAmount
        }
      },
      { new: true, session }
    );

    if (!levelOneDoc) {
      const existing = await Referral.findOne({ referredUserId, level: 1 }).session(session);
      if (existing) {
        if (existing.status !== REFERRAL_STATUSES.PENDING) return null;
        existing.status = REFERRAL_STATUSES.CONVERTED;
        existing.conversionType = conversionType;
        existing.conversionAmount = purchaseAmount;
        levelOneDoc = existing;
      } else {
        const created = await Referral.create([{
          referrerId: referredUser.referredBy,
          referredUserId,
          referralCode: referredUser.referralCode || '',
          status: REFERRAL_STATUSES.CONVERTED,
          level: 1,
          conversionType,
          conversionAmount: purchaseAmount
        }], { session });
        levelOneDoc = created[0];
      }
    }

    // ------------------------------------------------------------------
    // 2. Walk the upline chain and compute GAP commissions.
    // ------------------------------------------------------------------
    const allRanks = await Rank.find({ isActive: true }).select('name slug activationGain').lean();
    const rankById = new Map(allRanks.map((r) => [r._id.toString(), r]));
    const topMax = allRanks.reduce((max, r) => Math.max(max, r.activationGain || 0), 0);

    const payoutResults = [];
    let maxPaidSoFar = 0;
    let currentUserId = referredUser.referredBy;
    let chainLevel = 1;
    const now = new Date();
    const visited = new Set([referredUserId.toString()]);

    while (currentUserId && chainLevel <= MAX_CHAIN_DEPTH) {
      const currentIdStr = currentUserId.toString();
      if (visited.has(currentIdStr)) break;
      visited.add(currentIdStr);

      const referrer = await User.findById(currentUserId).select('_id referralCode referredBy').lean();
      if (!referrer) break;

      if (chainLevel > 1) {
        const existingIndirect = await Referral.findOne({ referrerId: currentUserId, referredUserId }).session(session);
        if (existingIndirect && existingIndirect.status !== REFERRAL_STATUSES.PENDING) {
          currentUserId = referrer.referredBy;
          chainLevel++;
          continue;
        }
      }

      const userRank = await UserRank.findOne({ userId: currentUserId }).select('currentRankId').session(session).lean();
      const rank = userRank && userRank.currentRankId
        ? rankById.get(userRank.currentRankId.toString())
        : null;
      const rankMax = rank ? (rank.activationGain || 0) : 0;

      let amount = 0;
      if (chainLevel === 1) {
        amount = maxPaidSoFar < topMax ? rankMax : 0;
        maxPaidSoFar = Math.max(maxPaidSoFar, amount);
      } else {
        amount = maxPaidSoFar < topMax ? Math.max(0, rankMax - maxPaidSoFar) : 0;
        maxPaidSoFar = Math.max(maxPaidSoFar, rankMax);
      }

      if (amount > 0) {
        const isDirect = chainLevel === 1;
        await creditWallet(currentUserId, {
          amount,
          category: isDirect ? 'direct_income' : 'indirect_income',
          description: isDirect
            ? `Activation earning from ${referredUser.firstName} ${referredUser.lastName}'s ${conversionType === 'subscription' ? 'membership activation' : conversionType}`
            : `GAP earning from ${referredUser.firstName} ${referredUser.lastName}'s ${conversionType === 'subscription' ? 'membership activation' : conversionType}`,
          referenceModel: 'Referral',
          referenceId: referredUserId,
          metadata: {
            referredName: `${referredUser.firstName} ${referredUser.lastName}`,
            purchaseAmount,
            level: chainLevel,
            conversionType,
            rankName: rank ? rank.name : null,
            rankSlug: rank ? rank.slug : null,
            maxCommission: rankMax,
            gapAmount: isDirect ? null : amount
          },
          session
        });
        payoutResults.push({ userId: currentUserId, level: chainLevel, amount });
      }

      if (chainLevel === 1) {
        levelOneDoc.commissionAmount = amount;
        levelOneDoc.commissionPaid = amount;
        levelOneDoc.commissionPaidAt = amount > 0 ? now : null;
        await levelOneDoc.save({ session });
      } else {
        await Referral.findOneAndUpdate(
          { referrerId: currentUserId, referredUserId },
          {
            $set: {
              status: REFERRAL_STATUSES.CONVERTED,
              commissionAmount: amount,
              commissionPaid: amount,
              commissionPaidAt: amount > 0 ? now : null,
              level: chainLevel,
              conversionType,
              conversionAmount: purchaseAmount
            },
            $setOnInsert: { referralCode: referrer.referralCode || '' }
          },
          { upsert: true, session, new: true }
        );
      }

      currentUserId = referrer.referredBy;
      chainLevel++;
    }

    return payoutResults;
  });

  // Post-commit work: notifications + rank promotion checks
  for (const r of results || []) {
    try {
      const user = await User.findById(r.userId).lean();
      if (user && r.amount > 0) await sendCommissionReceivedEmail(user, r.amount);
    } catch (e) { console.error('[EMAIL] sendCommissionReceivedEmail:', e.message); }

    try {
      await checkAndPromoteRank(r.userId);
    } catch (e) { console.error('[RANK] checkAndPromoteRank:', e.message); }
  }

  return results && results.length > 0 ? results : null;
};

const getReferralTree = async (userId) => {
  const allReferrals = await Referral.find({ referrerId: userId })
    .populate('referredUserId', 'firstName lastName email avatar createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const direct = allReferrals.filter(r => r.level === 1);
  const directReferralUserIds = direct.map(d => d.referredUserId._id ? d.referredUserId._id.toString() : d.referredUserId);
  const indirectSet = new Set();
  for (const directUserId of directReferralUserIds) {
    const childRefs = await Referral.find({ referrerId: directUserId }).lean();
    for (const childRef of childRefs) {
      indirectSet.add(childRef.referredUserId.toString());
    }
  }

  const indirect = allReferrals.filter(r => indirectSet.has(r.referredUserId._id ? r.referredUserId._id.toString() : r.referredUserId));

  const directCount = direct.length;
  const indirectCount = indirectSet.size;
  const totalCommission = allReferrals.reduce((sum, r) => sum + (r.commissionAmount || 0), 0);

  return {
    direct,
    indirect,
    stats: {
      totalDirect: directCount,
      totalIndirect: indirectCount,
      totalReferrals: directCount + indirectCount,
      totalCommission: Math.round(totalCommission * 100) / 100
    }
  };
};

const getReferralStats = async (userId) => {
  const referrals = await Referral.find({ referrerId: userId }).lean();

  const totalReferrals = referrals.length;
  const totalCommission = referrals.reduce((sum, r) => sum + (r.commissionAmount || 0), 0);
  const pendingCommission = referrals
    .filter((r) => r.status === REFERRAL_STATUSES.PENDING)
    .reduce((sum, r) => sum + (r.commissionAmount || 0), 0);

  return {
    totalReferrals,
    totalCommission: Math.round(totalCommission * 100) / 100,
    pendingCommission: Math.round(pendingCommission * 100) / 100
  };
};

module.exports = {
  generateReferralCode,
  processReferralCommission,
  getReferralTree,
  getReferralStats
};
