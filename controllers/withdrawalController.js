const Withdrawal = require('../models/Withdrawal');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const Setting = require('../models/Setting');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendWithdrawalApprovedEmail } = require('../services/emailService');
const User = require('../models/User');
const { notifyStudentActivity } = require('../services/studentActivityService');

exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, paymentMethod, walletAddress, cryptocurrency } = req.body;
    if (!amount || amount <= 0) return sendError(res, 'Valid amount is required', 400);

    const method = (paymentMethod || 'usdt_bep20').trim();
    if (method !== 'usdt_bep20') return sendError(res, 'Only USDT BEP20 withdrawals are supported', 400);
    if (!walletAddress || !walletAddress.trim()) return sendError(res, 'Wallet address is required', 400);

    const wallet = await Wallet.findOne({ userId: req.user._id, type: 'main' });
    if (!wallet || wallet.availableBalance < amount) return sendError(res, 'Insufficient balance in main wallet', 400);
    if (amount < (wallet.minimumWithdrawal || 30)) return sendError(res, `Minimum withdrawal amount is $${wallet.minimumWithdrawal || 30}. You entered $${amount}`, 400);

    const maxAmountSetting = await Setting.findOne({ key: 'withdrawal_max_amount' }).lean();
    const maxAmount = maxAmountSetting?.value || null;
    if (maxAmount && amount > maxAmount) {
      return sendError(res, `Withdrawal amount exceeds the maximum allowed ($${maxAmount})`, 400);
    }

    const paymentDetails = { walletAddress: walletAddress.trim(), cryptocurrency: cryptocurrency || 'USDT' };

    const feeTypeSetting = await Setting.findOne({ key: 'withdrawal_fee_type' }).lean();
    const feePercentSetting = await Setting.findOne({ key: 'withdrawal_fee_percent' }).lean();
    const feeFixedSetting = await Setting.findOne({ key: 'withdrawal_fee_fixed' }).lean();
    const maxPercentSetting = await Setting.findOne({ key: 'withdrawal_max_percent' }).lean();

    const feeType = feeTypeSetting?.value || 'percent';
    const feePercent = Math.max(0, Math.min(100, Number(feePercentSetting?.value) || 0));
    const feeFixed = Math.max(0, Number(feeFixedSetting?.value) || 0);
    const maxPercent = Math.max(0, Math.min(100, Number(maxPercentSetting?.value) || 20));

    const maxAllowed = parseFloat((wallet.availableBalance * maxPercent / 100).toFixed(2));
    if (amount > maxAllowed) {
      return sendError(res, `Withdrawal amount exceeds the maximum allowed (${maxPercent}% of available balance: $${maxAllowed})`, 400);
    }

    let feeAmount;
    if (feeType === 'fixed') {
      feeAmount = feeFixed;
    } else {
      feeAmount = parseFloat(((amount * feePercent) / 100).toFixed(2));
    }
    feeAmount = Math.min(feeAmount, amount);
    const netAmount = parseFloat((amount - feeAmount).toFixed(2));

    wallet.availableBalance -= amount;
    wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + amount;
    wallet.lastWithdrawalAt = new Date();
    await wallet.save();

    const withdrawal = await Withdrawal.create({
      userId: req.user._id, amount, fee: feeAmount, netAmount,
      paymentMethod: method, cryptocurrency: 'USDT', network: 'BEP20',
      paymentDetails, status: 'pending', coinPaymentsTxnId: null,
    });

    await WalletTransaction.create({
      walletId: wallet._id, userId: req.user._id,
      type: 'debit', category: 'withdrawal', amount,
      balanceAfter: wallet.availableBalance,
      description: `Withdrawal request - ${amount} (fee: ${feeAmount})`,
      referenceId: withdrawal._id.toString(),
      referenceModel: 'Withdrawal', status: 'completed',
    });

    notifyStudentActivity({
      user: req.user,
      action: 'withdrawal_requested',
      details: { amount: `$${amount}`, fee: `$${feeAmount}`, net: `$${netAmount}`, method: method.toUpperCase() }
    });

    sendSuccess(res, withdrawal, `Withdrawal request submitted. Processing time is up to 24 hours. You will receive ${netAmount} USDT after deducting the withdrawal fee.`, 201);
  } catch (error) { next(error); }
};

exports.getWithdrawals = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const status = req.query.status;
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    if (status) filter.status = status;
    const total = await Withdrawal.countDocuments(filter);
    const withdrawals = await Withdrawal.find(filter).sort(sort || { createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'firstName lastName email');
    sendPaginated(res, withdrawals, total, page, limit);
  } catch (error) { next(error); }
};

exports.getWithdrawalFeeInfo = async (req, res, next) => {
  try {
    const feeTypeSetting = await Setting.findOne({ key: 'withdrawal_fee_type' }).lean();
    const feePercentSetting = await Setting.findOne({ key: 'withdrawal_fee_percent' }).lean();
    const feeFixedSetting = await Setting.findOne({ key: 'withdrawal_fee_fixed' }).lean();
    const maxPercentSetting = await Setting.findOne({ key: 'withdrawal_max_percent' }).lean();

    const feeType = feeTypeSetting?.value || 'percent';
    const feePercent = Math.max(0, Math.min(100, Number(feePercentSetting?.value) || 0));
    const feeFixed = Math.max(0, Number(feeFixedSetting?.value) || 0);
    const maxPercent = Math.max(0, Math.min(100, Number(maxPercentSetting?.value) || 20));

    sendSuccess(res, { feeType, feePercent, feeFixed, maxPercent, processingHours: 24 });
  } catch (error) { next(error); }
};

exports.approveWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return sendError(res, 'Not found', 404);
    if (withdrawal.status !== 'pending') return sendError(res, 'Withdrawal already processed', 400);

    // Balance was already deducted when the withdrawal was requested
    withdrawal.status = 'approved';
    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    const user = await User.findById(withdrawal.userId);
    if (user) sendWithdrawalApprovedEmail(user, withdrawal.netAmount ?? withdrawal.amount).catch((e) => console.error('[EMAIL] sendWithdrawalApprovedEmail:', e.message));
    sendSuccess(res, withdrawal, 'Withdrawal approved. Payout will be completed within 24 hours.');
  } catch (error) { next(error); }
};

exports.rejectWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return sendError(res, 'Not found', 404);
    if (withdrawal.status !== 'pending') return sendError(res, 'Withdrawal already processed', 400);
    withdrawal.status = 'rejected';
    withdrawal.adminNote = req.body.adminNote || '';
    withdrawal.processedBy = req.user._id;
    await withdrawal.save();

    // Refund the deducted amount back to the user's main wallet
    try {
      const wallet = await Wallet.findOne({ userId: withdrawal.userId, type: 'main' });
      if (wallet) {
        wallet.availableBalance += withdrawal.amount;
        wallet.totalWithdrawn = Math.max(0, (wallet.totalWithdrawn || 0) - withdrawal.amount);
        wallet.lastCreditAt = new Date();
        await wallet.save();
        await WalletTransaction.create({
          walletId: wallet._id,
          userId: withdrawal.userId,
          type: 'credit',
          category: 'refund',
          amount: withdrawal.amount,
          balanceAfter: wallet.availableBalance,
          description: `Withdrawal rejected - refund ${withdrawal.amount}`,
          referenceId: withdrawal._id,
          referenceModel: 'Withdrawal',
          status: 'completed',
        });
      }
    } catch (refundErr) {
      console.error('[WITHDRAWAL] Refund error:', refundErr.message);
    }

    sendSuccess(res, withdrawal, 'Withdrawal rejected and balance refunded');
  } catch (error) { next(error); }
};

exports.markPaid = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return sendError(res, 'Not found', 404);

    withdrawal.status = 'paid';
    withdrawal.paidAt = new Date();
    if (req.body.transactionRef) withdrawal.transactionRef = req.body.transactionRef;
    await withdrawal.save();
    sendSuccess(res, withdrawal, 'Marked as paid');
  } catch (error) { next(error); }
};

exports.deleteWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findByIdAndDelete(req.params.id);
    if (!withdrawal) return sendError(res, 'Withdrawal not found', 404);
    sendSuccess(res, null, 'Withdrawal deleted');
  } catch (error) { next(error); }
};
