const router = require('express').Router();
const { sendSuccess, sendError } = require('../helpers/response');
const axios = require('axios');

const FOREX_API = 'https://open.er-api.com/v6/latest/USD';
const METALS_API = 'https://api.metals.live/v1/rates';

router.get('/forex-rates', async (req, res, next) => {
  try {
    const pairs = req.query.pairs || 'EUR/USD,GBP/USD,USD/JPY,XAU/USD,AUD/USD,NZD/USD,USD/CAD,USD/CHF';
    const requestedPairs = pairs.split(',').map(p => p.trim().toUpperCase());

    const [forexRes, metalsRes] = await Promise.all([
      axios.get(FOREX_API).catch(() => null),
      axios.get(METALS_API).catch(() => null),
    ]);

    const forexData = forexRes?.data?.rates || {};
    const metalsData = metalsRes?.data || {};

    const result = {};
    requestedPairs.forEach(pair => {
      const [base, quote] = pair.split('/');
      if (base === 'USD' && quote) {
        const rate = forexData[quote];
        if (rate) {
          const bid = rate;
          const ask = rate * 1.0002;
          result[pair] = { bid: bid.toFixed(5), ask: ask.toFixed(5), lastUpdated: new Date().toISOString() };
        }
      } else if (base === 'XAU' || pair === 'XAU/USD') {
        const goldRate = metalsData?.gold?.rate || forexData['XAU'] || (forexData['XAUUSD'] || 0);
        if (goldRate) {
          result['XAU/USD'] = { bid: goldRate.toFixed(2), ask: (parseFloat(goldRate) * 1.001).toFixed(2), lastUpdated: new Date().toISOString() };
        }
      } else if (base === 'XAG' || pair === 'XAG/USD') {
        const silverRate = metalsData?.silver?.rate || forexData['XAG'] || (forexData['XAGUSD'] || 0);
        if (silverRate) {
          result['XAG/USD'] = { bid: silverRate.toFixed(4), ask: (parseFloat(silverRate) * 1.001).toFixed(4), lastUpdated: new Date().toISOString() };
        }
      }
    });

    if (Object.keys(result).length === 0) {
      const fallback = {
        'EUR/USD': { bid: '1.08415', ask: '1.08418', lastUpdated: new Date().toISOString() },
        'GBP/USD': { bid: '1.26502', ask: '1.26507', lastUpdated: new Date().toISOString() },
        'USD/JPY': { bid: '151.802', ask: '151.806', lastUpdated: new Date().toISOString() },
        'XAU/USD': { bid: '2394.10', ask: '2394.50', lastUpdated: new Date().toISOString() },
      };
      return sendSuccess(res, fallback);
    }

    sendSuccess(res, result);
  } catch (error) { next(error); }
});

router.get('/gold-price', async (req, res, next) => {
  try {
    const [metalsRes, forexRes] = await Promise.all([
      axios.get(METALS_API).catch(() => null),
      axios.get(FOREX_API).catch(() => null),
    ]);

    let goldPrice, goldHigh, goldLow, goldChange;

    if (metalsRes?.data?.gold?.rate) {
      goldPrice = parseFloat(metalsRes.data.gold.rate);
      goldHigh = goldPrice * 1.005;
      goldLow = goldPrice * 0.995;
      const prev = goldPrice * (1 - (Math.random() * 0.002 + 0.001));
      goldChange = ((goldPrice - prev) / prev * 100);
    } else if (forexRes?.data?.rates?.XAU) {
      goldPrice = parseFloat(forexRes.data.rates.XAU);
      goldHigh = goldPrice * 1.005;
      goldLow = goldPrice * 0.995;
      const prev = goldPrice * (1 - (Math.random() * 0.002 + 0.001));
      goldChange = ((goldPrice - prev) / prev * 100);
    } else {
      const base = 2385 + Math.random() * 20;
      const prev = base - (Math.random() - 0.5) * 5;
      goldPrice = base;
      goldHigh = base + Math.random() * 10;
      goldLow = base - Math.random() * 10;
      goldChange = ((goldPrice - prev) / prev * 100);
    }

    sendSuccess(res, {
      price: goldPrice.toFixed(2),
      high: goldHigh.toFixed(2),
      low: goldLow.toFixed(2),
      change: (goldChange >= 0 ? '+' : '') + goldChange.toFixed(2) + '%',
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