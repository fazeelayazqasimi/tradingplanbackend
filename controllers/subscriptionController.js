const Subscription = require('../models/Subscription');
const User = require('../models/User');
const UserRank = require('../models/UserRank');
const Rank = require('../models/Rank');
const Wallet = require('../models/Wallet');
const Coupon = require('../models/Coupon');
const Setting = require('../models/Setting');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendAccountApprovedEmail } = require('../services/emailService');
const { debitWallet, creditWallet } = require('../services/walletService');
const { processReferralCommission } = require('../services/referralService');

const getPlanDays = async (plan) => {
  const setting = await Setting.findOne({ key: `plan_days_${plan}` });
  return (setting && Number(setting.value)) || 365;
};

const autoExpireSubscriptions = async () => {
  try {
    const now = new Date();
    const expired = await Subscription.updateMany(
      { status: 'active', endDate: { $lt: now } },
      { $set: { status: 'expired' } }
    );
    if (expired.modifiedCount > 0) {
      const expiredSubs = await Subscription.find({ status: 'expired', endDate: { $lt: now } }).limit(expired.modifiedCount);
      for (const sub of expiredSubs) {
        await User.findByIdAndUpdate(sub.userId, { subscriptionStatus: 'expired', isApproved: false });
      }
    }
  } catch (e) {
    console.error('[SUB] autoExpireSubscriptions error:', e.message);
  }
};

exports.getSubscriptions = async (req, res, next) => {
  try {
    await autoExpireSubscriptions();
    const { page, limit, sort } = getPaginationOptions(req.query);
    const status = req.query.status;
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    if (status) filter.status = status;
    const total = await Subscription.countDocuments(filter);
    const subs = await Subscription.find(filter).sort(sort || { createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'firstName lastName email');
    sendPaginated(res, subs, total, page, limit);
  } catch (error) { next(error); }
};

exports.getMySubscription = async (req, res, next) => {
  try {
    await autoExpireSubscriptions();
    const sub = await Subscription.findOne({ userId: req.user._id, status: { $in: ['active', 'pending'] } }).sort({ createdAt: -1 });
    sendSuccess(res, sub);
  } catch (error) { next(error); }
};

exports.createSubscription = async (req, res, next) => {
  try {
    const { plan, amount, paymentMethod, purchasedForUserId } = req.body;
    if (!plan || !amount) return sendError(res, 'Plan and amount are required', 400);

    const targetUserId = purchasedForUserId || req.user._id;

    if (paymentMethod === 'wallet') {
      const fundingWallet = await Wallet.findOne({ userId: req.user._id, type: 'funding' });
      const fundingPercent = await Setting.getByKey('funding_wallet_usage_percent', 20);
      const maxFundingUsage = (amount * fundingPercent) / 100;
      let fundingUsed = 0;

      if (fundingWallet && fundingWallet.availableBalance > 0) {
        fundingUsed = Math.min(fundingWallet.availableBalance, maxFundingUsage);
        if (fundingUsed > 0) {
          await debitWallet(req.user._id, {
            amount: fundingUsed,
            category: 'subscription',
            description: purchasedForUserId
              ? `Subscription payment for referral (${plan} plan) - from funding wallet`
              : `Subscription payment - ${plan} plan (from funding wallet)`,
            referenceModel: 'Subscription',
            walletType: 'funding',
          });
        }
      }

      const remaining = amount - fundingUsed;
      const mainWallet = await Wallet.findOne({ userId: req.user._id, type: 'main' });
      if (!mainWallet || mainWallet.availableBalance < remaining) {
        return sendError(res, 'Insufficient main wallet balance. Please deposit first.', 400);
      }

      await debitWallet(req.user._id, {
        amount: remaining,
        category: 'subscription',
        description: purchasedForUserId
          ? `Subscription payment for referral (${plan} plan) - from main wallet`
          : `Subscription payment - ${plan} plan (from main wallet)`,
        referenceModel: 'Subscription',
      });

      const sub = await Subscription.create({
        userId: targetUserId,
        plan,
        amount,
        paymentMethod: 'wallet',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + (await getPlanDays(plan)) * 24 * 60 * 60 * 1000),
        transactionRef: `SUB-WALLET-${Date.now().toString(36).toUpperCase()}`,
        metadata: { fundingUsed, mainUsed: remaining }
      });
      await User.findByIdAndUpdate(targetUserId, { isApproved: true, subscriptionStatus: 'active', subscriptionExpiry: sub.endDate });
      try {
        if (targetUserId.toString() === req.user._id.toString()) {
          await processReferralCommission(req.user._id, amount, 'subscription');
        }
      } catch (e) { console.error('[REFERRAL] processReferralCommission:', e.message); }
      sendSuccess(res, sub, 'Subscription activated successfully via wallet', 201);
    } else {
      const sub = await Subscription.create({ userId: targetUserId, ...req.body, status: 'pending' });
      sendSuccess(res, sub, 'Subscription pending approval', 201);
    }
  } catch (error) { next(error); }
};

exports.approveSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return sendError(res, 'Not found', 404);
    sub.status = 'active';
    sub.startDate = new Date();
    sub.endDate = new Date(Date.now() + (await getPlanDays(sub.plan)) * 24 * 60 * 60 * 1000);
    sub.approvedBy = req.user._id;
    sub.approvedAt = new Date();
    await sub.save();
    await User.findByIdAndUpdate(sub.userId, { isApproved: true, subscriptionStatus: 'active', subscriptionExpiry: sub.endDate });
    const user = await User.findById(sub.userId);
    sendAccountApprovedEmail(user).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));
    try {
      const result = await processReferralCommission(sub.userId, sub.amount, 'subscription');
      if (result) {
        sub.metadata = { ...sub.metadata, referralCommissions: result };
        await sub.save();
      }
    } catch (e) { console.error('[REFERRAL] processReferralCommission:', e.message); }
    sendSuccess(res, sub, 'Subscription approved');
  } catch (error) { next(error); }
};

exports.rejectSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findByIdAndUpdate(req.params.id, { status: 'cancelled', adminNote: req.body.adminNote }, { new: true });
    if (!sub) return sendError(res, 'Not found', 404);
    sendSuccess(res, sub, 'Subscription rejected');
  } catch (error) { next(error); }
};

exports.updateSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!sub) return sendError(res, 'Not found', 404);
    const userUpdate = {};
    if (req.body.status === 'active') {
      userUpdate.isApproved = true;
      userUpdate.subscriptionStatus = 'active';
    }
    if (req.body.endDate) {
      userUpdate.subscriptionExpiry = req.body.endDate;
    }
    if (Object.keys(userUpdate).length > 0) {
      await User.findByIdAndUpdate(sub.userId, userUpdate);
    }
    sendSuccess(res, sub, 'Subscription updated');
  } catch (error) { next(error); }
};

// Cancel disabled as per requirement — subscriptions cannot be cancelled by users

exports.deleteSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findByIdAndDelete(req.params.id);
    if (!sub) return sendError(res, 'Subscription not found', 404);
    sendSuccess(res, null, 'Subscription deleted');
  } catch (error) { next(error); }
};

const getActivationAmount = async () => {
  const setting = await Setting.findOne({ key: 'membership_price' });
  return (setting && Number(setting.value)) || 0;
};

const activateUserAndCreateSubscription = async (userId, amount, paymentMethod, metadata = {}) => {
  const plan = 'yearly';
  const sub = await Subscription.create({
    userId,
    plan,
    amount,
    paymentMethod,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + (await getPlanDays(plan)) * 24 * 60 * 60 * 1000),
    transactionRef: `SUB-${paymentMethod.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    metadata,
  });
  await User.findByIdAndUpdate(userId, { isApproved: true, subscriptionStatus: 'active', subscriptionExpiry: sub.endDate });

  // Assign D1 rank if not exists
  try {
    const existingRank = await UserRank.findOne({ userId });
    if (!existingRank) {
      const firstRank = await Rank.findOne({ isActive: true }).sort({ order: 1 });
      if (firstRank) {
        await UserRank.create({
          userId,
          currentRankId: firstRank._id,
          rankHistory: [{
            rankId: firstRank._id,
            achievedAt: new Date(),
            reason: `Assigned ${firstRank.name} on subscription activation`,
            changeType: 'automatic'
          }]
        });
      }
    }
  } catch (e) {
    console.error('[SUB] UserRank creation error:', e.message);
  }

  try {
    await processReferralCommission(userId, amount, 'subscription');
  } catch (e) {
    console.error('[REFERRAL] processReferralCommission:', e.message);
  }
  return sub;
};

exports.getActivationInfo = async (req, res, next) => {
  try {
    const membershipPrice = await Setting.getByKey('membership_price', 120);
    const uplineDiscount = await Setting.getByKey('upline_activation_discount', 20);
    const fundingPercent = await Setting.getByKey('funding_wallet_usage_percent', 20);
    sendSuccess(res, { membershipPrice: Number(membershipPrice), uplineActivationDiscount: Number(uplineDiscount), fundingPercent: Number(fundingPercent) });
  } catch (error) { next(error); }
};

exports.activateWithPin = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return sendError(res, 'PIN code is required', 400);

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), type: 'pin' });
    if (!coupon) return sendError(res, 'Invalid PIN code', 404);

    const validation = await coupon.isValid(req.user._id, 0);
    if (!validation.valid) return sendError(res, validation.reason, 400);

    if (coupon.usedBy.includes(req.user._id) || coupon.usedCount >= 1) {
      return sendError(res, 'This PIN code has expired', 400);
    }

    coupon.usedCount += 1;
    coupon.usedBy.push(req.user._id);
    coupon.isActive = false;
    await coupon.save();

    const amount = await getActivationAmount();
    const sub = await activateUserAndCreateSubscription(req.user._id, amount, 'pin', { couponCode: coupon.code, couponId: coupon._id });

    const user = await User.findById(req.user._id);
    sendAccountApprovedEmail(user).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

    sendSuccess(res, { subscription: sub, coupon: { code: coupon.code, value: amount } }, 'Account activated successfully via PIN code', 201);
  } catch (error) { next(error); }
};

exports.activateWithBalance = async (req, res, next) => {
  try {
    const amount = await getActivationAmount();

    const fundingWallet = await Wallet.findOne({ userId: req.user._id, type: 'funding' });
    const fundingPercent = await Setting.getByKey('funding_wallet_usage_percent', 20);
    const maxFundingUsage = (amount * fundingPercent) / 100;
    let fundingUsed = 0;

    if (fundingWallet && fundingWallet.availableBalance > 0) {
      fundingUsed = Math.min(fundingWallet.availableBalance, maxFundingUsage);
      if (fundingUsed > 0) {
        await debitWallet(req.user._id, {
          amount: fundingUsed,
          category: 'subscription',
          description: `Account activation - from funding wallet`,
          referenceModel: 'Subscription',
          walletType: 'funding',
        });
      }
    }

    const remaining = amount - fundingUsed;
    const mainWallet = await Wallet.findOne({ userId: req.user._id, type: 'main' });
    if (!mainWallet || mainWallet.availableBalance < remaining) {
      const needed = remaining - (mainWallet?.availableBalance || 0);
      const msg = mainWallet?.availableBalance < remaining
        ? `Insufficient balance. You need $${needed.toFixed(2)} more in your main wallet.`
        : `Insufficient main wallet balance. Activation requires $${amount}. Please deposit first.`;
      return sendError(res, msg, 400);
    }

    await debitWallet(req.user._id, {
      amount: remaining,
      category: 'subscription',
      description: `Account activation - from main wallet`,
      referenceModel: 'Subscription',
    });

    const sub = await activateUserAndCreateSubscription(req.user._id, amount, 'wallet', { fundingUsed, mainUsed: remaining });

    const user = await User.findById(req.user._id);
    sendAccountApprovedEmail(user).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

    sendSuccess(res, { subscription: sub, fundingUsed, mainUsed: remaining }, 'Account activated successfully via wallet balance', 201);
  } catch (error) { next(error); }
};

exports.activateByUpline = async (req, res, next) => {
  try {
    const { usernameOrEmail } = req.body;
    if (!usernameOrEmail) return sendError(res, 'Username or email is required', 400);

    const uplineUser = await User.findById(req.user._id);
    if (!uplineUser.isApproved || uplineUser.subscriptionStatus !== 'active') {
      return sendError(res, 'Your account must be active before you can activate downline members. Please activate your own account first.', 403);
    }

    const downline = await User.findOne({
      $or: [
        { email: usernameOrEmail.toLowerCase().trim() },
        { firstName: { $regex: new RegExp(`^${usernameOrEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      ],
    });
    if (!downline) return sendError(res, 'User not found', 404);

    if (!downline.referredBy || downline.referredBy.toString() !== req.user._id.toString()) {
      return sendError(res, 'This user is not your direct downline member', 403);
    }

    if (downline.isApproved && downline.subscriptionStatus === 'active') {
      return sendError(res, 'This member is already active', 400);
    }

    const amount = await getActivationAmount();
    const discountPercent = await Setting.getByKey('upline_activation_discount', 20);
    const discountedAmount = Math.round(amount * (100 - discountPercent) / 100);

    const fundingWallet = await Wallet.findOne({ userId: req.user._id, type: 'funding' });
    const fundingPercent = await Setting.getByKey('funding_wallet_usage_percent', 20);
    const maxFundingUsage = (discountedAmount * fundingPercent) / 100;
    let fundingUsed = 0;

    if (fundingWallet && fundingWallet.availableBalance > 0) {
      fundingUsed = Math.min(fundingWallet.availableBalance, maxFundingUsage);
      if (fundingUsed > 0) {
        await debitWallet(req.user._id, {
          amount: fundingUsed,
          category: 'subscription',
          description: `Account activation for downline ${downline.firstName} ${downline.lastName} - from funding wallet`,
          referenceModel: 'Subscription',
          walletType: 'funding',
        });
      }
    }

    const remaining = discountedAmount - fundingUsed;
    const mainWallet = await Wallet.findOne({ userId: req.user._id, type: 'main' });
    if (remaining > 0 && (!mainWallet || mainWallet.availableBalance < remaining)) {
      return sendError(res, `Insufficient balance. You need $${remaining} more in your wallet.`, 400);
    }

    if (remaining > 0) {
      await debitWallet(req.user._id, {
        amount: remaining,
        category: 'subscription',
        description: `Account activation for downline ${downline.firstName} ${downline.lastName} - from main wallet`,
        referenceModel: 'Subscription',
      });
    }

    const sub = await activateUserAndCreateSubscription(
      downline._id,
      amount,
      'upline',
      { activatedBy: req.user._id, activatedByName: `${req.user.firstName} ${req.user.lastName}`, fundingUsed, mainUsed: remaining, originalAmount: amount, discountPercent, discountedAmount }
    );

    sendAccountApprovedEmail(downline).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

    sendSuccess(res, { subscription: sub, downline: { _id: downline._id, firstName: downline.firstName, lastName: downline.lastName, email: downline.email }, fundingUsed, mainUsed: remaining }, `Member ${downline.firstName} ${downline.lastName} activated successfully`, 201);
  } catch (error) { next(error); }
};
