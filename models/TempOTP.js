const mongoose = require('mongoose');

const tempOTPSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  otp: { type: String, required: true },
  expires: { type: Date, required: true },
  purpose: { type: String, default: 'generic', index: true },
  verified: { type: Boolean, default: false },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

tempOTPSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TempOTP', tempOTPSchema);