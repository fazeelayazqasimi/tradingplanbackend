const mongoose = require('mongoose');

const paymentAccountSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true
  },
  accountHolderName: {
    type: String,
    required: [true, 'Account holder name is required'],
    trim: true
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    trim: true
  },
  iban: {
    type: String,
    trim: true,
    default: null
  },
  swiftCode: {
    type: String,
    trim: true,
    default: null
  },
  branchAddress: {
    type: String,
    trim: true,
    default: null
  },
  currency: {
    type: String,
    default: 'USD',
    trim: true,
    uppercase: true
  },
  paymentType: {
    type: String,
    enum: ['bank_transfer', 'crypto', 'mobile_money', 'other'],
    default: 'bank_transfer'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    default: null
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

paymentAccountSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('PaymentAccount', paymentAccountSchema);
