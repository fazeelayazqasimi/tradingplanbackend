const axios = require('axios');

const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY || 'ba5a2fcf97924428a26e9476ae198921';
const TWELVEDATA_QUOTE_URL = 'https://api.twelvedata.com/quote';

const LIVE_CACHE_TTL_MS = 60 * 1000;
const FAIL_BACKOFF_MS = 2 * 60 * 1000;

let liveCache = { quotes: {}, fetchedAt: 0, lastFailedAt: 0 };

const normalizeSymbol = (symbol) => {
  if (!symbol) return null;
  const s = String(symbol).toUpperCase().replace(/\s+/g, '');
  if (s.includes('/')) return s;
  if (s === 'XAUUSD') return 'XAU/USD';
  if (s === 'XAGUSD') return 'XAG/USD';
  if (s.endsWith('USD') && s.length === 6) return `${s.slice(0, 3)}/${s.slice(3)}`;
  if (s.endsWith('USDT') && s.length === 8) return `${s.slice(0, 4)}/USDT`;
  return s;
};

async function fetchLiveQuotes(symbols) {
  const res = await axios.get(TWELVEDATA_QUOTE_URL, {
    params: { symbol: symbols.join(','), apikey: TWELVEDATA_API_KEY },
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

async function getLiveQuotes(symbols = []) {
  const needed = symbols
    .map(normalizeSymbol)
    .filter(Boolean)
    .filter((s) => s.includes('/'));
  if (needed.length === 0) return {};

  const cached = {};
  const missing = [];
  for (const s of needed) {
    if (liveCache.quotes[s] && Date.now() - liveCache.fetchedAt < LIVE_CACHE_TTL_MS) {
      cached[s] = liveCache.quotes[s];
    } else {
      missing.push(s);
    }
  }

  if (missing.length > 0) {
    const recentlyFailed = Date.now() - liveCache.lastFailedAt < FAIL_BACKOFF_MS;
    if (!recentlyFailed) {
      try {
        const fresh = await fetchLiveQuotes(missing);
        Object.assign(liveCache.quotes, fresh);
        liveCache.fetchedAt = Date.now();
        liveCache.lastFailedAt = 0;
        Object.assign(cached, fresh);
      } catch (e) {
        liveCache.lastFailedAt = Date.now();
      }
    }
    for (const s of missing) {
      if (liveCache.quotes[s]) cached[s] = liveCache.quotes[s];
    }
  }

  return cached;
}

const getLivePrice = async (symbol) => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized || !normalized.includes('/')) return null;
  const quotes = await getLiveQuotes([normalized]);
  const q = quotes[normalized];
  if (!q || q.close === undefined) return null;
  return Number(q.close);
};

const getPipSize = (symbol) => {
  const s = String(symbol || '').toUpperCase();
  if (s.includes('JPY')) return 0.01;
  if (s.includes('XAU')) return 0.1;
  if (s.includes('XAG')) return 0.01;
  if (s.includes('BTC') || s.includes('ETH')) return 1;
  return 0.0001;
};

module.exports = { getLiveQuote: getLivePrice, getLiveQuotes, normalizeSymbol, getPipSize };
