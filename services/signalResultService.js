const Signal = require('../models/Signal');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getLiveQuotes, normalizeSymbol, getPipSize } = require('./liveRatesService');
const { sendSignalTPHitEmail, sendSignalSLHitEmail } = require('./emailService');

const notifyStudents = async (signal, outcome) => {
  try {
    const students = await User.find({ role: 'student', isActive: true }).select('email firstName _id');
    if (students.length === 0) return;

    const isTP = outcome === 'tp';
    const title = isTP
      ? `🎯 Target Hit: ${signal.symbol} ${signal.action}`
      : `🛑 Stop Loss Hit: ${signal.symbol} ${signal.action}`;
    const message = isTP
      ? `Congratulations! Target achieved on ${signal.symbol} at ${signal.takeProfit}. Great trading!`
      : `Stop loss triggered on ${signal.symbol} at ${signal.stopLoss}. Don't worry — losses are part of trading. Stay disciplined!`;

    if (isTP) sendSignalTPHitEmail(students, signal);
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

const computeResult = (signal, outcome) => {
  const isLong = (signal.action === 'BUY' && signal.side !== 'SHORT') || signal.side === 'LONG';
  if (outcome === 'tp') {
    return isLong
      ? (signal.takeProfit - signal.openPrice)
      : (signal.openPrice - signal.takeProfit);
  }
  return isLong
    ? (signal.stopLoss - signal.openPrice)
    : (signal.openPrice - signal.stopLoss);
};

/**
 * Resolve a signal as TP or SL hit. Idempotent — a signal already resolved
 * (status closed / result set) is left untouched.
 */
const resolveSignal = async (signalId, outcome, price, { sendEmail = true } = {}) => {
  const signal = await Signal.findById(signalId);
  if (!signal) return { resolved: false, reason: 'Signal not found' };
  if (signal.status === 'closed' || signal.result) {
    return { resolved: false, reason: 'Signal already resolved', signal };
  }
  if (outcome !== 'tp' && outcome !== 'sl') return { resolved: false, reason: 'Invalid outcome' };

  const isTP = outcome === 'tp';
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
    notifyStudents(signal, outcome);
  }

  return { resolved: true, outcome, signal };
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
      takeProfit: { $ne: null },
      stopLoss: { $ne: null },
    }).select('symbol action side openPrice stopLoss takeProfit');
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

      const isLong = (signal.action === 'BUY' && signal.side !== 'SHORT') || signal.side === 'LONG';
      let outcome = null;
      if (signal.takeProfit != null && (isLong ? price >= signal.takeProfit : price <= signal.takeProfit)) {
        outcome = 'tp';
      } else if (signal.stopLoss != null && (isLong ? price <= signal.stopLoss : price >= signal.stopLoss)) {
        outcome = 'sl';
      }
      if (outcome) {
        const result = await resolveSignal(signal._id, outcome, price);
        if (result.resolved) {
          resolved.push({ signalId: signal._id, symbol: signal.symbol, outcome, price });
          console.log(`[SIGNAL RESULT] ${signal.symbol} ${signal.action} -> ${outcome.toUpperCase()} hit at ${price}`);
        }
      }
    }
    return resolved;
  } catch (e) {
    console.error('[SIGNAL RESULT] Auto-check error:', e.message);
    return [];
  }
};

module.exports = { resolveSignal, checkOpenSignals };
