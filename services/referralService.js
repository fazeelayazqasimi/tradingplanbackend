const mongoose = require('mongoose');
const User = require('../models/User');
const Referral = require('../models/Referral');
const UserRank = require('../models/UserRank');
const Rank = require('../models/Rank');
const Setting = require('../models/Setting');
const { creditWallet } = require('./walletService');
const { sendCommissionReceivedEmail } = require('./emailService');
const { REFERRAL_STATUSES, REFERRAL_LEVELS } = require('../utils/constants');

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

const getRankBasedCommission = async (referrerId, level, purchaseAmount) => {
  const userRank = await UserRank.findOne({ userId: referrerId }).populate('currentRankId').lean();
  if (!userRank || !userRank.currentRankId) {
    const settingsFallback = await Setting.findOne({ key: `referral_level_${level}_commission` });
    return (settingsFallback && Number(settingsFallback.value)) || 0;
  }

  const rank = userRank.currentRankId;
  if (level === 1) {
    const activation = rank.activationGain || 0;
    const quantBonus = purchaseAmount * ((rank.quantification || 0) / 100);
    if (activation === 0 && quantBonus === 0) {
      const settingsFallback = await Setting.findOne({ key: `referral_level_${level}_commission` });
      return (settingsFallback && Number(settingsFallback.value)) || 0;
    }
    return activation + quantBonus;
  }

  const indirect = rank.indirectIncome || 0;
  if (indirect === 0) {
    const settingsFallback = await Setting.findOne({ key: `referral_level_${level}_commission` });
    return (settingsFallback && Number(settingsFallback.value)) || 0;
  }
  return indirect;
};

const getMaxReferralLevels = async () => {
  const setting = await Setting.findOne({ key: 'referral_max_levels' });
  return (setting && Number(setting.value)) || 5;
};

const processReferralCommission = async (referredUserId, purchaseAmount, conversionType = 'course') => {
  const referredUser = await User.findById(referredUserId).lean();
  if (!referredUser || !referredUser.referredBy) return null;

  const maxLevels = await getMaxReferralLevels();
  const results = [];
  let currentUserId = referredUser.referredBy;
  let chainLevel = 1;

  const visited = new Set();
  visited.add(referredUserId.toString());

  while (currentUserId && chainLevel <= maxLevels) {
    if (visited.has(currentUserId.toString())) break;
    visited.add(currentUserId.toString());

    const referrer = await User.findById(currentUserId).lean();
    if (!referrer) break;

    const commissionAmount = await getRankBasedCommission(currentUserId, chainLevel, purchaseAmount);
    if (commissionAmount <= 0) {
      const nextReferrer = referrer.referredBy;
      currentUserId = nextReferrer;
      chainLevel++;
      continue;
    }

    let result = null;
    try {
      result = await creditWallet(currentUserId, {
        amount: commissionAmount,
        category: chainLevel === 1 ? 'direct_income' : 'indirect_income',
        description: chainLevel === 1
          ? `Activation earning from ${referredUser.firstName} ${referredUser.lastName}'s course purchase`
          : `Indirect earning from ${referredUser.firstName} ${referredUser.lastName}'s course purchase`,
        referenceModel: 'Referral',
        referenceId: referredUserId,
        metadata: {
          referredName: `${referredUser.firstName} ${referredUser.lastName}`,
          purchaseAmount,
          level: chainLevel,
          conversionType
        }
      });
    } catch (_) {
      currentUserId = referrer.referredBy;
      chainLevel++;
      continue;
    }

    if (chainLevel === 1) {
      await Referral.findOneAndUpdate(
        { referredUserId },
        {
          $set: {
            status: REFERRAL_STATUSES.CONVERTED,
            commissionAmount,
            commissionPaid: commissionAmount,
            commissionPaidAt: new Date(),
            conversionType,
            conversionAmount: purchaseAmount
          }
        },
        { new: true }
      );
    } else {
      const existingIndirect = await Referral.findOne({
        referrerId: currentUserId,
        referredUserId
      });
      if (!existingIndirect) {
        await Referral.create({
          referrerId: currentUserId,
          referredUserId,
          referralCode: referrer.referralCode || '',
          status: REFERRAL_STATUSES.CONVERTED,
          commissionAmount,
          commissionPaid: commissionAmount,
          commissionPaidAt: new Date(),
          level: chainLevel,
          conversionType,
          conversionAmount: purchaseAmount
        });
      }
    }

    results.push({ userId: currentUserId, level: chainLevel, amount: commissionAmount });

    try {
      await sendCommissionReceivedEmail(referrer, commissionAmount);
    } catch (e) { console.error('[EMAIL] sendCommissionReceivedEmail:', e.message); }

    currentUserId = referrer.referredBy;
    chainLevel++;
  }

  return results.length > 0 ? results : null;
};

const getReferralTree = async (userId) => {
  const allReferrals = await Referral.find({ referrerId: userId })
    .populate('referredUserId', 'firstName lastName email avatar createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const direct = allReferrals.filter(r => r.level === 1);
  const indirect = allReferrals.filter(r => r.level > 1);

  const directCount = direct.length;
  const indirectCount = indirect.length;
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
