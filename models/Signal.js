const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Guru user ID is required']
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
    required: [true, 'Signal action is required']
  },
  side: {
    type: String,
    enum: {
      values: ['LONG', 'SHORT'],
      message: '{VALUE} is not a valid side'
    },
    required: [true, 'Signal side is required']
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
  currentPrice: {
    type: Number,
    default: null,
    min: [0, 'Current price cannot be negative']
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
  status: {
    type: String,
    enum: {
      values: ['open', 'closed', 'pending'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },
  profit: {
    type: Number,
    default: 0
  },
  pips: {
    type: Number,
    default: 0
  },
  openTime: {
    type: Date,
    required: [true, 'Open time is required']
  },
  closeTime: {
    type: Date,
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  imageUrls: [{
    type: String,
    trim: true
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  riskRewardRatio: {
    type: Number,
    min: [0, 'Risk reward ratio cannot be negative']
  },
  timeframe: {
    type: String,
    enum: {
      values: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'],
      message: '{VALUE} is not a valid timeframe'
    },
    default: 'H1'
  },
  confidence: {
    type: Number,
    min: [1, 'Confidence must be at least 1'],
    max: [5, 'Confidence cannot exceed 5'],
    default: 3
  },
  followersCount: {
    type: Number,
    default: 0,
    min: [0, 'Followers count cannot be negative']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

signalSchema.index({ userId: 1 });
signalSchema.index({ symbol: 1 });
signalSchema.index({ action: 1 });
signalSchema.index({ side: 1 });
signalSchema.index({ status: 1 });
signalSchema.index({ isPublished: 1 });
signalSchema.index({ openTime: -1 });
signalSchema.index({ createdAt: -1 });
signalSchema.index({ tags: 1 });

module.exports = mongoose.model('Signal', signalSchema);
