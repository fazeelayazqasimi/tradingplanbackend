const Withdrawal = require('../models/Withdrawal');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendWithdrawalApprovedEmail } = require('../services/emailService');
const { createWithdrawal } = require('../services/coinPaymentService');
const User = require('../models/User');

exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, paymentMethod, walletAddress, cryptocurrency } = req.body;
    if (!amount || amount <= 0) return sendError(res, 'Valid amount is required', 400);

    const method = (paymentMethod || 'usdt_bep20').trim();
    if (method !== 'usdt_bep20') return sendError(res, 'Only USDT BEP20 withdrawals are supported', 400);
    if (!walletAddress || !walletAddress.trim()) return sendError(res, 'Wallet address is required', 400);

    const wallet = await Wallet.findOne({ userId: req.user._id, type: 'main' });
    if (!wallet || wallet.availableBalance < amount) return sendError(res, 'Insufficient balance in main wallet', 400);

    const paymentDetails = { walletAddress: walletAddress.trim(), cryptocurrency: cryptocurrency || 'USDT' };

    wallet.availableBalance -= amount;
    wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + amount;
    wallet.lastWithdrawalAt = new Date();
    await wallet.save();

    await WalletTransaction.create({
      walletId: wallet._id, userId: req.user._id,
      type: 'debit', category: 'withdrawal', amount,
      balanceAfter: wallet.availableBalance,
      description: `Withdrawal initiated - ${amount} (USDT BEP20)`,
      referenceId: paymentDetails.walletAddress.slice(-8),
      referenceModel: 'Withdrawal', status: 'completed',
    });

    const withdrawal = await Withdrawal.create({
      userId: req.user._id, amount,
      paymentMethod: method, cryptocurrency: 'USDT', network: 'BEP20',
      paymentDetails, status: 'processing', coinPaymentsTxnId: null,
    });

    try {
      const payout = await createWithdrawal({
        amount, coinType: 'USDT_BEP20',
        address: walletAddress.trim(),
        userId: req.user._id,
        paymentRef: withdrawal._id.toString(),
        autoConfirm: true,
      });
      withdrawal.coinPaymentsTxnId = payout.txnId;
      withdrawal.status = 'processing';
      await withdrawal.save();

      const user = await User.findById(req.user._id);
      if (user) sendWithdrawalApprovedEmail(user, amount).catch((e) => console.error('[EMAIL] sendWithdrawalApprovedEmail:', e.message));
      return sendSuccess(res, withdrawal, 'Withdrawal initiated. Crypto payout processing.', 201);
    } catch ( payoutErr ) {
      console.error('[CoinPayments] Withdrawal payout failed:', payoutErr.message);
      withdrawal.payoutError = payoutErr.message;
      withdrawal.status = 'failed';
      wallet.availableBalance += amount;
      wallet.totalWithdrawn -= amount;
      await wallet.save();
      await withdrawal.save();
      return sendError(res, `Payout failed: ${payoutErr.message}. Your balance has been restored.`, 500);
    }
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

exports.approveWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return sendError(res, 'Not found', 404);
    if (withdrawal.status !== 'pending') return sendError(res, 'Withdrawal already processed', 400);

    const wallet = await Wallet.findOne({ userId: withdrawal.userId, type: 'main' });
    if (!wallet || wallet.availableBalance < withdrawal.amount) return sendError(res, 'Insufficient balance', 400);

    const isCrypto = withdrawal.paymentMethod === 'crypto' || withdrawal.paymentMethod === 'usdt_bep20';

    withdrawal.status = 'approved';
    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    wallet.availableBalance -= withdrawal.amount;
    wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + withdrawal.amount;
    wallet.lastWithdrawalAt = new Date();
    await wallet.save();

    await WalletTransaction.create({
      walletId: wallet._id,
      userId: withdrawal.userId,
      type: 'debit',
      category: 'withdrawal',
      amount: withdrawal.amount,
      balanceAfter: wallet.availableBalance,
      description: `Withdrawal approved - ${withdrawal.amount}`,
      referenceId: withdrawal._id,
      referenceModel: 'Withdrawal',
      status: 'completed',
    });

    if (isCrypto && withdrawal.paymentDetails?.walletAddress) {
      try {
        withdrawal.status = 'processing';
        await withdrawal.save();

        const coinType = withdrawal.cryptocurrency === 'USDT' && withdrawal.network === 'BEP20'
          ? 'USDT_BEP20'
          : withdrawal.cryptocurrency;

        const payout = await createWithdrawal({
          amount: withdrawal.amount,
          coinType,
          address: withdrawal.paymentDetails.walletAddress,
          userId: withdrawal.userId,
          paymentRef: withdrawal._id.toString(),
          autoConfirm: true,
        });

        withdrawal.coinPaymentsTxnId = payout.txnId;
        withdrawal.status = 'processing';
        await withdrawal.save();

        sendSuccess(res, withdrawal, `Withdrawal approved and crypto payout initiated. Txn ID: ${payout.txnId}`);
        return;
      } catch (payoutError) {
        console.error('[CoinPayments] Payout failed:', payoutError.message);
        withdrawal.payoutError = payoutError.message;
        await withdrawal.save();

        sendSuccess(res, withdrawal, `Withdrawal approved. Payout failed: ${payoutError.message}. Process manually.`);
        return;
      }
    }

    const user = await User.findById(withdrawal.userId);
    if (user) sendWithdrawalApprovedEmail(user, withdrawal.amount).catch((e) => console.error('[EMAIL] sendWithdrawalApprovedEmail:', e.message));
    sendSuccess(res, withdrawal, 'Withdrawal approved');
  } catch (error) { next(error); }
};

exports.rejectWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return sendError(res, 'Not found', 404);
    withdrawal.status = 'rejected';
    withdrawal.adminNote = req.body.adminNote || '';
    withdrawal.processedBy = req.user._id;
    await withdrawal.save();
    sendSuccess(res, withdrawal, 'Withdrawal rejected');
  } catch (error) { next(error); }
};

exports.markPaid = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return sendError(res, 'Not found', 404);

    const isCrypto = withdrawal.paymentMethod === 'crypto' || withdrawal.paymentMethod === 'usdt_bep20';

    if (isCrypto && withdrawal.paymentDetails?.walletAddress && !withdrawal.coinPaymentsTxnId) {
      try {
        const coinType = withdrawal.cryptocurrency === 'USDT' && withdrawal.network === 'BEP20'
          ? 'USDT_BEP20'
          : withdrawal.cryptocurrency;

        const payout = await createWithdrawal({
          amount: withdrawal.amount,
          coinType,
          address: withdrawal.paymentDetails.walletAddress,
          userId: withdrawal.userId,
          paymentRef: withdrawal._id.toString(),
          autoConfirm: true,
        });

        withdrawal.coinPaymentsTxnId = payout.txnId;
        withdrawal.status = 'processing';
        withdrawal.paidAt = new Date();
        if (req.body.transactionRef) withdrawal.transactionRef = req.body.transactionRef;
        await withdrawal.save();

        sendSuccess(res, withdrawal, `Crypto payout initiated. Txn ID: ${payout.txnId}`);
        return;
      } catch (payoutError) {
        console.error('[CoinPayments] Payout failed:', payoutError.message);
        withdrawal.payoutError = payoutError.message;
        await withdrawal.save();
        sendError(res, `Payout failed: ${payoutError.message}`, 500);
        return;
      }
    }

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
