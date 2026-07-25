const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Referrer ID is required']
  },
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Referred user ID is required']
  },
  referralCode: {
    type: String,
    required: [true, 'Referral code is required'],
    trim: true,
    uppercase: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'converted', 'paid'],
      message: '{VALUE} is not a valid referral status'
    },
    default: 'pending'
  },
  commissionAmount: {
    type: Number,
    default: 0,
    min: [0, 'Commission amount cannot be negative']
  },
  commissionPaid: {
    type: Number,
    default: 0,
    min: [0, 'Commission paid cannot be negative']
  },
  commissionPaidAt: {
    type: Date,
    default: null
  },
  level: {
    type: Number,
    default: 1,
    min: [1, 'Level must be at least 1'],
    max: [10, 'Level cannot exceed 10'],
    comment: '1 for direct referral, 2+ for indirect'
  },
  conversionType: {
    type: String,
    enum: {
      values: ['subscription', 'course', 'lifetime'],
      message: '{VALUE} is not a valid conversion type'
    },
    default: null
  },
  conversionAmount: {
    type: Number,
    default: 0,
    min: [0, 'Conversion amount cannot be negative']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

referralSchema.index({ referrerId: 1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ status: 1 });
referralSchema.index({ level: 1 });
referralSchema.index({ referrerId: 1, status: 1 });
referralSchema.index({ referrerId: 1, referredUserId: 1 }, { unique: true });

module.exports = mongoose.model('Referral', referralSchema);
