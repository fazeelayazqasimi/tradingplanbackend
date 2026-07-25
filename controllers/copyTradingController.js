const CopyTrading = require('../models/CopyTrading');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getCopyTradingStats = async (req, res, next) => {
  try {
    const stats = await CopyTrading.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: null, totalTrades: { $sum: 1 }, totalProfit: { $sum: '$profit' }, openTrades: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } }, wins: { $sum: { $cond: [{ $gt: ['$profit', 0] }, 1, 0] } } } },
    ]);
    sendSuccess(res, stats[0] || { totalTrades: 0, totalProfit: 0, openTrades: 0, wins: 0 });
  } catch (error) { next(error); }
};

exports.getCopyTradingHistory = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const status = req.query.status;
    const symbol = req.query.symbol;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;
    if (symbol) filter.symbol = symbol;
    const total = await CopyTrading.countDocuments(filter);
    const trades = await CopyTrading.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    sendPaginated(res, trades, total, page, limit);
  } catch (error) { next(error); }
};

exports.distributeProfit = async (req, res, next) => {
  try {
    const { tradeId, totalProfit, brokerSharePercent, traderSharePercent } = req.body;
    const trade = await CopyTrading.findById(tradeId);
    if (!trade) return sendError(res, 'Trade not found', 404);
    const brokerAmount = totalProfit * (brokerSharePercent / 100);
    const traderAmount = totalProfit * (traderSharePercent / 100);
    const networkAmount = totalProfit - brokerAmount - traderAmount;
    trade.profit = totalProfit;
    trade.status = 'closed';
    trade.brokerShare = brokerAmount;
    trade.traderShare = traderAmount;
    trade.networkShare = networkAmount;
    trade.profitDistribution = { broker: brokerAmount, trader: traderAmount, network: networkAmount };
    await trade.save();
    sendSuccess(res, trade, 'Profit distributed');
  } catch (error) { next(error); }
};

exports.createCopyTrade = async (req, res, next) => {
  try {
    const trade = await CopyTrading.create({ ...req.body, userId: req.user._id });
    sendSuccess(res, trade, 'Copy trade recorded', 201);
  } catch (error) { next(error); }
};
