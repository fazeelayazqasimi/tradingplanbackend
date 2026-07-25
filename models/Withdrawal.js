const mongoose = require('mongoose');

const paymentDetailsSchema = new mongoose.Schema({
  accountNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Account number cannot exceed 50 characters'],
    default: null
  },
  accountName: {
    type: String,
    trim: true,
    maxlength: [200, 'Account name cannot exceed 200 characters'],
    default: null
  },
  bankName: {
    type: String,
    trim: true,
    maxlength: [200, 'Bank name cannot exceed 200 characters'],
    default: null
  },
  routingNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Routing number cannot exceed 50 characters'],
    default: null
  },
  swiftCode: {
    type: String,
    trim: true,
    maxlength: [20, 'SWIFT code cannot exceed 20 characters'],
    default: null
  },
  iban: {
    type: String,
    trim: true,
    maxlength: [50, 'IBAN cannot exceed 50 characters'],
    default: null
  },
  walletAddress: {
    type: String,
    trim: true,
    maxlength: [200, 'Wallet address cannot exceed 200 characters'],
    default: null
  },
  cryptoCurrency: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Crypto currency code cannot exceed 10 characters'],
    default: null
  },
  mobileNumber: {
    type: String,
    trim: true,
    maxlength: [30, 'Mobile number cannot exceed 30 characters'],
    default: null
  },
  provider: {
    type: String,
    trim: true,
    maxlength: [100, 'Provider cannot exceed 100 characters'],
    default: null
  }
}, { _id: false });

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Withdrawal amount is required'],
    min: [1, 'Withdrawal amount must be at least 1']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'processing', 'paid', 'failed'],
      message: '{VALUE} is not a valid withdrawal status'
    },
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['bank_transfer', 'paypal', 'crypto', 'mobile_money', 'other', 'usdt_bep20'],
      message: '{VALUE} is not a valid payment method'
    },
    required: [true, 'Payment method is required']
  },
  paymentDetails: {
    type: paymentDetailsSchema,
    required: [true, 'Payment details are required']
  },
  adminNote: {
    type: String,
    trim: true,
    maxlength: [1000, 'Admin note cannot exceed 1000 characters'],
    default: null
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  },
  transactionRef: {
    type: String,
    trim: true,
    maxlength: [200, 'Transaction reference cannot exceed 200 characters'],
    default: null
  },
  coinPaymentsTxnId: {
    type: String,
    trim: true,
    default: null
  },
  cryptocurrency: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  network: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  payoutError: {
    type: String,
    trim: true,
    default: null
  },
  fee: {
    type: Number,
    default: 0,
    min: [0, 'Fee cannot be negative']
  },
  netAmount: {
    type: Number,
    min: [0, 'Net amount cannot be negative']
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    default: null
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters'],
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [1000, 'Rejection reason cannot exceed 1000 characters'],
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

withdrawalSchema.index({ userId: 1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ paymentMethod: 1 });
withdrawalSchema.index({ createdAt: -1 });
withdrawalSchema.index({ processedBy: 1 });
withdrawalSchema.index({ userId: 1, status: 1 });

withdrawalSchema.pre('save', function (next) {
  if (this.isModified('amount') || this.isModified('fee')) {
    this.netAmount = this.amount - (this.fee || 0);
  }
  next();
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
