const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[0-9\s\-\(\)]{7,20}$/, 'Please provide a valid phone number']
  },
  otpCode: {
    type: String,
    select: false,
    default: null
  },
  otpExpires: {
    type: Date,
    select: false,
    default: null
  },
  country: {
    type: String,
    trim: true,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'student'],
      message: '{VALUE} is not a valid role'
    },
    default: 'student'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  whatsappClicked: {
    type: Boolean,
    default: false
  },
  whatsappClickedAt: {
    type: Date,
    default: null
  },
  subscriptionStatus: {
    type: String,
    enum: {
      values: ['none', 'active', 'cancelled', 'expired'],
      message: '{VALUE} is not a valid subscription status'
    },
    default: 'none'
  },
  subscriptionExpiry: {
    type: Date,
    default: null
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralCount: {
    type: Number,
    default: 0
  },
  mt4Connection: {
    accountId: { type: String, default: null },
    server: { type: String, default: null },
    isConnected: { type: Boolean, default: false },
    lastSyncAt: { type: Date, default: null }
  },
  mt5Connection: {
    accountId: { type: String, default: null },
    server: { type: String, default: null },
    isConnected: { type: Boolean, default: false },
    lastSyncAt: { type: Date, default: null }
  },
  stripeCustomerId: {
    type: String,
    default: null,
    sparse: true
  },
  stripeSubscriptionId: {
    type: String,
    default: null
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ referredBy: 1 });
userSchema.index({ 'mt4Connection.accountId': 1 });
userSchema.index({ 'mt5Connection.accountId': 1 });

userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    }
  );
};

module.exports = mongoose.model('User', userSchema);
