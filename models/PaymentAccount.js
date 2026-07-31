const mongoose = require('mongoose');

const isCrypto = function () {
  return this.paymentType === 'crypto';
};

const paymentAccountSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true
  },
  accountHolderName: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: function (v) {
        return isCrypto.call(this) ? true : !!v;
      },
      message: 'Account holder name is required'
    }
  },
  accountNumber: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: function (v) {
        return isCrypto.call(this) ? true : !!v;
      },
      message: 'Account number is required'
    }
  },
  walletAddress: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: function (v) {
        return isCrypto.call(this) ? !!v : true;
      },
      message: 'Wallet address is required'
    }
  },
  network: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'BEP20'
  },
  qrCodeUrl: {
    type: String,
    trim: true,
    default: null
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
