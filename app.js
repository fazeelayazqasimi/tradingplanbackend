require('express-async-errors');

// Fix Windows PowerShell \r\n in env vars
Object.keys(process.env).forEach((key) => {
  if (typeof process.env[key] === 'string') {
    process.env[key] = process.env[key].trim();
  }
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const connectDB = require('./config/db');

let isConnected = false;

async function connectToDatabase() {
  if (isConnected) return;
  await connectDB();
  isConnected = true;
}

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
    : '*',
  credentials: true
}));

app.use('/api/webhooks', express.raw({ type: '*/*' }), require('./routes/webhooks'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.json({ status: 'degraded', timestamp: new Date().toISOString(), db: 'disconnected' });
  }
});

app.use('/api', async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database connection failed' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/signals', require('./routes/signals'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/ranks', require('./routes/ranks'));
app.use('/api/wallets', require('./routes/wallets'));
app.use('/api/withdrawals', require('./routes/withdrawals'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/copy-trading', require('./routes/copyTrading'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/support', require('./routes/support'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/faqs', require('./routes/faqs'));
app.use('/api/page-content', require('./routes/pageContent'));
app.use('/api/market', require('./routes/market'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/charts', require('./routes/charts'));
app.use('/api/course-purchases', require('./routes/coursePurchases'));
app.use('/api/payment-accounts', require('./routes/paymentAccounts'));
app.use('/api/deposits', require('./routes/deposits'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/brokers', require('./routes/brokers'));

const { errorHandler, notFound } = require('./middleware/error');
app.use(notFound);
app.use(errorHandler);

module.exports = app;
module.exports.connectToDatabase = connectToDatabase;
