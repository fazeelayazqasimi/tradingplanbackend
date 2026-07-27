const Signal = require('../models/Signal');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendSignalPublishedEmail } = require('../services/emailService');

exports.getSignals = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const search = req.query.search;
    const status = req.query.status;
    const action = req.query.action;
    const symbol = req.query.symbol;
    const filter = {};
    if (req.user?.role !== 'admin') filter.isPublished = true;
    if (status) filter.status = status;
    if (action) filter.action = action;
    if (symbol) filter.symbol = { $regex: symbol, $options: 'i' };
    if (search) filter.description = { $regex: search, $options: 'i' };

    const total = await Signal.countDocuments(filter);
    const signals = await Signal.find(filter).sort(sort || { createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'firstName lastName avatar');
    sendPaginated(res, signals, total, page, limit);
  } catch (error) {
    next(error);
  }
};

exports.getSignal = async (req, res, next) => {
  try {
    const signal = await Signal.findById(req.params.id).populate('userId', 'firstName lastName avatar');
    if (!signal) return sendError(res, 'Signal not found', 404);
    sendSuccess(res, signal);
  } catch (error) {
    next(error);
  }
};

exports.createSignal = async (req, res, next) => {
  try {
    const signal = await Signal.create({ ...req.body, userId: req.user._id });
    if (signal.isPublished) {
      try {
        const students = await User.find({ role: 'student', isActive: true }).select('email firstName');
        if (students.length > 0) sendSignalPublishedEmail(students, signal);
      } catch (e) { console.error('[EMAIL] sendSignalPublishedEmail:', e.message); }
    }
    sendSuccess(res, signal, 'Signal created', 201);
  } catch (error) {
    next(error);
  }
};

exports.updateSignal = async (req, res, next) => {
  try {
    const signal = await Signal.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!signal) return sendError(res, 'Signal not found', 404);
    if (req.body.isPublished && !signal.isPublished) {
      try {
        const students = await User.find({ role: 'student', isActive: true }).select('email firstName');
        if (students.length > 0) sendSignalPublishedEmail(students, signal);
      } catch (e) { console.error('[EMAIL] sendSignalPublishedEmail:', e.message); }
    }
    sendSuccess(res, signal, 'Signal updated');
  } catch (error) {
    next(error);
  }
};

exports.deleteSignal = async (req, res, next) => {
  try {
    const signal = await Signal.findByIdAndDelete(req.params.id);
    if (!signal) return sendError(res, 'Signal not found', 404);
    sendSuccess(res, null, 'Signal deleted');
  } catch (error) {
    next(error);
  }
};

exports.getSignalStats = async (req, res, next) => {
  try {
    const stats = await Signal.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: null, total: { $sum: 1 }, wins: { $sum: { $cond: [{ $gt: ['$profit', 0] }, 1, 0] } }, totalProfit: { $sum: '$profit' }, avgPips: { $avg: '$pips' } } },
    ]);
    sendSuccess(res, stats[0] || { total: 0, wins: 0, totalProfit: 0, avgPips: 0 });
  } catch (error) {
    next(error);
  }
};
