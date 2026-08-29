const Signal = require('../models/Signal');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getLiveQuotes, normalizeSymbol, getPipSize } = require('./liveRatesService');
const { sendSignalTPHitEmail, sendSignalSLHitEmail, sendSignalClosedEmail } = require('./emailService');

const getTpLabel = (signal, tpIndex) => {
  if (!signal.takeProfits || signal.takeProfits.length === 0) return null;
  return `TP ${tpIndex + 1}`;
};

const notifyStudents = async (signal, outcome, tpIndex = null) => {
  try {
    const students = await User.find({ role: 'student', isActive: true }).select('email firstName _id');
    if (students.length === 0) return;

    const isTP = outcome === 'tp';
    const tpLabel = isTP ? getTpLabel(signal, tpIndex) : null;
    const hitPrice = isTP
      ? (signal.takeProfits && signal.takeProfits[tpIndex]?.price) || signal.takeProfit
      : signal.stopLoss;
    const title = isTP
      ? `${tpLabel ? `🎯 ${tpLabel} Hit` : '🎯 Target Hit'}: ${signal.symbol} ${signal.action}`
      : `🛑 Stop Loss Hit: ${signal.symbol} ${signal.action}`;
    const message = isTP
      ? `Congratulations! ${tpLabel ? `${tpLabel} achieved` : 'Target achieved'} on ${signal.symbol} at ${hitPrice}. Great trading!`
      : `Stop loss triggered on ${signal.symbol} at ${signal.stopLoss}. Don't worry — losses are part of trading. Stay disciplined!`;

    if (isTP) sendSignalTPHitEmail(students, signal, tpIndex);
    else sendSignalSLHitEmail(students, signal);

    const notifications = students.map((s) => ({
      userId: s._id,
      type: 'signal',
      title,
      message,
      link: '/student/signals',
      relatedId: signal._id,
    }));
    await Notification.insertMany(notifications);
  } catch (e) {
    console.error(`[SIGNAL RESULT] Notification/email error:`, e.message);
  }
};

const computeTpResult = (signal, tpPrice) => {
  const isLong = (signal.action.startsWith('BUY') && signal.side !== 'SHORT') || signal.side === 'LONG';
  return isLong
    ? (tpPrice - signal.openPrice)
    : (signal.openPrice - tpPrice);
};

const computeResult = (signal, outcome, tpIndex = null) => {
  if (outcome === 'tp') {
    const tpPrice = (signal.takeProfits && signal.takeProfits[tpIndex]?.price) || signal.takeProfit;
    return computeTpResult(signal, tpPrice);
  }
  const isLong = (signal.action.startsWith('BUY') && signal.side !== 'SHORT') || signal.side === 'LONG';
  return isLong
    ? (signal.stopLoss - signal.openPrice)
    : (signal.openPrice - signal.stopLoss);
};

/**
 * Resolve a signal as TP or SL hit. Idempotent — a signal already resolved
 * (status closed / result set) is left untouched.
 * With multiple take profits, each TP is marked hit individually and the
 * signal only closes once every TP is hit (or SL is hit).
 */
const resolveSignal = async (signalId, outcome, price, options = {}) => {
  const { sendEmail = true, tpIndex = null } = options;
  const signal = await Signal.findById(signalId);
  if (!signal) return { resolved: false, reason: 'Signal not found' };
  if (signal.status === 'closed' || signal.result) {
    return { resolved: false, reason: 'Signal already resolved', signal };
  }
  if (outcome !== 'tp' && outcome !== 'sl') return { resolved: false, reason: 'Invalid outcome' };

  const isTP = outcome === 'tp';
  const hasMultiTp = Array.isArray(signal.takeProfits) && signal.takeProfits.length > 0;

  if (isTP && hasMultiTp) {
    if (tpIndex == null) return { resolved: false, reason: 'TP index is required for multi-TP signals' };
    const tp = signal.takeProfits[tpIndex];
    if (!tp) return { resolved: false, reason: `Invalid TP index: ${tpIndex}` };
    if (tp.hit) return { resolved: false, reason: `TP ${tpIndex + 1} already marked hit`, signal };

    tp.hit = true;
    tp.hitAt = new Date();

    const profit = computeTpResult(signal, tp.price);
    const pipSize = getPipSize(signal.symbol);
    signal.profit = Number(profit.toFixed(2));
    signal.pips = Number((profit / pipSize).toFixed(1));
    signal.currentPrice = price != null ? Number(price) : tp.price;
    signal.lastCheckedPrice = price != null ? Number(price) : tp.price;
    signal.lastCheckedAt = new Date();
    signal.tpHitAt = new Date();

    const allHit = signal.takeProfits.every((t) => t.hit);
    if (allHit) {
      signal.status = 'closed';
      signal.result = 'tp';
      signal.closeTime = new Date();
    }

    await signal.save();

    if (sendEmail) {
      notifyStudents(signal, 'tp', tpIndex);
    }

    return { resolved: true, outcome: 'tp', tpIndex, tpLabel: `TP ${tpIndex + 1}`, signal };
  }

  const level = isTP ? signal.takeProfit : signal.stopLoss;
  if (!level) return { resolved: false, reason: `Signal has no ${isTP ? 'take profit' : 'stop loss'} level` };

  const profit = computeResult(signal, outcome);
  const pipSize = getPipSize(signal.symbol);

  signal.status = 'closed';
  signal.result = outcome;
  signal.profit = Number(profit.toFixed(2));
  signal.pips = Number((profit / pipSize).toFixed(1));
  signal.currentPrice = price != null ? Number(price) : level;
  signal.lastCheckedPrice = price != null ? Number(price) : level;
  signal.lastCheckedAt = new Date();
  signal.closeTime = new Date();
  if (isTP) signal.tpHitAt = new Date();
  else signal.slHitAt = new Date();
  await signal.save();

  if (sendEmail) {
    notifyStudents(signal, outcome, tpIndex);
  }

  return { resolved: true, outcome, signal };
};

const notifySignalClosed = async (signal, closePrice) => {
  try {
    const students = await User.find({ role: 'student', isActive: true }).select('email firstName _id');
    if (students.length === 0) return;

    sendSignalClosedEmail(students, signal, closePrice);

    const title = `Signal Closed: ${signal.symbol} ${signal.action}`;
    const message = `The ${signal.symbol} signal has been closed${closePrice != null ? ` at ${closePrice}` : ''}. Review the outcome and stay disciplined!`;

    const notifications = students.map((s) => ({
      userId: s._id,
      type: 'signal',
      title,
      message,
      link: '/student/signals',
      relatedId: signal._id,
    }));
    await Notification.insertMany(notifications);
  } catch (e) {
    console.error('[SIGNAL RESULT] Close notification/email error:', e.message);
  }
};

/**
 * Mark a take-profit level (TPn) as hit and, per the client spec, ALSO mark
 * every earlier TP (TP1..TPn-1) as hit so they all turn green on the user's
 * dashboard. Sends exactly ONE broadcast email to all students notifying them
 * which TPs were hit. The signal only closes once every TP is hit (or SL hit).
 */
const markTpHit = async (signalId, level, price, options = {}) => {
  const { sendEmail = true } = options;
  const signal = await Signal.findById(signalId);
  if (!signal) return { resolved: false, reason: 'Signal not found' };
  if (signal.status === 'closed' || signal.result) {
    return { resolved: false, reason: 'Signal already resolved', signal };
  }

  const hasMultiTp = Array.isArray(signal.takeProfits) && signal.takeProfits.length > 0;

  // Single-TP signals: fall back to the standard single resolution.
  if (!hasMultiTp) {
    return resolveSignal(signalId, 'tp', price, { sendEmail, tpIndex: 0 });
  }

  if (!Number.isInteger(level) || level < 1) {
    return { resolved: false, reason: 'A valid level (>= 1) is required' };
  }

  const max = Math.min(level, signal.takeProfits.length);
  let changed = false;
  for (let i = 0; i < max; i += 1) {
    if (!signal.takeProfits[i].hit) {
      signal.takeProfits[i].hit = true;
      signal.takeProfits[i].hitAt = new Date();
      changed = true;
    }
  }

  if (!changed) {
    return { resolved: false, reason: `TPs up to level ${level} already marked hit`, signal };
  }

  const tpPrice = signal.takeProfits[max - 1].price;
  const profit = computeTpResult(signal, tpPrice);
  const pipSize = getPipSize(signal.symbol);
  signal.profit = Number(profit.toFixed(2));
  signal.pips = Number((profit / pipSize).toFixed(1));
  signal.currentPrice = price != null ? Number(price) : tpPrice;
  signal.lastCheckedPrice = price != null ? Number(price) : tpPrice;
  signal.lastCheckedAt = new Date();
  signal.tpHitAt = new Date();

  const allHit = signal.takeProfits.every((t) => t.hit);
  if (allHit) {
    signal.status = 'closed';
    signal.result = 'tp';
    signal.closeTime = new Date();
  }

  await signal.save();

  if (sendEmail) {
    notifyStudents(signal, 'tp', max - 1);
  }

  return { resolved: true, outcome: 'tp', tpIndex: max - 1, tpLabel: `TP ${max}`, level, signal };
};

/**
 * Manually close an open signal (admin action). Idempotent — a signal
 * already closed is left untouched. Stores the admin's closeReason and emails
 * all students explaining why the trade was closed.
 */
const closeSignal = async (signalId, price, options = {}) => {
  const { sendEmail = true, closeReason = '' } = options;
  const signal = await Signal.findById(signalId);
  if (!signal) return { closed: false, reason: 'Signal not found' };
  if (signal.status === 'closed') return { closed: false, reason: 'Signal already closed', signal };

  const isLong = (signal.action.startsWith('BUY') && signal.side !== 'SHORT') || signal.side === 'LONG';
  const closePrice = price != null ? Number(price) : (signal.currentPrice ?? signal.openPrice);
  const profit = isLong ? (closePrice - signal.openPrice) : (signal.openPrice - closePrice);
  const pipSize = getPipSize(signal.symbol);

  signal.status = 'closed';
  signal.closeTime = new Date();
  signal.currentPrice = closePrice;
  signal.lastCheckedPrice = closePrice;
  signal.lastCheckedAt = new Date();
  signal.profit = Number(profit.toFixed(2));
  signal.pips = Number((profit / pipSize).toFixed(1));
  signal.closeReason = closeReason ? String(closeReason).trim() : signal.closeReason || '';
  await signal.save();

  if (sendEmail) {
    notifySignalClosed(signal, closePrice);
  }

  return { closed: true, signal };
};

/**
 * Auto-scan all open published signals with TP/SL levels against live rates.
 * Called periodically (server.js) — one batched API call per run.
 */
const checkOpenSignals = async () => {
  try {
    const signals = await Signal.find({
      isPublished: true,
      status: { $in: ['open', 'pending'] },
      $or: [
        { takeProfit: { $ne: null } },
        { 'takeProfits.0': { $exists: true } },
        { stopLoss: { $ne: null } },
      ],
    }).select('symbol action side openPrice stopLoss takeProfit takeProfits');
    if (signals.length === 0) return [];

    const symbols = [...new Set(signals.map((s) => s.symbol))];
    const quotes = await getLiveQuotes(symbols);

    const resolved = [];
    for (const signal of signals) {
      const normalized = normalizeSymbol(signal.symbol);
      const q = quotes[normalized];
      if (!q || q.close === undefined) continue;
      const price = Number(q.close);

      await Signal.updateOne(
        { _id: signal._id, status: { $in: ['open', 'pending'] } },
        { $set: { lastCheckedPrice: price, lastCheckedAt: new Date(), currentPrice: price } }
      );

      const isLong = (signal.action.startsWith('BUY') && signal.side !== 'SHORT') || signal.side === 'LONG';
      let outcome = null;
      let tpIndex = null;

      const hasMultiTp = Array.isArray(signal.takeProfits) && signal.takeProfits.length > 0;
      if (hasMultiTp) {
        for (let i = 0; i < signal.takeProfits.length; i++) {
          const tp = signal.takeProfits[i];
          if (tp.hit) continue;
          if (isLong ? price >= tp.price : price <= tp.price) {
            outcome = 'tp';
            tpIndex = i;
            break;
          }
        }
      } else if (signal.takeProfit != null && (isLong ? price >= signal.takeProfit : price <= signal.takeProfit)) {
        outcome = 'tp';
      }

      if (!outcome && signal.stopLoss != null && (isLong ? price <= signal.stopLoss : price >= signal.stopLoss)) {
        outcome = 'sl';
      }

      if (outcome) {
        const result = await resolveSignal(signal._id, outcome, price, { tpIndex });
        if (result.resolved) {
          resolved.push({ signalId: signal._id, symbol: signal.symbol, outcome, price, tpIndex });
          console.log(`[SIGNAL RESULT] ${signal.symbol} ${signal.action} -> ${outcome.toUpperCase()}${tpIndex != null ? ` (TP ${tpIndex + 1})` : ''} hit at ${price}`);
        }
      }
    }
    return resolved;
  } catch (e) {
    console.error('[SIGNAL RESULT] Auto-check error:', e.message);
    return [];
  }
};

module.exports = { resolveSignal, checkOpenSignals, closeSignal, markTpHit };
