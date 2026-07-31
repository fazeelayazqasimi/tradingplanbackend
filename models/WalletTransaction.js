const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: [true, 'Wallet ID is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  type: {
    type: String,
    enum: {
      values: ['credit', 'debit'],
      message: '{VALUE} is not a valid transaction type'
    },
    required: [true, 'Transaction type is required']
  },
  category: {
    type: String,
    enum: {
      values: [
        'direct_income',
        'indirect_income',
        'trading_profit',
        'bonus',
        'registration',
        'withdrawal',
        'purchase',
        'subscription',
        'refund',
        'adjustment',
        'commission',
        'deposit'
      ],
      message: '{VALUE} is not a valid transaction category'
    },
    required: [true, 'Transaction category is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  balanceAfter: {
    type: Number,
    required: [true, 'Balance after transaction is required'],
    min: [0, 'Balance after cannot be negative']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: null
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  referenceModel: {
    type: String,
    enum: {
      values: [
        'Referral',
        'Signal',
        'CopyTrading',
        'Withdrawal',
        'Subscription',
        'Course',
        'Assignment',
        'Quiz',
        'Certificate',
        'Deposit',
        'CoursePurchase',
        'User'
      ],
      message: '{VALUE} is not a valid reference model'
    },
    default: null
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed', 'reversed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'completed'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

walletTransactionSchema.index({ walletId: 1 });
walletTransactionSchema.index({ userId: 1 });
walletTransactionSchema.index({ type: 1 });
walletTransactionSchema.index({ category: 1 });
walletTransactionSchema.index({ status: 1 });
walletTransactionSchema.index({ createdAt: -1 });
walletTransactionSchema.index({ referenceId: 1 });
walletTransactionSchema.index({ userId: 1, category: 1 });
walletTransactionSchema.index({ walletId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
