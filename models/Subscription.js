const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  plan: {
    type: String,
    enum: {
      values: ['monthly', 'yearly', 'lifetime'],
      message: '{VALUE} is not a valid plan'
    },
    required: [true, 'Subscription plan is required']
  },
  amount: {
    type: Number,
    required: [true, 'Subscription amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'active', 'cancelled', 'expired'],
      message: '{VALUE} is not a valid subscription status'
    },
    default: 'pending'
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['stripe', 'paypal', 'bank_transfer', 'crypto', 'other', 'wallet', 'pin', 'upline'],
      message: '{VALUE} is not a valid payment method'
    },
    required: [true, 'Payment method is required']
  },
  transactionRef: {
    type: String,
    trim: true,
    maxlength: [200, 'Transaction reference cannot exceed 200 characters'],
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    default: null
  },
  stripeSubscriptionId: {
    type: String,
    default: null,
    sparse: true
  },
  stripePaymentIntentId: {
    type: String,
    default: null
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

subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ plan: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ autoRenew: 1 });
subscriptionSchema.index({ userId: 1, status: 1 });


subscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && (!this.endDate || this.endDate > new Date());
});

subscriptionSchema.virtual('daysRemaining').get(function () {
  if (!this.endDate) return null;
  const now = new Date();
  const diff = this.endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
