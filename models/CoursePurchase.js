const mongoose = require('mongoose');

const coursePurchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  broker: {
    type: String,
    enum: {
      values: ['dma', 'startrading'],
      message: '{VALUE} is not a valid broker'
    },
    default: 'dma'
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'active', 'rejected'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['stripe', 'paypal', 'bank_transfer', 'crypto', 'card', 'wallet'],
      message: '{VALUE} is not a valid payment method'
    },
    default: 'card'
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
  adminNote: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters'],
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

coursePurchaseSchema.index({ userId: 1 });
coursePurchaseSchema.index({ courseId: 1 });
coursePurchaseSchema.index({ status: 1 });
coursePurchaseSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('CoursePurchase', coursePurchaseSchema);
