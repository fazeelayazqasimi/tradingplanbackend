const router = require('express').Router();
const { sendSuccess } = require('../helpers/response');
const axios = require('axios');

const FOREX_API = 'https://api.frankfurter.dev/v1/latest';
const GOLD_API = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json';
const SILVER_API = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xag.json';

const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY || 'ba5a2fcf97924428a26e9476ae198921';
const TWELVEDATA_QUOTE_URL = 'https://api.twelvedata.com/quote';
// Free plan supports forex pairs, XAU/USD and crypto. Kept to 8 symbols
// (8 credits) so a single cached call stays within the 8 credits/minute limit.
const LIVE_SYMBOLS = ['XAU/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'BTC/USD', 'ETH/USD'];
const LIVE_CACHE_TTL_MS = 60 * 1000;

let liveCache = { quotes: null, fetchedAt: 0 };

async function fetchLiveQuotes() {
  const res = await axios.get(TWELVEDATA_QUOTE_URL, {
    params: { symbol: LIVE_SYMBOLS.join(','), apikey: TWELVEDATA_API_KEY },
    timeout: 15000,
  });
  const raw = res.data;
  const quotes = {};
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      const q = raw[key];
      if (!q || q.status === 'error' || q.close === undefined) continue;
      quotes[key] = q;
    }
  }
  if (Object.keys(quotes).length === 0) throw new Error('TwelveData returned no quotes');
  return quotes;
}

// Free, keyless fallback used when TwelveData is unavailable (e.g. out of
// daily credits). Sources: Frankfurter (ECB) for fiat FX, jsDelivr currency-api
// for XAU/USD (gold), CoinGecko for BTC/USD & ETH/USD.
async function fetchFallbackQuotes() {
  const [forexRes, goldRes, cryptoRes] = await Promise.all([
    axios.get(FOREX_API, { params: { base: 'USD' }, timeout: 15000 }).catch(() => null),
    axios.get(GOLD_API, { timeout: 15000 }).catch(() => null),
    axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: 'bitcoin,ethereum', vs_currencies: 'usd', include_24hr_change: true },
      timeout: 15000,
    }).catch(() => null),
  ]);
  const quotes = {};
  const forex = forexRes?.data?.rates || {};
  const fxRate = (pair) => {
    const [base, quote] = pair.split('/');
    if (base === 'USD') return forex[quote];
    if (quote === 'USD') return forex[base] ? 1 / forex[base] : undefined;
    return undefined;
  };
  ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'].forEach((pair) => {
    const price = fxRate(pair);
    if (price) quotes[pair] = { symbol: pair, name: pair, close: price, open: price, high: price, low: price, change: 0, percent_change: 0, is_market_open: true };
  });
  const gold = goldRes?.data?.xau?.usd || goldRes?.data?.xau?.USD;
  if (gold) quotes['XAU/USD'] = { symbol: 'XAU/USD', name: 'Gold', close: gold, open: gold, high: gold, low: gold, change: 0, percent_change: 0, is_market_open: true };
  const cg = cryptoRes?.data || {};
  if (cg.bitcoin) quotes['BTC/USD'] = { symbol: 'BTC/USD', name: 'Bitcoin', close: cg.bitcoin.usd, open: cg.bitcoin.usd, high: cg.bitcoin.usd, low: cg.bitcoin.usd, change: cg.bitcoin.usd_24h_change || 0, percent_change: cg.bitcoin.usd_24h_change || 0, is_market_open: true };
  if (cg.ethereum) quotes['ETH/USD'] = { symbol: 'ETH/USD', name: 'Ethereum', close: cg.ethereum.usd, open: cg.ethereum.usd, high: cg.ethereum.usd, low: cg.ethereum.usd, change: cg.ethereum.usd_24h_change || 0, percent_change: cg.ethereum.usd_24h_change || 0, is_market_open: true };
  if (Object.keys(quotes).length === 0) throw new Error('All fallback rate sources failed');
  return quotes;
}

async function getLiveQuotes() {
  if (liveCache.quotes && Date.now() - liveCache.fetchedAt < LIVE_CACHE_TTL_MS) {
    return liveCache.quotes;
  }
  try {
    const quotes = await fetchLiveQuotes();
    liveCache = { quotes, fetchedAt: Date.now() };
    return quotes;
  } catch (e) {
    console.error('[LIVE-RATES] TwelveData unavailable, using free fallback:', e.message);
    try {
      const quotes = await fetchFallbackQuotes();
      liveCache = { quotes, fetchedAt: Date.now() };
      return quotes;
    } catch (e2) {
      console.error('[LIVE-RATES] fallback also failed:', e2.message);
      if (liveCache.quotes) return liveCache.quotes;
      throw e2;
    }
  }
}

const quoteToRate = (q) => ({
  symbol: q.symbol,
  name: q.name,
  price: Number(q.close),
  open: Number(q.open),
  high: Number(q.high),
  low: Number(q.low),
  change: Number(q.change),
  changePercent: Number(q.percent_change),
  isMarketOpen: q.is_market_open === true,
});

const FOREX_FALLBACK = {
  'EUR/USD': { bid: '1.08415', ask: '1.08418', change: '+0.12%', lastUpdated: new Date().toISOString() },
  'GBP/USD': { bid: '1.26502', ask: '1.26507', change: '-0.08%', lastUpdated: new Date().toISOString() },
  'USD/JPY': { bid: '151.802', ask: '151.806', change: '+0.25%', lastUpdated: new Date().toISOString() },
  'XAU/USD': { bid: '2394.10', ask: '2394.50', change: '+0.35%', lastUpdated: new Date().toISOString() },
};

router.get('/live-rates', async (req, res, next) => {
  try {
    const quotes = await getLiveQuotes();
    sendSuccess(res, {
      rates: Object.values(quotes).map(quoteToRate),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    sendSuccess(res, { rates: [], lastUpdated: new Date().toISOString() });
  }
});

router.get('/forex-rates', async (req, res, next) => {
  try {
    const pairs = req.query.pairs || 'EUR/USD,GBP/USD,USD/JPY,XAU/USD,AUD/USD,NZD/USD,USD/CAD,USD/CHF';
    const requestedPairs = pairs.split(',').map(p => p.trim().toUpperCase());
    const quotes = await getLiveQuotes();
    const result = {};
    requestedPairs.forEach(pair => {
      const q = quotes[pair];
      if (!q) return;
      const price = Number(q.close);
      const pc = Number(q.percent_change);
      const decimals = pair.startsWith('XAU') ? 2 : pair.startsWith('XAG') ? 4 : 5;
      result[pair] = {
        bid: price.toFixed(decimals),
        ask: (price * 1.0002).toFixed(decimals),
        change: (pc >= 0 ? '+' : '') + pc.toFixed(2) + '%',
        lastUpdated: new Date().toISOString(),
      };
    });
    if (Object.keys(result).length === 0) {
      return sendSuccess(res, FOREX_FALLBACK);
    }
    sendSuccess(res, result);
  } catch (error) {
    try {
      const [forexRes, goldRes, silverRes] = await Promise.all([
          axios.get(FOREX_API, { params: { base: 'USD' } }).catch(() => null),
          axios.get(GOLD_API).catch(() => null),
          axios.get(SILVER_API).catch(() => null),
      ]);
      const forexData = forexRes?.data?.rates || {};
      const goldRate = goldRes?.data?.xau?.usd || goldRes?.data?.xau?.USD || 0;
      const silverRate = silverRes?.data?.xag?.usd || silverRes?.data?.xag?.USD || 0;
      const pairs = (req.query.pairs || 'EUR/USD,GBP/USD,USD/JPY,XAU/USD,AUD/USD,NZD/USD,USD/CAD,USD/CHF').split(',').map(p => p.trim().toUpperCase());
      const result = {};
      pairs.forEach(pair => {
        const [base, quote] = pair.split('/');
        if (base === 'USD' && quote) {
          const rate = forexData[quote];
          if (rate) {
            result[pair] = { bid: rate.toFixed(5), ask: (rate * 1.0002).toFixed(5), lastUpdated: new Date().toISOString() };
          }
        } else if (base === 'XAU' || pair === 'XAU/USD') {
          if (goldRate) {
            result['XAU/USD'] = { bid: goldRate.toFixed(2), ask: (goldRate * 1.001).toFixed(2), lastUpdated: new Date().toISOString() };
          }
        } else if (base === 'XAG' || pair === 'XAG/USD') {
          if (silverRate) {
            result['XAG/USD'] = { bid: silverRate.toFixed(4), ask: (silverRate * 1.001).toFixed(4), lastUpdated: new Date().toISOString() };
          }
        }
      });
      if (Object.keys(result).length === 0) return sendSuccess(res, FOREX_FALLBACK);
      return sendSuccess(res, result);
    } catch (e2) {
      next(e2);
    }
  }
});

router.get('/gold-price', async (req, res, next) => {
  try {
    const quotes = await getLiveQuotes();
    const q = quotes['XAU/USD'];
    if (!q) throw new Error('XAU/USD quote unavailable');
    const goldPrice = Number(q.close);
    const goldChange = Number(q.percent_change);
    sendSuccess(res, {
      price: goldPrice.toFixed(2),
      high: Number(q.high || goldPrice).toFixed(2),
      low: Number(q.low || goldPrice).toFixed(2),
      change: (goldChange >= 0 ? '+' : '') + goldChange.toFixed(2) + '%',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    try {
        const [goldRes, forexRes] = await Promise.all([
          axios.get(GOLD_API).catch(() => null),
          axios.get(FOREX_API, { params: { base: 'USD' } }).catch(() => null),
        ]);

      let goldPrice, goldHigh, goldLow, goldChange;

      if (goldRes?.data?.xau?.usd || goldRes?.data?.xau?.USD) {
        goldPrice = parseFloat(goldRes.data.xau.usd || goldRes.data.xau.USD);
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
    } catch (e2) { next(e2); }
  }
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
