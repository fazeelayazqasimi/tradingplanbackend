const mongoose = require('mongoose');
const CopyTrading = require('../models/CopyTrading');
const User = require('../models/User');
const UserRank = require('../models/UserRank');
const Referral = require('../models/Referral');
const Setting = require('../models/Setting');
const { creditWallet } = require('./walletService');
const ActivityLog = require('../models/ActivityLog');

const getProfitDistributionSettings = async () => {
  const brokerShare = await Setting.getByKey('copy_broker_share_percent', 30);
  const traderShare = await Setting.getByKey('copy_trader_share_percent', 40);
  const networkShare = await Setting.getByKey('copy_network_share_percent', 20);
  const platformShare = await Setting.getByKey('copy_platform_share_percent', 10);
  return { brokerShare, traderShare, networkShare, platformShare };
};

const processProfitDistribution = async (tradeId, totalProfit) => {
  if (!totalProfit || totalProfit <= 0) {
    return { distributed: false, reason: 'No profit to distribute' };
  }

  const trade = await CopyTrading.findById(tradeId)
    .populate('userId', 'firstName lastName email referredBy')
    .lean();

  if (!trade) throw new Error('Trade not found');
  if (trade.status !== 'closed') throw new Error('Trade must be closed before distributing profit');

  const settings = await getProfitDistributionSettings();

  const brokerAmount = Math.round((totalProfit * settings.brokerShare / 100) * 100) / 100;
  const traderAmount = Math.round((totalProfit * settings.traderShare / 100) * 100) / 100;
  const networkAmount = Math.round((totalProfit * settings.networkShare / 100) * 100) / 100;
  const platformAmount = Math.round((totalProfit - brokerAmount - traderAmount - networkAmount) * 100) / 100;

  const tradeDoc = await CopyTrading.findById(tradeId);
  tradeDoc.profit = totalProfit;
  tradeDoc.profitDistribution = {
    brokerShare: brokerAmount,
    traderShare: traderAmount,
    networkShare: networkAmount,
    platformShare: platformAmount
  };
  await tradeDoc.save();

  if (networkAmount > 0 && trade.userId) {
    await calculateNetworkShare(trade.userId._id || trade.userId, networkAmount);
  }

  try {
    await ActivityLog.logActivity({
      userId: trade.userId._id || trade.userId,
      action: 'profit_distribution',
      entity: 'CopyTrading',
      entityId: tradeId,
      changes: {
        totalProfit,
        brokerAmount,
        traderAmount,
        networkAmount,
        platformAmount
      },
      status: 'success'
    });
  } catch (_) {}

  return {
    distributed: true,
    distribution: {
      broker: brokerAmount,
      trader: traderAmount,
      network: networkAmount,
      platform: platformAmount,
      total: totalProfit
    }
  };
};

const calculateNetworkShare = async (userId, networkAmount) => {
  if (networkAmount <= 0) return [];

  const referralChain = [];
  let currentUserId = userId;
  const visited = new Set();

  while (currentUserId) {
    if (visited.has(currentUserId.toString())) break;
    visited.add(currentUserId.toString());

    const user = await User.findById(currentUserId).lean();
    if (!user || !user.referredBy) break;

    const referrerId = user.referredBy;
    referralChain.push(referrerId);
    currentUserId = referrerId;
  }

  if (referralChain.length === 0) return [];

  const distributions = [];
  let remainingAmount = networkAmount;

  for (let i = 0; i < referralChain.length && remainingAmount > 0; i++) {
    const referrerId = referralChain[i];
    const level = i + 1;

    const referrerRankData = await UserRank.findOne({ userId: referrerId })
      .populate('currentRankId')
      .lean();

    const profitSharePercent = referrerRankData && referrerRankData.currentRankId
      ? referrerRankData.currentRankId.quantification || 0
      : 0;

    const shareRatio = profitSharePercent / 100;
    const shareAmount = Math.round(Math.min(remainingAmount, networkAmount * shareRatio) * 100) / 100;

    if (shareAmount > 0) {
      try {
        await creditWallet(referrerId, {
          amount: shareAmount,
          category: 'trading_profit',
          description: `Network share from copy trading profit (Level ${level})`,
          referenceModel: 'CopyTrading'
        });

        distributions.push({
          userId: referrerId,
          level,
          amount: shareAmount,
          profitSharePercent
        });
      } catch (_) {}
    }
  }

  if (distributions.length === 0 && referralChain.length > 0) {
    const equalShare = Math.round((networkAmount / referralChain.length) * 100) / 100;

    for (let i = 0; i < referralChain.length; i++) {
      try {
        await creditWallet(referralChain[i], {
          amount: equalShare,
          category: 'trading_profit',
          description: `Network share from copy trading profit (Level ${i + 1})`,
          referenceModel: 'CopyTrading'
        });

        distributions.push({
          userId: referralChain[i],
          level: i + 1,
          amount: equalShare,
          profitSharePercent: 0
        });
      } catch (_) {}
    }
  }

  return distributions;
};

const getCopyTradingStats = async (userId) => {
  const stats = await CopyTrading.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        openTrades: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        closedTrades: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
        totalProfit: { $sum: '$profit' },
        winningTrades: { $sum: { $cond: [{ $gt: ['$profit', 0] }, 1, 0] } },
        losingTrades: { $sum: { $cond: [{ $lt: ['$profit', 0] }, 1, 0] } },
        totalVolume: { $sum: '$volume' },
        avgProfit: { $avg: '$profit' },
        maxProfit: { $max: '$profit' },
        maxLoss: { $min: '$profit' },
        totalPips: { $sum: '$pips' }
      }
    }
  ]);

  const result = stats[0] || {
    totalTrades: 0,
    openTrades: 0,
    closedTrades: 0,
    totalProfit: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalVolume: 0,
    avgProfit: 0,
    maxProfit: 0,
    maxLoss: 0,
    totalPips: 0
  };

  result.winRate = result.closedTrades > 0
    ? Math.round((result.winningTrades / result.closedTrades) * 10000) / 100
    : 0;

  result.totalProfit = Math.round((result.totalProfit || 0) * 100) / 100;
  result.avgProfit = Math.round((result.avgProfit || 0) * 100) / 100;
  result.maxProfit = Math.round((result.maxProfit || 0) * 100) / 100;
  result.maxLoss = Math.round((result.maxLoss || 0) * 100) / 100;
  result.totalPips = Math.round((result.totalPips || 0) * 100) / 100;

  delete result._id;

  const symbolBreakdown = await CopyTrading.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'closed' } },
    {
      $group: {
        _id: '$symbol',
        trades: { $sum: 1 },
        totalProfit: { $sum: '$profit' },
        wins: { $sum: { $cond: [{ $gt: ['$profit', 0] }, 1, 0] } }
      }
    },
    { $sort: { totalProfit: -1 } }
  ]);

  result.symbolBreakdown = symbolBreakdown.map((s) => ({
    symbol: s._id,
    trades: s.trades,
    totalProfit: Math.round(s.totalProfit * 100) / 100,
    winRate: s.trades > 0 ? Math.round((s.wins / s.trades) * 10000) / 100 : 0
  }));

  return result;
};

const getMasterStats = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const masterAccountId = user.mt4Connection?.accountId || user.mt5Connection?.accountId;

  const masterTrades = await CopyTrading.aggregate([
    ...(masterAccountId ? [{ $match: { masterAccountId } }] : [{ $match: { userId: new mongoose.Types.ObjectId(userId) } }]),
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        openTrades: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        closedTrades: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
        totalProfit: { $sum: '$profit' },
        totalVolume: { $sum: '$volume' },
        winningTrades: { $sum: { $cond: [{ $gt: ['$profit', 0] }, 1, 0] } },
        losingTrades: { $sum: { $cond: [{ $lt: ['$profit', 0] }, 1, 0] } },
        avgProfit: { $avg: '$profit' },
        totalPips: { $sum: '$pips' }
      }
    }
  ]);

  const followers = masterAccountId
    ? await CopyTrading.distinct('userId', { masterAccountId }).then((ids) => ids.length)
    : 0;

  const result = masterTrades[0] || {
    totalTrades: 0,
    openTrades: 0,
    closedTrades: 0,
    totalProfit: 0,
    totalVolume: 0,
    winningTrades: 0,
    losingTrades: 0,
    avgProfit: 0,
    totalPips: 0
  };

  result.winRate = result.closedTrades > 0
    ? Math.round((result.winningTrades / result.closedTrades) * 10000) / 100
    : 0;

  result.totalProfit = Math.round((result.totalProfit || 0) * 100) / 100;
  result.avgProfit = Math.round((result.avgProfit || 0) * 100) / 100;
  result.totalPips = Math.round((result.totalPips || 0) * 100) / 100;
  result.followers = followers;

  delete result._id;

  return result;
};

module.exports = {
  processProfitDistribution,
  calculateNetworkShare,
  getCopyTradingStats,
  getMasterStats
};
