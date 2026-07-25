const mongoose = require('mongoose');

const rankHistorySchema = new mongoose.Schema({
  rankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rank',
    required: [true, 'Rank ID is required']
  },
  achievedAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters'],
    default: null
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  changeType: {
    type: String,
    enum: {
      values: ['manual', 'automatic'],
      message: '{VALUE} is not a valid change type'
    },
    required: [true, 'Change type is required']
  }
}, { _id: true });

const userRankSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },
  currentRankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rank',
    required: [true, 'Current rank ID is required']
  },
  totalReferrals: {
    type: Number,
    default: 0,
    min: [0, 'Total referrals cannot be negative']
  },
  indirectReferrals: {
    type: Number,
    default: 0,
    min: [0, 'Indirect referrals cannot be negative']
  },
  totalRevenue: {
    type: Number,
    default: 0,
    min: [0, 'Total revenue cannot be negative']
  },
  totalCommission: {
    type: Number,
    default: 0,
    min: [0, 'Total commission cannot be negative']
  },
  rankHistory: [rankHistorySchema],
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lockedAt: {
    type: Date,
    default: null
  },
  lockReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Lock reason cannot exceed 500 characters'],
    default: null
  },
  nextRankAt: {
    type: Date,
    default: null
  },
  eligibleForPromotion: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userRankSchema.index({ currentRankId: 1 });
userRankSchema.index({ totalReferrals: -1 });
userRankSchema.index({ totalRevenue: -1 });
userRankSchema.index({ isLocked: 1 });
userRankSchema.index({ eligibleForPromotion: 1 });

userRankSchema.pre('save', function (next) {
  if (this.isModified('rankHistory') && this.rankHistory.length > 0) {
    this.nextRankAt = new Date();
  }
  next();
});

module.exports = mongoose.model('UserRank', userRankSchema);
