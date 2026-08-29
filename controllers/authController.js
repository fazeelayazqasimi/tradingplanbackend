const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const UserRank = require('../models/UserRank');
const Rank = require('../models/Rank');
const Referral = require('../models/Referral');
const Setting = require('../models/Setting');
const { checkAndPromoteRank } = require('../services/rankService');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendSuccess, sendError } = require('../helpers/response');
const { sendWelcomeEmail, sendVerificationEmail, sendReferralSignupEmail, sendOTPEmail } = require('../services/emailService');
const { generateReferralCode, processReferralCommission } = require('../services/referralService');
const { creditWallet } = require('../services/walletService');
const { sendSMS } = require('../services/smsService');
const { notifyStudentActivity } = require('../services/studentActivityService');

// Helper: generate JWT tokens
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '15d' });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });
};

// Helper: send token response
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  const userData = user.toObject();
  delete userData.password;
  delete userData.passwordResetToken;
  delete userData.passwordResetExpires;
  sendSuccess(res, { user: userData, token, refreshToken }, message, statusCode);
};

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, name, email, password, phone, country, referralCode } = req.body;

    const userFirstName = firstName || (name ? name.trim().split(' ')[0] : '');
    const userLastName = lastName || (name && name.trim().includes(' ') ? name.trim().split(' ').slice(1).join(' ') : userFirstName);

    if (!userFirstName) {
      return sendError(res, 'First name is required', 400);
    }

    const normalizedEmail = normalizeEmail(email);
    console.log(`[REGISTER] raw body email: "${email}" normalized: "${normalizedEmail}"`);
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.log(`[REGISTER] DUPLICATE: "${normalizedEmail}" matched user ${existingUser._id}`);
      return sendError(res, 'Email already registered', 400);
    }

    let referredBy = null;
    if (referralCode) {
      const normalizedCode = String(referralCode).trim().toUpperCase();
      const referrer = await User.findOne({ referralCode: normalizedCode });
      if (referrer) referredBy = referrer._id;
    }

    const userReferralCode = await generateReferralCode(userFirstName);

    const user = await User.create({
      firstName: userFirstName,
      lastName: userLastName,
      email: normalizedEmail,
      password,
      phone,
      country,
      referralCode: userReferralCode,
      referredBy,
    });

    // Create wallets for new user (main, funding, ib)
    // Use findOneAndUpdate with upsert to avoid 11000 duplicate key errors
    // from stale unique indexes (e.g. old userId_1 index on wallets collection)
    const walletTypes = ['main', 'funding', 'ib'];
    for (const type of walletTypes) {
      await Wallet.findOneAndUpdate(
        { userId: user._id, type },
        { $setOnInsert: { userId: user._id, type } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    // Assign D1 rank to new user
    try {
      const lowestRank = await Rank.findOne({ isActive: true }).sort({ order: 1 });
      if (lowestRank) {
        await UserRank.create({
          userId: user._id,
          currentRankId: lowestRank._id,
          rankHistory: [{
            rankId: lowestRank._id,
            achievedAt: new Date(),
            reason: `Assigned ${lowestRank.name} on registration`,
            changeType: 'automatic'
          }]
        });
      }
    } catch (e) {
      console.error('[REGISTER] UserRank creation error:', e.message);
    }

    // Registration referral bonus (admin-configurable amount): credited to upline's funding wallet
    if (referredBy) {
      try {
        const bonusEnabled = await Setting.getByKey('free_registration_bonus_enabled', 'true');
        if (bonusEnabled === 'true' || bonusEnabled === true) {
          const bonusAmount = Number(await Setting.getByKey('free_registration_bonus_amount', 1)) || 0;
          if (bonusAmount > 0) {
            await creditWallet(referredBy, {
              amount: bonusAmount,
              category: 'registration',
              description: `Registration referral bonus for referring ${userFirstName} ${userLastName}`,
              referenceModel: 'User',
              referenceId: user._id,
              walletType: 'funding',
            });
          }
        }
      } catch (e) {
        console.error('[REGISTER] free registration bonus error:', e.message);
      }
    }

    // Process referral commission if referred
    if (referredBy) {
      await Referral.create({
        referrerId: referredBy,
        referredUserId: user._id,
        referralCode,
        status: 'pending',
        level: 1,
        notes: 'Free registration - pending activation',
      });
      const referrer = await User.findById(referredBy);
      if (referrer) {
        sendReferralSignupEmail(referrer, user).catch((e) => console.error('[EMAIL] sendReferralSignupEmail:', e.message));
      }
    }

    // Mark email as verified since OTP was already verified before registration
    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user).catch((e) => console.error('[EMAIL] sendWelcomeEmail:', e.message));

    notifyStudentActivity({
      user,
      action: 'registration',
      details: { email: user.email, referred_by: referredBy ? 'yes' : 'no' }
    });

    sendTokenResponse(user, 201, res, 'Registration successful.');
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return sendError(res, 'Invalid credentials', 401);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return sendError(res, 'Invalid credentials', 401);

    if (!user.isActive) return sendError(res, 'Account has been deactivated', 403);

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    if (user.role === 'student') {
      notifyStudentActivity({
        user,
        action: 'login',
        details: { email: user.email, ip: req.ip || null }
      });
    }

    sendTokenResponse(user, 200, res, 'Login successful');
  } catch (error) {
    next(error);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return sendError(res, 'Refresh token is required', 400);

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch {
      return sendError(res, 'Invalid or expired refresh token', 401);
    }

    const user = await User.findById(decoded.id);
    if (!user) return sendError(res, 'User not found', 404);
    if (!user.isActive) return sendError(res, 'Account has been deactivated', 403);

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    sendSuccess(res, { token: newToken, refreshToken: newRefreshToken }, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('referredBy', 'firstName lastName email referralCode');
    sendSuccess(res, user, 'Profile retrieved');
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalized = normalizeEmail(email);

    const user = await User.findOne({ email: normalized });
    if (!user) {
      return sendSuccess(res, null, 'If this email is registered, an OTP has been sent');
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    const TempOTP = require('../models/TempOTP');
    await TempOTP.findOneAndUpdate(
      { email: normalized, purpose: 'password-reset' },
      { email: normalized, otp, expires, purpose: 'password-reset', verified: false, usedAt: null },
      { upsert: true, new: true }
    );

    const result = await sendOTPEmail(normalized, otp);
    if (!result.success) {
      console.error('[FORGOT-PASSWORD] Failed to send OTP email:', result.error);
    }

    sendSuccess(res, null, 'If this email is registered, an OTP has been sent');
  } catch (error) {
    next(error);
  }
};

exports.verifyResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalized = normalizeEmail(email);

    const TempOTP = require('../models/TempOTP');
    const record = await TempOTP.findOne({ email: normalized, purpose: 'password-reset' });

    if (!record) return sendError(res, 'No OTP found. Please request a new one.', 400);
    if (record.verified) return sendError(res, 'OTP has already been used. Please request a new one.', 400);
    if (record.expires < new Date()) {
      await TempOTP.deleteOne({ _id: record._id });
      return sendError(res, 'OTP expired. Please request a new one.', 400);
    }
    if (record.otp !== otp) return sendError(res, 'Invalid OTP', 400);

    const user = await User.findOne({ email: normalized });
    if (!user) {
      await TempOTP.deleteOne({ _id: record._id });
      return sendError(res, 'No account found for this email', 400);
    }

    record.verified = true;
    record.usedAt = new Date();
    await record.save();

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    sendSuccess(res, { resetToken }, 'OTP verified. You can now reset your password.');
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, email, password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const normalized = normalizeEmail(email);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) return sendError(res, 'Invalid or expired reset token', 400);
    if (user.email !== normalized) return sendError(res, 'Invalid or expired reset token', 400);

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const TempOTP = require('../models/TempOTP');
    await TempOTP.deleteOne({ email: normalized, purpose: 'password-reset' });

    notifyStudentActivity({ user, action: 'password_reset', details: { email: user.email } });

    sendSuccess(res, null, 'Password reset successful. You can now log in.');
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) return sendError(res, 'Current password is incorrect', 400);

    user.password = req.body.newPassword;
    await user.save();

    notifyStudentActivity({ user: req.user, action: 'password_changed', details: { email: req.user.email } });

    sendTokenResponse(user, 200, res, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    // Normal users may NOT change their email or phone from the profile page.
    // Only admins may change email/phone (via the admin user-management endpoint).
    const { firstName, lastName, country } = req.body;
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (country) updateData.country = country;
    if (req.file) updateData.avatar = `/uploads/avatars/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true }).select('-password');
    notifyStudentActivity({ user: req.user, action: 'profile_updated', details: updateData });
    sendSuccess(res, user, 'Profile updated');
  } catch (error) {
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });
    if (!user) return sendError(res, 'Invalid or expired verification token', 400);

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    sendSuccess(res, null, 'Email verified successfully');
  } catch (error) {
    next(error);
  }
};

exports.resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return sendError(res, 'User not found', 404);
    if (user.isEmailVerified) return sendError(res, 'Email already verified', 400);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    sendVerificationEmail(user, verificationUrl).catch((e) => console.error('[EMAIL] sendVerificationEmail:', e.message));

    sendSuccess(res, null, 'Verification email resent');
  } catch (error) {
    next(error);
  }
};

exports.bootstrapAdmin = async (req, res, next) => {
  try {
    const { email, secret } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);

    const user = await User.findOne({ email });
    if (!user) return sendError(res, 'Register this user first', 404);

    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return sendError(res, 'Valid ADMIN_SECRET is required to promote a user to admin', 403);
    }

    user.role = 'admin';
    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });
    return sendSuccess(res, null, `${email} is now admin`);
  } catch (error) {
    next(error);
  }
};

// Normalize email to prevent fake registrations (Gmail dots, +aliases)
const normalizeEmail = (email) => {
  let normalized = email.toLowerCase().trim();
  const parts = normalized.split('@');
  if (parts.length !== 2) return normalized;
  let local = parts[0];
  const domain = parts[1];
  // Gmail: ignore dots and anything after +
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '').split('+')[0];
  }
  return `${local}@${domain}`;
};

exports.sendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);

    const normalized = normalizeEmail(email);
    const existing = await User.findOne({ email: normalized });
    if (existing) return sendError(res, 'Email already registered', 400);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 60 * 1000);

    const TempOTP = require('../models/TempOTP');
    await TempOTP.findOneAndUpdate(
      { email: normalized },
      { email: normalized, otp, expires },
      { upsert: true, new: true }
    );

    const result = await sendOTPEmail(email, otp);
    if (!result.success) {
      return sendError(res, `Failed to send OTP: ${result.error}`, 500);
    }
    sendSuccess(res, null, 'OTP sent to email');
  } catch (error) {
    next(error);
  }
};

exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return sendError(res, 'Email and OTP are required', 400);

    const normalized = normalizeEmail(email);
    const TempOTP = require('../models/TempOTP');
    const record = await TempOTP.findOne({ email: normalized });

    if (!record) return sendError(res, 'No OTP found. Please request a new one.', 400);
    if (record.expires < new Date()) {
      await TempOTP.deleteOne({ _id: record._id });
      return sendError(res, 'OTP expired. Please request a new one.', 400);
    }
    if (record.otp !== otp) return sendError(res, 'Invalid OTP', 400);

    await TempOTP.deleteOne({ _id: record._id });
    sendSuccess(res, null, 'OTP verified');
  } catch (error) {
    next(error);
  }
};

exports.sendPhoneOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return sendError(res, 'Phone number is required', 400);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 300 * 1000);

    const TempOTP = require('../models/TempOTP');
    await TempOTP.findOneAndUpdate(
      { email: `phone:${phone}` },
      { email: `phone:${phone}`, otp, expires },
      { upsert: true, new: true }
    );

    const brandName = 'The4xHub';
    const message = `Your ${brandName} verification code is: ${otp}. Valid for 5 minutes.`;

    await sendSMS(phone, message);

    sendSuccess(res, null, 'OTP sent to your phone');
  } catch (error) {
    next(error);
  }
};

exports.verifyPhoneOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return sendError(res, 'Phone and OTP are required', 400);

    const TempOTP = require('../models/TempOTP');
    const record = await TempOTP.findOne({ email: `phone:${phone}` });

    if (!record) return sendError(res, 'No OTP found. Please request a new one.', 400);
    if (record.expires < new Date()) {
      await TempOTP.deleteOne({ _id: record._id });
      return sendError(res, 'OTP expired. Please request a new one.', 400);
    }
    if (record.otp !== otp) return sendError(res, 'Invalid OTP', 400);

    // Update user's phone
    const user = await User.findByIdAndUpdate(req.user._id, { phone }, { new: true }).select('-password');
    await TempOTP.deleteOne({ _id: record._id });

    sendSuccess(res, { user }, 'Phone number updated successfully');
  } catch (error) {
    next(error);
  }
};

exports.changeEmail = async (req, res, next) => {
  try {
    const { newEmail, otp } = req.body;
    if (!newEmail || !otp) return sendError(res, 'New email and OTP are required', 400);

    const normalized = newEmail.toLowerCase().trim();
    const existing = await User.findOne({ email: normalized });
    if (existing && existing._id.toString() !== req.user._id.toString()) {
      return sendError(res, 'Email already in use', 400);
    }

    const TempOTP = require('../models/TempOTP');
    const record = await TempOTP.findOne({ email: normalized });

    if (!record) return sendError(res, 'No OTP found. Please request a new one.', 400);
    if (record.expires < new Date()) {
      await TempOTP.deleteOne({ _id: record._id });
      return sendError(res, 'OTP expired. Please request a new one.', 400);
    }
    if (record.otp !== otp) return sendError(res, 'Invalid OTP', 400);

    const user = await User.findByIdAndUpdate(req.user._id, { email: normalized, isEmailVerified: true }, { new: true }).select('-password');
    await TempOTP.deleteOne({ _id: record._id });

    notifyStudentActivity({ user: req.user, action: 'email_changed', details: { old_email: req.user.email, new_email: normalized } });

    sendSuccess(res, { user }, 'Email changed successfully');
  } catch (error) {
    next(error);
  }
};
