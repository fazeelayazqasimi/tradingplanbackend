const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed', 'pin'],
    required: [true, 'Coupon type is required']
  },
  value: {
    type: Number,
    required: [true, 'Coupon value is required'],
    min: [0, 'Value cannot be negative']
  },
  minPurchase: {
    type: Number,
    default: 0,
    min: [0, 'Minimum purchase cannot be negative']
  },
  maxDiscount: {
    type: Number,
    default: null,
    min: [0, 'Max discount cannot be negative']
  },
  usageLimit: {
    type: Number,
    default: null,
    min: [1, 'Usage limit must be at least 1']
  },
  usedCount: {
    type: Number,
    default: 0,
    min: [0, 'Used count cannot be negative']
  },
  perUserLimit: {
    type: Number,
    default: 1,
    min: [1, 'Per user limit must be at least 1']
  },
  usedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  applicableTo: {
    type: String,
    enum: ['all', 'courses', 'subscriptions'],
    default: 'all'
  },
  courseIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  startsAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  noCommission: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

couponSchema.index({ isActive: 1, expiresAt: 1 });
couponSchema.index({ type: 1 });

couponSchema.methods.isValid = async function (userId, purchaseAmount) {
  if (!this.isActive) return { valid: false, reason: 'Coupon is deactivated' };
  if (this.expiresAt && new Date() > this.expiresAt) return { valid: false, reason: 'Coupon has expired' };
  if (this.startsAt && new Date() < this.startsAt) return { valid: false, reason: 'Coupon is not yet active' };
  if (this.usageLimit && this.usedCount >= this.usageLimit) return { valid: false, reason: 'Coupon usage limit reached' };
  if (purchaseAmount < this.minPurchase) return { valid: false, reason: `Minimum purchase amount of $${this.minPurchase} required` };
  if (this.perUserLimit && this.usedBy.includes(userId)) {
    const userUsage = this.usedBy.filter(id => id.toString() === userId.toString()).length;
    if (userUsage >= this.perUserLimit) return { valid: false, reason: 'You have already used this coupon' };
  }
  return { valid: true };
};

couponSchema.methods.calculateDiscount = function (purchaseAmount) {
  let discount = 0;
  if (this.type === 'percentage') {
    discount = (purchaseAmount * this.value) / 100;
    if (this.maxDiscount) discount = Math.min(discount, this.maxDiscount);
  } else if (this.type === 'fixed') {
    discount = Math.min(this.value, purchaseAmount);
  } else if (this.type === 'pin') {
    discount = this.value;
  }
  return Math.round(discount * 100) / 100;
};

module.exports = mongoose.model('Coupon', couponSchema);
