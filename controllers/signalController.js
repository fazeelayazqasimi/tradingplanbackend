const Signal = require('../models/Signal');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendSignalPublishedEmail, getEmailRecipients } = require('../services/emailService');
const { resolveSignal, checkOpenSignals, closeSignal: closeSignalService, markTpHit: markTpHitService } = require('../services/signalResultService');
const { getLiveQuote } = require('../services/liveRatesService');

const normalizeMultiLevels = (body) => {
  if (Array.isArray(body.openPrices) && body.openPrices.length > 0) {
    body.openPrice = parseFloat(body.openPrices[0]);
  }
  if (Array.isArray(body.takeProfits) && body.takeProfits.length > 0) {
    body.takeProfits = body.takeProfits.map((tp) => {
      const price = typeof tp === 'object' ? tp.price : tp;
      return { price: parseFloat(price), hit: tp && tp.hit ? true : false, hitAt: tp && tp.hitAt ? tp.hitAt : null };
    });
    body.takeProfit = body.takeProfits[0].price;
  }
  return body;
};

exports.getSignals = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const search = req.query.search;
    const status = req.query.status;
    const action = req.query.action;
    const symbol = req.query.symbol;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const filter = {};
    if (status) filter.status = status;
    if (action) filter.action = action;
    if (symbol) filter.symbol = { $regex: symbol, $options: 'i' };
    if (search) filter.description = { $regex: search, $options: 'i' };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'newest' || sort === '-createdAt') {
      sortOptions = { createdAt: -1 };
    } else if (sort === 'oldest' || sort === 'createdAt') {
      sortOptions = { createdAt: 1 };
    }
    const total = await Signal.countDocuments(filter);
    const signals = await Signal.find(filter).sort(sortOptions).skip((page - 1) * limit).limit(limit).populate('userId', 'firstName lastName avatar').select('title symbol action side volume openPrice takeProfits stopLoss currentPrice profit pips status result takeProfit openPrices description imageUrls isPublished');
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
    const signal = await Signal.create({ ...normalizeMultiLevels({ ...req.body }), userId: req.user._id });
    if (signal.isPublished) {
      try {
        const students = await getEmailRecipients();
        if (students.length > 0) {
          await sendSignalPublishedEmail(students, signal);
          const notifications = students.map(s => ({
            userId: s._id,
            type: 'signal',
            title: `New Signal: ${signal.symbol} ${signal.action}`,
            message: `${signal.action} ${signal.side} at ${signal.openPrice} on ${signal.symbol}`,
            link: '/student/signals',
            relatedId: signal._id,
          }));
          await Notification.insertMany(notifications);
        }
      } catch (e) { console.error('[PUBLISH] Signal notification error:', e.message); }
    }
    sendSuccess(res, signal, 'Signal created', 201);
  } catch (error) {
    next(error);
  }
};

exports.updateSignal = async (req, res, next) => {
  try {
    const existing = await Signal.findById(req.params.id);
    if (!existing) return sendError(res, 'Signal not found', 404);
    const wasPublished = existing.isPublished;
    Object.assign(existing, normalizeMultiLevels({ ...req.body }));
    await existing.save();
    if (req.body.isPublished === true && !wasPublished) {
      try {
        const students = await getEmailRecipients();
        if (students.length > 0) {
          await sendSignalPublishedEmail(students, existing);
          const notifications = students.map(s => ({
            userId: s._id,
            type: 'signal',
            title: `New Signal: ${existing.symbol} ${existing.action}`,
            message: `${existing.action} ${existing.side} at ${existing.openPrice} on ${existing.symbol}`,
            link: '/student/signals',
            relatedId: existing._id,
          }));
          await Notification.insertMany(notifications);
        }
      } catch (e) { console.error('[PUBLISH] Signal notification error:', e.message); }
    }
    sendSuccess(res, existing, 'Signal updated');
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

exports.hitTakeProfit = async (req, res, next) => {
  try {
    const price = req.body.price != null ? Number(req.body.price) : await getLiveQuote(req.body.symbol || '');
    const tpIndex = req.body.tpIndex != null ? Number(req.body.tpIndex) : null;
    const result = await resolveSignal(req.params.id, 'tp', price, { tpIndex });
    if (!result.resolved) return sendError(res, result.reason || 'Unable to resolve signal', 400);
    const msg = result.tpLabel
      ? `${result.tpLabel} hit! Email sent to all students`
      : 'Target achieved! TP hit email sent to all students';
    sendSuccess(res, result.signal, msg);
  } catch (error) {
    next(error);
  }
};

exports.hitStopLoss = async (req, res, next) => {
  try {
    const price = req.body.price != null ? Number(req.body.price) : await getLiveQuote(req.body.symbol || '');
    const result = await resolveSignal(req.params.id, 'sl', price);
    if (!result.resolved) return sendError(res, result.reason || 'Unable to resolve signal', 400);
    sendSuccess(res, result.signal, 'Stop loss hit. Motivational email sent to all students');
  } catch (error) {
    next(error);
  }
};

exports.closeSignal = async (req, res, next) => {
  try {
    const signal = await Signal.findById(req.params.id);
    if (!signal) return sendError(res, 'Signal not found', 404);

    const price = req.body.price != null ? Number(req.body.price) : await getLiveQuote(signal.symbol);
    const result = await closeSignalService(req.params.id, price, { closeReason: req.body.closeReason });
    if (!result.closed) return sendError(res, result.reason || 'Unable to close signal', 400);
    sendSuccess(res, result.signal, 'Signal closed. Email sent to all students');
  } catch (error) {
    next(error);
  }
};

exports.markTpHit = async (req, res, next) => {
  try {
    const level = req.body.level != null ? parseInt(req.body.level, 10) : null;
    if (level == null || !Number.isInteger(level) || level < 1) {
      return sendError(res, 'A valid level (>= 1) is required. e.g. { "level": 4 }', 400);
    }
    const price = req.body.price != null ? Number(req.body.price) : null;
    const result = await markTpHitService(req.params.id, level, price);
    if (!result.resolved) return sendError(res, result.reason || 'Unable to mark TP hit', 400);
    const msg = `TP ${result.level} hit! TPs 1–${result.level} marked and one email sent to all students`;
    sendSuccess(res, result.signal, msg);
  } catch (error) {
    next(error);
  }
};

exports.runResultCheck = async (req, res, next) => {
  try {
    const resolved = await checkOpenSignals();
    sendSuccess(res, resolved, `Auto-check complete: ${resolved.length} signal(s) resolved`);
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
