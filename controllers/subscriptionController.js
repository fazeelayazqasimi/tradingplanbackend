const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Coupon = require('../models/Coupon');
const Setting = require('../models/Setting');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendAccountApprovedEmail } = require('../services/emailService');
const { debitWallet, creditWallet } = require('../services/walletService');
const { processReferralCommission } = require('../services/referralService');

const PLAN_DAYS = { monthly: 30, yearly: 365, lifetime: 36500 };

exports.getSubscriptions = async (req, res, next) => {
  try {
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
      // Check main wallet balance
      const mainWallet = await Wallet.findOne({ userId: req.user._id, type: 'main' });
      if (!mainWallet || mainWallet.availableBalance < amount) {
        return sendError(res, 'Insufficient main wallet balance. Please deposit first.', 400);
      }

      // Check funding wallet for potential usage
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

      // Remaining from main wallet
      const remaining = amount - fundingUsed;
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
        endDate: new Date(Date.now() + (PLAN_DAYS[plan] || 365) * 24 * 60 * 60 * 1000),
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
    sub.endDate = new Date(Date.now() + (PLAN_DAYS[sub.plan] || 365) * 24 * 60 * 60 * 1000);
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

exports.cancelSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ userId: req.user._id, status: 'active' });
    if (!sub) return sendError(res, 'No active subscription', 404);
    sub.status = 'cancelled';
    await sub.save();
    await User.findByIdAndUpdate(req.user._id, { subscriptionStatus: 'cancelled' });
    sendSuccess(res, sub, 'Subscription cancelled');
  } catch (error) { next(error); }
};

exports.deleteSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findByIdAndDelete(req.params.id);
    if (!sub) return sendError(res, 'Subscription not found', 404);
    sendSuccess(res, null, 'Subscription deleted');
  } catch (error) { next(error); }
};

const getActivationAmount = async () => {
  return Setting.getByKey('membership_price', 100);
};

const activateUserAndCreateSubscription = async (userId, amount, paymentMethod, metadata = {}) => {
  const sub = await Subscription.create({
    userId,
    plan: 'yearly',
    amount,
    paymentMethod,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    transactionRef: `SUB-${paymentMethod.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    metadata,
  });
  await User.findByIdAndUpdate(userId, { isApproved: true, subscriptionStatus: 'active', subscriptionExpiry: sub.endDate });
  try {
    await processReferralCommission(userId, amount, 'subscription');
  } catch (e) {
    console.error('[REFERRAL] processReferralCommission:', e.message);
  }
  return sub;
};

exports.activateWithPin = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return sendError(res, 'PIN code is required', 400);

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), type: 'pin' });
    if (!coupon) return sendError(res, 'Invalid PIN code', 404);

    const validation = await coupon.isValid(req.user._id, 0);
    if (!validation.valid) return sendError(res, validation.reason, 400);

    if (coupon.usedBy.includes(req.user._id)) {
      return sendError(res, 'You have already used this PIN code', 400);
    }

    coupon.usedCount += 1;
    coupon.usedBy.push(req.user._id);
    await coupon.save();

    const amount = coupon.value;
    const sub = await activateUserAndCreateSubscription(req.user._id, amount, 'pin', { couponCode: coupon.code, couponId: coupon._id });

    const user = await User.findById(req.user._id);
    sendAccountApprovedEmail(user).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

    sendSuccess(res, { subscription: sub, coupon: { code: coupon.code, value: coupon.value } }, 'Account activated successfully via PIN code', 201);
  } catch (error) { next(error); }
};

exports.activateWithBalance = async (req, res, next) => {
  try {
    const amount = await getActivationAmount();

    const mainWallet = await Wallet.findOne({ userId: req.user._id, type: 'main' });
    if (!mainWallet || mainWallet.availableBalance < amount) {
      return sendError(res, `Insufficient main wallet balance. Activation requires $${amount}. Please deposit first.`, 400);
    }

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

    const mainWallet = await Wallet.findOne({ userId: req.user._id, type: 'main' });
    if (!mainWallet || mainWallet.availableBalance < amount) {
      return sendError(res, `Insufficient balance. Activation requires $${amount} in your main wallet.`, 400);
    }

    await debitWallet(req.user._id, {
      amount,
      category: 'subscription',
      description: `Account activation for downline ${downline.firstName} ${downline.lastName}`,
      referenceModel: 'Subscription',
    });

    const sub = await activateUserAndCreateSubscription(
      downline._id,
      amount,
      'upline',
      { activatedBy: req.user._id, activatedByName: `${req.user.firstName} ${req.user.lastName}` }
    );

    sendAccountApprovedEmail(downline).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

    sendSuccess(res, { subscription: sub, downline: { _id: downline._id, firstName: downline.firstName, lastName: downline.lastName, email: downline.email } }, `Member ${downline.firstName} ${downline.lastName} activated successfully`, 201);
  } catch (error) { next(error); }
};
