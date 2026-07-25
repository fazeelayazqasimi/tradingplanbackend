const crypto = require('crypto');

const MERCHANT_ID = process.env.COINPAYMENTS_MERCHANT_ID || '';
const PUBLIC_KEY = process.env.COINPAYMENTS_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.COINPAYMENTS_PRIVATE_KEY || '';
const IPN_SECRET = process.env.COINPAYMENTS_IPN_SECRET || '';
const API_URL = 'https://www.coinpayments.net/api.php';
const IPN_URL = process.env.COINPAYMENTS_IPN_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/webhooks/coinpayments`;

const SUPPORTED_COINS = {
  USDT_BEP20: { name: 'Tether (USDT)', network: 'BEP20', currency: 'USDT.BEP20' },
  USDT_TRC20: { name: 'Tether (USDT)', network: 'TRC20', currency: 'USDT.TRC20' },
  USDT_ERC20: { name: 'Tether (USDT)', network: 'ERC20', currency: 'USDT.ERC20' },
  BTC: { name: 'Bitcoin', network: 'BTC', currency: 'BTC' },
  ETH: { name: 'Ethereum', network: 'ERC20', currency: 'ETH' },
  BNB: { name: 'Binance Coin', network: 'BEP20', currency: 'BNB.BEP20' },
};

const coinToCurrency = (coinType) => {
  const coin = SUPPORTED_COINS[coinType];
  return coin ? coin.currency : coinType;
};

const generatePaymentRef = (userId, amount) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `COIN-${timestamp}-${random}`;
};

const apiCall = async (params) => {
  params.version = 1;
  params.key = PUBLIC_KEY;
  params.format = 'json';

  const postData = new URLSearchParams(params).toString();
  const hmac = crypto.createHmac('sha512', PRIVATE_KEY).update(postData).digest('hex');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'HMAC': hmac,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: postData,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`CoinPayments API parse error: ${text}`);
  }

  if (data.error !== 'ok') {
    throw new Error(`CoinPayments API error: ${data.error || JSON.stringify(data)}`);
  }

  return data.result;
};

const createCoinPayment = async ({ userId, amount, coinType, userName, userEmail }) => {
  const coin = SUPPORTED_COINS[coinType];
  if (!coin) {
    throw new Error(`Unsupported coin type: ${coinType}. Supported: ${Object.keys(SUPPORTED_COINS).join(', ')}`);
  }

  const paymentRef = generatePaymentRef(userId, amount);
  const currency = coinToCurrency(coinType);

  const result = await apiCall({
    cmd: 'create_transaction',
    amount,
    currency1: 'USD',
    currency2: currency,
    buyer_email: userEmail,
    buyer_name: userName || 'User',
    custom: paymentRef,
    ipn_url: IPN_URL,
  });

  const qrCodeData = result.qrcode_url || '';

  return {
    success: true,
    payment: {
      paymentRef,
      amount,
      coinType,
      coinName: coin.name,
      network: coin.network,
      depositAddress: result.address,
      txnId: result.txn_id,
      confirmsNeeded: result.confirms_needed || 3,
      timeout: result.timeout,
      statusUrl: result.status_url,
      qrcodeUrl: result.qrcode_url,
      merchantPublicKey: PUBLIC_KEY,
      status: 'pending',
      expiresAt: new Date(Date.now() + (result.timeout || 3600) * 1000),
      qrCodeData,
      raw: result,
    }
  };
};

const getCallbackAddress = async ({ coinType, userId, amount }) => {
  const currency = coinToCurrency(coinType);
  const result = await apiCall({
    cmd: 'get_callback_address',
    currency,
    ipn_url: IPN_URL,
    label: `USER_${userId}_${Date.now()}`,
  });

  return {
    address: result.address,
    pubkey: result.pubkey || null,
    destTag: result.dest_tag || null,
  };
};

const createWithdrawal = async ({ amount, coinType, address, userId, paymentRef, autoConfirm }) => {
  const currency = coinToCurrency(coinType);

  const params = {
    cmd: 'create_withdrawal',
    amount,
    currency,
    address,
    ipn_url: IPN_URL,
    note: paymentRef ? `Withdrawal ref: ${paymentRef}` : `Withdrawal user: ${userId}`,
    auto_confirm: autoConfirm ? 1 : 0,
  };

  const result = await apiCall(params);

  return {
    id: result.id,
    status: result.status,
    amount: result.amount,
    txnId: result.id,
  };
};

const getTransactionInfo = async (txnId) => {
  const result = await apiCall({
    cmd: 'get_tx_info',
    txid: txnId,
  });

  return {
    txnId: result.txn_id,
    status: parseInt(result.status, 10),
    statusText: result.status_text || '',
    amount1: parseFloat(result.amount1),
    amount2: parseFloat(result.amount2),
    currency1: result.currency1,
    currency2: result.currency2,
    confirmsNeeded: parseInt(result.confirms_needed, 10) || 0,
    confirmsReceived: parseInt(result.confirms_received, 10) || 0,
    fee: parseFloat(result.fee) || 0,
    netAmount: parseFloat(result.net) || 0,
    receivedAmount: parseFloat(result.received_amount) || 0,
    receivedConfirms: parseInt(result.received_confirms, 10) || 0,
    paymentAddress: result.payment_address || '',
    timeCompleted: result.time_completed || null,
    raw: result,
  };
};

const verifyIPN = (bodyRaw, headers) => {
  const hmacHeader = headers['hmac'] || headers['Hmac'] || '';
  const expected = crypto.createHmac('sha512', IPN_SECRET).update(bodyRaw).digest('hex');

  if (!hmacHeader || expected !== hmacHeader) {
    console.error('[CoinPayments] IPN HMAC verification failed');
    return false;
  }
  return true;
};

const parseIPNBody = (bodyRaw) => {
  if (typeof bodyRaw === 'string') {
    const params = {};
    bodyRaw.split('&').forEach((pair) => {
      const [key, value] = pair.split('=').map((s) => decodeURIComponent(s.replace(/\+/g, ' ')));
      if (key) params[key] = value;
    });
    return params;
  }
  return bodyRaw;
};

const getStatusFromIPN = (statusCode) => {
  const code = parseInt(statusCode, 10);
  if (code >= 100 || code === 2) return 'completed';
  if (code === 1) return 'pending';
  if (code === 0) return 'waiting';
  if (code === -1) return 'pending';
  if (code <= -2) return 'failed';
  return 'pending';
};

module.exports = {
  createCoinPayment,
  getCallbackAddress,
  createWithdrawal,
  getTransactionInfo,
  verifyIPN,
  parseIPNBody,
  getStatusFromIPN,
  SUPPORTED_COINS,
  coinToCurrency,
  MERCHANT_ID,
  PUBLIC_KEY,
  IPN_URL,
};