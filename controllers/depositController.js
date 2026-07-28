const Deposit = require('../models/Deposit');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { createCoinPayment, SUPPORTED_COINS } = require('../services/coinPaymentService');

exports.createDeposit = async (req, res, next) => {
  try {
    const { amount, paymentMethod, screenshot } = req.body;
    if (!amount || amount <= 0) return sendError(res, 'Valid amount is required', 400);

    const deposit = await Deposit.create({
      userId: req.user._id,
      amount: parseFloat(amount),
      paymentMethod: paymentMethod || 'usdt_bep20',
      status: 'pending',
      screenshot: screenshot || null,
    });

    if (paymentMethod === 'usdt_bep20' || paymentMethod?.startsWith('usdt_')) {
      try {
        const result = await createCoinPayment({ userId: req.user._id, amount: parseFloat(amount), coinType: 'USDT_BEP20', userName: req.user.firstName, userEmail: req.user.email });
        deposit.coinPaymentRef = result.payment.paymentRef;
        deposit.depositAddress = result.payment.depositAddress;
        deposit.coinType = 'USDT_BEP20';
        deposit.status = 'pending';
        deposit.expiresAt = result.payment.expiresAt;
        await deposit.save();
        return sendSuccess(res, { ...deposit.toObject(), paymentUrl: result.payment.qrcodeUrl, depositAddress: result.payment.depositAddress, coinPaymentTxnId: result.payment.txnId, expiresAt: result.payment.expiresAt }, 'Crypto deposit created. Send USDT to the provided address. Your wallet will be credited once the payment is confirmed.');
      } catch (cpErr) {
        console.error('[CoinPayments] createTransaction error:', cpErr.message);
        deposit.status = 'pending';
        deposit.payoutError = cpErr.message;
        await deposit.save();
        return sendSuccess(res, deposit, 'Crypto deposit requested. Awaiting payment confirmation.', 201);
      }
    }

    if (screenshot) {
      deposit.status = 'approved';
      deposit.processedBy = deposit.userId;
      deposit.processedAt = new Date();
      await deposit.save();
    }

    try {
      let wallet = await Wallet.findOne({ userId: deposit.userId, type: 'main' });
      if (!wallet) wallet = await Wallet.create({ userId: deposit.userId, type: 'main' });
      wallet.availableBalance += deposit.amount;
      wallet.totalEarned += deposit.amount;
      wallet.lastCreditAt = new Date();
      await wallet.save();

      await WalletTransaction.create({
        walletId: wallet._id, userId: deposit.userId,
        type: 'credit', category: 'deposit', amount: deposit.amount,
        balanceAfter: wallet.availableBalance,
        description: `Deposit approved automatically - ${deposit.amount} (main wallet)`,
        referenceId: deposit._id, referenceModel: 'Deposit', status: 'completed',
      });
    } catch (walletErr) {
      console.error('[DEPOSIT] Auto-credit wallet error:', walletErr.message);
    }

    return sendSuccess(res, deposit, 'Deposit approved and wallet credited', 201);
  } catch (error) { next(error); }
};

exports.getSupportedCoins = async (req, res, next) => {
  try {
    sendSuccess(res, { supportedCoins: SUPPORTED_COINS });
  } catch (error) { next(error); }
};

exports.verifyCryptoPayment = async (req, res, next) => {
  try {
    const { paymentRef } = req.body;
    if (!paymentRef) return sendError(res, 'Payment reference is required', 400);

    const deposit = await Deposit.findOne({ coinPaymentRef: paymentRef, userId: req.user._id });
    if (!deposit) return sendError(res, 'Deposit not found', 404);

    if (deposit.coinPaymentsTxnId && !deposit.webhookProcessed) {
      try {
        const txInfo = await require('../services/coinPaymentService').getTransactionInfo(deposit.coinPaymentsTxnId);
        deposit.confirmsReceived = txInfo.confirmsReceived;
        await deposit.save();
      } catch (e) {
        console.error('[CoinPayments] getTransactionInfo error:', e.message);
      }
    }

    sendSuccess(res, { deposit, status: deposit.status }, 'Payment status retrieved');
  } catch (error) { next(error); }
};

exports.getMyDeposits = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const filter = { userId: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    const total = await Deposit.countDocuments(filter);
    const deposits = await Deposit.find(filter)
      .populate('accountId', 'bankName accountHolderName accountNumber paymentType')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    sendPaginated(res, deposits, total, page, limit);
  } catch (error) { next(error); }
};

exports.getDepositById = async (req, res, next) => {
  try {
    const deposit = await Deposit.findById(req.params.id).populate('accountId', 'bankName accountHolderName accountNumber paymentType');
    if (!deposit) return sendError(res, 'Deposit not found', 404);
    if (req.user.role !== 'admin' && deposit.userId.toString() !== req.user._id.toString()) return sendError(res, 'Not authorized', 403);
    sendSuccess(res, deposit);
  } catch (error) { next(error); }
};

exports.getAllDeposits = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const users = await require('../models/User').find({
        $or: [
          { firstName: { $regex: req.query.search, $options: 'i' } },
          { lastName: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } }
        ]
      }).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
    }
    const total = await Deposit.countDocuments(filter);
    const deposits = await Deposit.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('accountId', 'bankName accountHolderName paymentType')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    sendPaginated(res, deposits, total, page, limit);
  } catch (error) { next(error); }
};

exports.approveDeposit = async (req, res, next) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return sendError(res, 'Deposit not found', 404);
    if (deposit.status !== 'pending') return sendError(res, 'Deposit already processed', 400);

    if (deposit.webhookProcessed) {
      deposit.processedBy = req.user._id;
      deposit.processedAt = new Date();
      if (req.body.adminNote) deposit.adminNote = req.body.adminNote;
      await deposit.save();
      return sendSuccess(res, deposit, 'Deposit already credited via webhook. Admin note saved.');
    }

    deposit.status = 'approved';
    deposit.processedBy = req.user._id;
    deposit.processedAt = new Date();
    if (req.body.adminNote) deposit.adminNote = req.body.adminNote;
    await deposit.save();

    const walletType = deposit.walletType || 'main';
    let wallet = await Wallet.findOne({ userId: deposit.userId, type: walletType });
    if (!wallet) wallet = await Wallet.create({ userId: deposit.userId, type: walletType });

    wallet.availableBalance += deposit.amount;
    wallet.lastCreditAt = new Date();
    await wallet.save();

    await WalletTransaction.create({
      walletId: wallet._id,
      userId: deposit.userId,
      type: 'credit',
      category: 'deposit',
      amount: deposit.amount,
      balanceAfter: wallet.availableBalance,
      description: `Deposit approved - ${deposit.amount} (${walletType} wallet)`,
      referenceId: deposit._id,
      referenceModel: 'Deposit',
      status: 'completed'
    });

    sendSuccess(res, deposit, 'Deposit approved and wallet credited');
  } catch (error) { next(error); }
};

exports.rejectDeposit = async (req, res, next) => {
  try {
    const deposit = await Deposit.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        processedBy: req.user._id,
        processedAt: new Date(),
        adminNote: req.body.adminNote || ''
      },
      { new: true }
    );
    if (!deposit) return sendError(res, 'Deposit not found', 404);
    if (deposit.status !== 'pending' && deposit.status !== 'rejected') {
      return sendError(res, 'Deposit was already processed', 400);
    }
    sendSuccess(res, deposit, 'Deposit rejected');
  } catch (error) { next(error); }
};

exports.deleteDeposit = async (req, res, next) => {
  try {
    const deposit = await Deposit.findByIdAndDelete(req.params.id);
    if (!deposit) return sendError(res, 'Deposit not found', 404);
    sendSuccess(res, null, 'Deposit deleted');
  } catch (error) { next(error); }
};
