const MarketUpdate = require('../models/MarketUpdate');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getMarketUpdates = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = { isPublished: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.pinned !== undefined) filter.pinned = req.query.pinned === 'true';
    const total = await MarketUpdate.countDocuments(filter);
    const updates = await MarketUpdate.find(filter)
      .sort(sort || { pinned: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('authorId', 'firstName lastName')
      .lean();
    sendPaginated(res, updates, total, page, limit);
  } catch (error) { next(error); }
};

exports.getMarketUpdate = async (req, res, next) => {
  try {
    const update = await MarketUpdate.findById(req.params.id)
      .populate('authorId', 'firstName lastName')
      .lean();
    if (!update || !update.isPublished) return sendError(res, 'Not found', 404);
    sendSuccess(res, update);
  } catch (error) { next(error); }
};

exports.createMarketUpdate = async (req, res, next) => {
  try {
    const update = await MarketUpdate.create({ ...req.body, authorId: req.user._id });
    sendSuccess(res, update, 'Created', 201);
  } catch (error) { next(error); }
};

exports.updateMarketUpdate = async (req, res, next) => {
  try {
    const update = await MarketUpdate.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!update) return sendError(res, 'Not found', 404);
    sendSuccess(res, update, 'Updated');
  } catch (error) { next(error); }
};

exports.deleteMarketUpdate = async (req, res, next) => {
  try {
    await MarketUpdate.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Deleted');
  } catch (error) { next(error); }
};

exports.getStats = async (req, res, next) => {
  try {
    const total = await MarketUpdate.countDocuments();
    const published = await MarketUpdate.countDocuments({ isPublished: true });
    const byCategory = await MarketUpdate.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    sendSuccess(res, { total, published, byCategory });
  } catch (error) { next(error); }
};