const MarketOverview = require('../models/MarketOverview');
const { sendSuccess, sendError } = require('../helpers/response');

exports.getMarketOverview = async (req, res, next) => {
  try {
    const data = await MarketOverview.getOrCreate();
    sendSuccess(res, data, 'Market overview fetched successfully');
  } catch (error) { next(error); }
};

exports.updateMarketOverview = async (req, res, next) => {
  try {
    const { goldTrend, marketNews, nextLiveClassDate, nextLiveClassTime, nextLiveClassLink, dailyMarketSummary } = req.body;
    let data = await MarketOverview.getOrCreate();
    if (goldTrend !== undefined) data.goldTrend = goldTrend;
    if (marketNews !== undefined) data.marketNews = marketNews;
    if (nextLiveClassDate !== undefined) data.nextLiveClassDate = nextLiveClassDate;
    if (nextLiveClassTime !== undefined) data.nextLiveClassTime = nextLiveClassTime;
    if (nextLiveClassLink !== undefined) data.nextLiveClassLink = nextLiveClassLink;
    if (dailyMarketSummary !== undefined) data.dailyMarketSummary = dailyMarketSummary;
    data.updatedBy = req.user._id;
    await data.save();
    sendSuccess(res, data, 'Market overview updated successfully');
  } catch (error) { next(error); }
};
