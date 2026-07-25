const router = require('express').Router();
const { sendSuccess, sendError } = require('../helpers/response');

const FALLBACK_RATES = {
  'EUR/USD': { bid: '1.08415', ask: '1.08418', change: '+0.12%' },
  'GBP/USD': { bid: '1.26502', ask: '1.26507', change: '-0.08%' },
  'USD/JPY': { bid: '151.802', ask: '151.806', change: '+0.25%' },
  'USD/CHF': { bid: '0.88201', ask: '0.88205', change: '-0.03%' },
  'AUD/USD': { bid: '0.65204', ask: '0.65208', change: '+0.18%' },
  'NZD/USD': { bid: '0.59502', ask: '0.59506', change: '+0.05%' },
  'USD/CAD': { bid: '1.36001', ask: '1.36005', change: '-0.10%' },
  'XAU/USD': { bid: '2394.10', ask: '2394.50', change: '+0.35%' },
};

router.get('/forex-rates', async (req, res, next) => {
  try {
    const pairs = req.query.pairs || 'EUR/USD,GBP/USD,USD/JPY,XAU/USD';
    const result = {};
    pairs.split(',').forEach(p => {
      const pair = p.trim().toUpperCase();
      const rate = FALLBACK_RATES[pair];
      if (rate) result[pair] = { ...rate, lastUpdated: new Date().toISOString() };
    });
    sendSuccess(res, Object.keys(result).length ? result : FALLBACK_RATES);
  } catch (error) { next(error); }
});

router.get('/gold-price', async (req, res, next) => {
  try {
    const base = 2385 + Math.random() * 20;
    const prev = base - (Math.random() - 0.5) * 5;
    const change = ((base - prev) / prev * 100);
    sendSuccess(res, {
      price: base.toFixed(2),
      high: (base + Math.random() * 10).toFixed(2),
      low: (base - Math.random() * 10).toFixed(2),
      change: (change >= 0 ? '+' : '') + change.toFixed(2) + '%',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) { next(error); }
});

router.get('/economic-events', async (req, res, next) => {
  try {
    const events = [
      { time: '2026-07-15 14:30', event: 'CPI (YoY)', impact: 'High', prev: '3.4%', forecast: '3.3%' },
      { time: '2026-07-17 14:30', event: 'GDP (QoQ)', impact: 'High', prev: '2.8%', forecast: '2.6%' },
      { time: '2026-07-18 08:30', event: 'NFP', impact: 'High', prev: '275K', forecast: '240K' },
      { time: '2026-07-16 20:00', event: 'FOMC Minutes', impact: 'High', prev: '-', forecast: '-' },
      { time: '2026-07-15 10:00', event: 'EZ CPI', impact: 'Medium', prev: '2.6%', forecast: '2.5%' },
      { time: '2026-07-17 15:00', event: 'ISM Manufacturing', impact: 'Medium', prev: '49.5', forecast: '50.2' },
    ];
    sendSuccess(res, events);
  } catch (error) { next(error); }
});

router.get('/market-sessions', async (req, res, next) => {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
    const sessions = [
      { name: 'Sydney', open: 22, close: 7, flag: 'AU', isOpen: utcHour >= 22 || utcHour < 7 },
      { name: 'Tokyo', open: 0, close: 9, flag: 'JP', isOpen: utcHour >= 0 && utcHour < 9 },
      { name: 'London', open: 7, close: 16, flag: 'GB', isOpen: utcHour >= 7 && utcHour < 16 },
      { name: 'New York', open: 13, close: 22, flag: 'US', isOpen: utcHour >= 13 && utcHour < 22 },
    ];
    sendSuccess(res, { utcHour, sessions });
  } catch (error) { next(error); }
});

module.exports = router;
