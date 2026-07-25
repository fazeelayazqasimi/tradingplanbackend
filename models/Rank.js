const mongoose = require('mongoose');

const rankSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Rank name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true
  },
  minDirectReferrals: {
    type: Number,
    default: 0,
    min: [0, 'Minimum direct referrals cannot be negative']
  },
  minRequiredRank: {
    type: String,
    trim: true,
    default: null
  },
  minRequiredRankCount: {
    type: Number,
    default: 0,
    min: [0, 'Minimum required rank count cannot be negative']
  },
  minTeamMembers: {
    type: Number,
    default: 0,
    min: [0, 'Minimum team members cannot be negative']
  },
  activationGain: {
    type: Number,
    default: 0,
    min: [0, 'Activation gain cannot be negative']
  },
  quantification: {
    type: Number,
    default: 0,
    min: [0, 'Quantification cannot be negative'],
    max: [100, 'Quantification cannot exceed 100']
  },
  indirectIncome: {
    type: Number,
    default: 0,
    min: [0, 'Indirect income cannot be negative']
  },
  minReferrals: {
    type: Number,
    required: [true, 'Minimum referrals is required'],
    min: [0, 'Minimum referrals cannot be negative']
  },
  minRevenue: {
    type: Number,
    required: [true, 'Minimum revenue is required'],
    min: [0, 'Minimum revenue cannot be negative']
  },
  commissionPercent: {
    type: Number,
    required: [true, 'Commission percent is required'],
    min: [0, 'Commission percent cannot be negative'],
    max: [100, 'Commission percent cannot exceed 100']
  },
  bonusPerReferral: {
    type: Number,
    default: 0,
    min: [0, 'Bonus per referral cannot be negative']
  },
  perks: [{
    type: String,
    trim: true
  }],
  badge: {
    type: String,
    trim: true,
    default: null
  },
  badgeIcon: {
    type: String,
    trim: true,
    default: null
  },
  order: {
    type: Number,
    required: [true, 'Rank order is required'],
    min: [0, 'Rank order cannot be negative'],
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profitSharePercent: {
    type: Number,
    default: 0,
    min: [0, 'Profit share percent cannot be negative'],
    max: [100, 'Profit share percent cannot exceed 100']
  },
  copyTradingSharePercent: {
    type: Number,
    default: 0,
    min: [0, 'Copy trading share percent cannot be negative'],
    max: [100, 'Copy trading share percent cannot exceed 100']
  },
  color: {
    type: String,
    trim: true,
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

rankSchema.index({ isActive: 1 });
rankSchema.index({ minReferrals: 1 });
rankSchema.index({ minRevenue: 1 });

module.exports = mongoose.model('Rank', rankSchema);
