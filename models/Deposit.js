const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentAccount',
    default: null
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Minimum deposit is $1']
  },
  screenshot: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'crypto', 'coin', 'usdt_bep20', 'mobile_money', 'other'],
    default: 'usdt_bep20'
  },
  coinType: {
    type: String,
    default: null
  },
  coinPaymentRef: {
    type: String,
    default: null
  },
  coinPaymentsTxnId: {
    type: String,
    default: null
  },
  depositAddress: {
    type: String,
    default: null
  },
  confirmsNeeded: {
    type: Number,
    default: null
  },
  confirmsReceived: {
    type: Number,
    default: 0
  },
  webhookProcessed: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  },
  walletType: {
    type: String,
    enum: ['main', 'funding', 'ib'],
    default: 'funding'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired', 'failed'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    trim: true,
    default: null
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

depositSchema.index({ userId: 1, status: 1 });
depositSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Deposit', depositSchema);
