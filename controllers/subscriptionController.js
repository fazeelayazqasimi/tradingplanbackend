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
const { debitWallet, runInTransaction } = require('../services/walletService');
const { processReferralCommission } = require('../services/referralService');
const { notifyStudentActivity } = require('../services/studentActivityService');

const businessError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const payReferralCommission = async (userId, amount, conversionType = 'subscription') => {
  try {
    await processReferralCommission(userId, amount, conversionType);
  } catch (e) {
    console.error('[REFERRAL] processReferralCommission:', e.message);
  }
};

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
      // The wallet balance is verified on the backend inside the same
      // transaction that deducts it, so double-spending is impossible.
      const sub = await runInTransaction(async (session) => {
        const existingSub = await Subscription.findOne({ userId: targetUserId, status: 'active' }).session(session);
        if (existingSub) throw businessError('This user already has an active subscription', 400);

        const fundingWallet = await Wallet.findOne({ userId: req.user._id, type: 'funding' }).session(session);
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
              session,
            });
          }
        }

        const remaining = amount - fundingUsed;
        const mainWallet = await Wallet.findOne({ userId: req.user._id, type: 'main' }).session(session);
        if (!mainWallet || mainWallet.availableBalance < remaining) {
          throw businessError('Insufficient main wallet balance. Please deposit first.', 400);
        }

        await debitWallet(req.user._id, {
          amount: remaining,
          category: 'subscription',
          description: purchasedForUserId
            ? `Subscription payment for referral (${plan} plan) - from main wallet`
            : `Subscription payment - ${plan} plan (from main wallet)`,
          referenceModel: 'Subscription',
          session,
        });

        return activateUserAndCreateSubscription(targetUserId, amount, 'wallet', {
          fundingUsed,
          mainUsed: remaining,
          plan: plan || 'yearly'
        }, plan || 'yearly', session);
      });

    await payReferralCommission(targetUserId, amount);
    const activatedUser = await User.findById(targetUserId).select('firstName lastName email');
    notifyStudentActivity({
      user: activatedUser || { _id: targetUserId, firstName: '', lastName: '', email: '' },
      action: 'account_activated',
      details: { method: 'wallet', amount, paid_by: req.user.email }
    });
    sendSuccess(res, sub, 'Subscription activated successfully via wallet', 201);
    } else {
      const sub = await Subscription.create({ userId: targetUserId, ...req.body, status: 'pending' });
      sendSuccess(res, sub, 'Subscription pending approval', 201);
    }
  } catch (error) {
    if (error.status) return sendError(res, error.message, error.status);
    next(error);
  }
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
    notifyStudentActivity({ user, action: 'account_activated', details: { method: 'admin_approval', amount: sub.amount } });
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
  return Math.max(0, Number(await Setting.getByKey('membership_price', 120)) || 0);
};

/**
 * Creates the subscription, activates the user and assigns the first rank.
 * When a `session` is provided all writes belong to the caller's transaction.
 * Referral commission is intentionally NOT handled here - callers must invoke
 * payReferralCommission() AFTER the transaction commits.
 */
const activateUserAndCreateSubscription = async (userId, amount, paymentMethod, metadata = {}, plan = 'yearly', session = null) => {
  const subOptions = session ? { session } : {};
  const [sub] = await Subscription.create([{
    userId,
    plan,
    amount,
    paymentMethod,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + (await getPlanDays(plan)) * 24 * 60 * 60 * 1000),
    transactionRef: `SUB-${paymentMethod.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    metadata,
  }], subOptions);

  await User.findByIdAndUpdate(userId, {
    isApproved: true,
    subscriptionStatus: 'active',
    subscriptionExpiry: sub.endDate
  }, session ? { session } : {});

  // Assign first rank if not exists
  try {
    const existingRank = await UserRank.findOne({ userId }).session(session);
    if (!existingRank) {
      const firstRank = await Rank.findOne({ isActive: true }).sort({ order: 1 }).session(session);
      if (firstRank) {
        await UserRank.create([{
          userId,
          currentRankId: firstRank._id,
          rankHistory: [{
            rankId: firstRank._id,
            achievedAt: new Date(),
            reason: `Assigned ${firstRank.name} on subscription activation`,
            changeType: 'automatic'
          }]
        }], subOptions);
      }
    }
  } catch (e) {
    console.error('[SUB] UserRank creation error:', e.message);
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

    if (!coupon.noCommission) {
      await payReferralCommission(req.user._id, amount);
    }

    const user = await User.findById(req.user._id);
    notifyStudentActivity({ user, action: 'account_activated', details: { method: 'pin', amount, coupon: coupon.code } });
    sendAccountApprovedEmail(user).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

    sendSuccess(res, { subscription: sub, coupon: { code: coupon.code, value: amount, noCommission: coupon.noCommission } }, 'Account activated successfully via PIN code', 201);
  } catch (error) { next(error); }
};

exports.activateWithBalance = async (req, res, next) => {
  try {
    const amount = await getActivationAmount();
    if (amount <= 0) return sendError(res, 'Activation amount not configured', 400);

    const fundingPercent = Number(await Setting.getByKey('funding_wallet_usage_percent', 20));
    const maxFundingUsage = Math.round((amount * fundingPercent) / 100);

    // Payment is fully covered by the wallet - no PIN is requested here.
    // Balance is verified on the backend and deducted atomically inside a
    // single transaction (with the subscription creation).
    const result = await runInTransaction(async (session) => {
      const existingSub = await Subscription.findOne({ userId: req.user._id, status: 'active' }).session(session);
      if (existingSub) throw businessError('Your account is already active', 400);

      const fundingWallet = await Wallet.findOne({ userId: req.user._id, type: 'funding' }).session(session);
      let fundingUsed = 0;
      if (fundingWallet && fundingWallet.availableBalance > 0) {
        fundingUsed = Math.min(fundingWallet.availableBalance, maxFundingUsage);
        if (fundingUsed > 0) {
          await debitWallet(req.user._id, {
            amount: fundingUsed,
            category: 'subscription',
            description: 'Account activation - from funding wallet',
            referenceModel: 'Subscription',
            walletType: 'funding',
            session,
          });
        }
      }

      const remaining = amount - fundingUsed;
      const mainWallet = await Wallet.findOne({ userId: req.user._id, type: 'main' }).session(session);
      if (!mainWallet || mainWallet.availableBalance < remaining) {
        const needed = remaining - (mainWallet?.availableBalance || 0);
        const msg = needed > 0
          ? `Insufficient balance. You need $${needed.toFixed(2)} more in your main wallet.`
          : `Insufficient main wallet balance. Activation requires $${amount}. Please deposit first.`;
        throw businessError(msg, 400);
      }

      await debitWallet(req.user._id, {
        amount: remaining,
        category: 'subscription',
        description: 'Account activation - from main wallet',
        referenceModel: 'Subscription',
        session,
      });

      const sub = await activateUserAndCreateSubscription(req.user._id, amount, 'wallet', { fundingUsed, mainUsed: remaining }, 'yearly', session);
      return { sub, fundingUsed, mainUsed: remaining };
    });

    await payReferralCommission(req.user._id, amount);

    const user = await User.findById(req.user._id);
    notifyStudentActivity({ user, action: 'account_activated', details: { method: 'wallet', amount, funding_used: result.fundingUsed, main_used: result.mainUsed } });
    sendAccountApprovedEmail(user).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

    sendSuccess(res, {
      subscription: result.sub,
      fundingUsed: result.fundingUsed,
      mainUsed: result.mainUsed
    }, 'Account activated successfully via wallet balance', 201);
  } catch (error) {
    if (error.status) return sendError(res, error.message, error.status);
    next(error);
  }
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
    if (amount <= 0) return sendError(res, 'Activation amount not configured. Please set the membership price in admin settings.', 400);
    const fundingPercent = Number(await Setting.getByKey('funding_wallet_usage_percent', 20));
    const maxFundingUsage = Math.round((amount * fundingPercent) / 100);

    const result = await runInTransaction(async (session) => {
      const freshDownline = await User.findById(downline._id).select('isApproved subscriptionStatus').session(session);
      if (freshDownline.isApproved && freshDownline.subscriptionStatus === 'active') {
        throw businessError('This member is already active', 400);
      }

      const fundingWallet = await Wallet.findOne({ userId: req.user._id, type: 'funding' }).session(session);
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
            session,
          });
        }
      }

      const remaining = amount - fundingUsed;
      const mainWallet = await Wallet.findOne({ userId: req.user._id, type: 'main' }).session(session);
      if (!mainWallet || mainWallet.availableBalance < remaining) {
        throw businessError(`Insufficient balance. You need $${remaining.toFixed(2)} more in your main wallet.`, 400);
      }

      await debitWallet(req.user._id, {
        amount: remaining,
        category: 'subscription',
        description: `Account activation for downline ${downline.firstName} ${downline.lastName} - from main wallet`,
        referenceModel: 'Subscription',
        session,
      });

      return activateUserAndCreateSubscription(
        downline._id,
        amount,
        'upline',
        { activatedBy: req.user._id, activatedByName: `${req.user.firstName} ${req.user.lastName}`, fundingUsed, mainUsed: remaining, originalAmount: amount, fundingPercent },
        'yearly',
        session
      );
    });

    await payReferralCommission(downline._id, amount);

    notifyStudentActivity({
      user: downline,
      action: 'account_activated',
      details: { method: 'upline', amount, activated_by: `${req.user.firstName} ${req.user.lastName}` }
    });

    sendAccountApprovedEmail(downline).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

    sendSuccess(res, {
      subscription: result,
      downline: { _id: downline._id, firstName: downline.firstName, lastName: downline.lastName, email: downline.email },
      fundingUsed: result.metadata?.fundingUsed || 0,
      mainUsed: result.metadata?.mainUsed || amount
    }, `Member ${downline.firstName} ${downline.lastName} activated successfully`, 201);
  } catch (error) {
    if (error.status) return sendError(res, error.message, error.status);
    next(error);
  }
};

exports.adminActivateStudent = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return sendError(res, 'User not found', 404);

    if (user.isApproved && user.subscriptionStatus === 'active') {
      return sendError(res, 'This user is already active', 400);
    }

    const amount = await getActivationAmount();
    const sub = await activateUserAndCreateSubscription(userId, amount, 'admin', { activatedBy: req.user._id, activatedByName: `${req.user.firstName} ${req.user.lastName}` });

    await payReferralCommission(userId, amount);

    notifyStudentActivity({
      user,
      action: 'account_activated',
      details: { method: 'admin', amount, activated_by: `${req.user.firstName} ${req.user.lastName}` }
    });

    sendAccountApprovedEmail(user).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

    sendSuccess(res, { subscription: sub, user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email } }, `User ${user.firstName} ${user.lastName} activated successfully by admin`, 201);
  } catch (error) { next(error); }
};
