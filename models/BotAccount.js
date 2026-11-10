const mongoose = require('mongoose');

const botAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  platform: {
    type: String,
    enum: {
      values: ['MT4', 'MT5'],
      message: 'Platform must be MT4 or MT5',
    },
    required: [true, 'Platform is required'],
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    trim: true,
    maxlength: [50, 'Account number cannot exceed 50 characters'],
  },
  server: {
    type: String,
    required: [true, 'Server is required'],
    trim: true,
    maxlength: [100, 'Server cannot exceed 100 characters'],
  },
  brokerName: {
    type: String,
    trim: true,
    maxlength: [100, 'Broker name cannot exceed 100 characters'],
  },
  accountType: {
    type: String,
    enum: {
      values: ['demo', 'real'],
      message: 'Account type must be demo or real',
    },
    default: 'real',
  },
  password: {
    type: String,
    trim: true,
    maxlength: [200, 'Password cannot exceed 200 characters'],
  },
  strategyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradingStrategy',
    default: null,
  },
  strategyName: {
    type: String,
    trim: true,
    maxlength: [60, 'Strategy name cannot exceed 60 characters'],
    default: null,
  },
  feeAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

botAccountSchema.index({ userId: 1, createdAt: -1 });
botAccountSchema.index({ accountNumber: 1 });

module.exports = mongoose.model('BotAccount', botAccountSchema);
