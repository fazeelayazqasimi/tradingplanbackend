const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  type: {
    type: String,
    enum: ['main', 'funding', 'ib'],
    default: 'main',
    required: [true, 'Wallet type is required']
  },
  directIncome: {
    type: Number,
    default: 0,
    min: [0, 'Direct income cannot be negative']
  },
  indirectIncome: {
    type: Number,
    default: 0,
    min: [0, 'Indirect income cannot be negative']
  },
  tradingProfit: {
    type: Number,
    default: 0,
    min: [0, 'Trading profit cannot be negative']
  },
  bonus: {
    type: Number,
    default: 0,
    min: [0, 'Bonus cannot be negative']
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: [0, 'Pending balance cannot be negative']
  },
  availableBalance: {
    type: Number,
    default: 0,
    min: [0, 'Available balance cannot be negative']
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: [0, 'Total earned cannot be negative']
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: [0, 'Total withdrawn cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD',
    trim: true,
    uppercase: true,
    maxlength: [3, 'Currency code cannot exceed 3 characters']
  },
  lastCreditAt: {
    type: Date,
    default: null
  },
  lastDebitAt: {
    type: Date,
    default: null
  },
  lastWithdrawalAt: {
    type: Date,
    default: null
  },
  minimumWithdrawal: {
    type: Number,
    default: 50,
    min: [0, 'Minimum withdrawal cannot be negative']
  },
  isFrozen: {
    type: Boolean,
    default: false
  },
  frozenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  frozenAt: {
    type: Date,
    default: null
  },
  freezeReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Freeze reason cannot exceed 500 characters'],
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

walletSchema.index({ userId: 1, type: 1 }, { unique: true });
walletSchema.index({ availableBalance: -1 });
walletSchema.index({ isFrozen: 1 });
walletSchema.index({ totalEarned: -1 });

walletSchema.virtual('totalBalance').get(function () {
  return this.availableBalance + this.pendingBalance;
});

walletSchema.virtual('netEarnings').get(function () {
  return this.totalEarned - this.totalWithdrawn;
});

module.exports = mongoose.model('Wallet', walletSchema);
