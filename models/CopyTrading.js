const mongoose = require('mongoose');

const profitDistributionSchema = new mongoose.Schema({
  brokerShare: {
    type: Number,
    default: 0,
    min: [0, 'Broker share cannot be negative']
  },
  traderShare: {
    type: Number,
    default: 0,
    min: [0, 'Trader share cannot be negative']
  },
  networkShare: {
    type: Number,
    default: 0,
    min: [0, 'Network share cannot be negative']
  },
  platformShare: {
    type: Number,
    default: 0,
    min: [0, 'Platform share cannot be negative']
  }
}, { _id: false });

const copyTradingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Follower user ID is required']
  },
  masterAccountId: {
    type: String,
    required: [true, 'Master account ID is required'],
    trim: true
  },
  symbol: {
    type: String,
    required: [true, 'Trading symbol is required'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Symbol cannot exceed 20 characters']
  },
  action: {
    type: String,
    enum: {
      values: ['BUY', 'SELL', 'CLOSE', 'MODIFY'],
      message: '{VALUE} is not a valid action'
    },
    required: [true, 'Action is required']
  },
  volume: {
    type: Number,
    required: [true, 'Volume is required'],
    min: [0.01, 'Volume must be at least 0.01']
  },
  openPrice: {
    type: Number,
    required: [true, 'Open price is required'],
    min: [0, 'Open price cannot be negative']
  },
  closePrice: {
    type: Number,
    default: null,
    min: [0, 'Close price cannot be negative']
  },
  profit: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: {
      values: ['open', 'closed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'open'
  },
  openTime: {
    type: Date,
    required: [true, 'Open time is required']
  },
  closeTime: {
    type: Date,
    default: null
  },
  brokerShare: {
    type: Number,
    default: 0,
    min: [0, 'Broker share cannot be negative']
  },
  traderShare: {
    type: Number,
    default: 0,
    min: [0, 'Trader share cannot be negative']
  },
  networkShare: {
    type: Number,
    default: 0,
    min: [0, 'Network share cannot be negative']
  },
  profitDistribution: {
    type: profitDistributionSchema,
    default: () => ({})
  },
  copyVolume: {
    type: Number,
    min: [0, 'Copy volume cannot be negative']
  },
  riskLevel: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'very_high'],
      message: '{VALUE} is not a valid risk level'
    },
    default: 'medium'
  },
  stopLoss: {
    type: Number,
    default: null,
    min: [0, 'Stop loss cannot be negative']
  },
  takeProfit: {
    type: Number,
    default: null,
    min: [0, 'Take profit cannot be negative']
  },
  pips: {
    type: Number,
    default: 0
  },
  isAutoCopied: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

copyTradingSchema.index({ userId: 1 });
copyTradingSchema.index({ masterAccountId: 1 });
copyTradingSchema.index({ symbol: 1 });
copyTradingSchema.index({ status: 1 });
copyTradingSchema.index({ openTime: -1 });
copyTradingSchema.index({ createdAt: -1 });
copyTradingSchema.index({ userId: 1, status: 1 });
copyTradingSchema.index({ masterAccountId: 1, status: 1 });

module.exports = mongoose.model('CopyTrading', copyTradingSchema);
