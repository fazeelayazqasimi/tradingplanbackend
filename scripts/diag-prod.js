require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Setting = require('../models/Setting');
const PaymentAccount = require('../models/PaymentAccount');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) { console.log('NO MONGODB_URI in .env'); process.exit(1); }
  const dbName = uri.split('/').pop().split('?')[0];
  console.log('DB:', dbName);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  const keys = ['membership_price', 'funding_wallet_usage_percent', 'upline_activation_discount', 'admin_notification_email', 'withdrawal_fee_percent'];
  for (const key of keys) {
    const s = await Setting.findOne({ key }).lean();
    console.log(`Setting ${key} =`, s ? s.value : 'MISSING');
  }

  const accounts = await PaymentAccount.find().lean();
  console.log(`\nPaymentAccounts total: ${accounts.length}`);
  accounts.forEach(a => console.log(` - ${a.paymentType} | active=${a.isActive} | wallet=${a.walletAddress ? a.walletAddress.slice(0, 12) + '...' : 'EMPTY'} | qr=${a.qrCodeUrl || 'EMPTY'} | label=${a.bankName}`));

  const deposits = await Deposit.find().sort({ createdAt: -1 }).limit(3).lean();
  console.log(`\nLast ${deposits.length} deposits:`);
  deposits.forEach(d => console.log(` - status=${d.status} amount=${d.amount} method=${d.paymentMethod} addr=${d.depositAddress || 'EMPTY'} walletType=${d.walletType}`));

  const withdrawals = await Withdrawal.find().sort({ createdAt: -1 }).limit(3).lean();
  console.log(`\nLast ${withdrawals.length} withdrawals:`);
  withdrawals.forEach(w => console.log(` - status=${w.status} amount=${w.amount} fee=${w.fee ?? '?'} net=${w.netAmount ?? '?'}`));

  await mongoose.disconnect();
  console.log('\nDone.');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
