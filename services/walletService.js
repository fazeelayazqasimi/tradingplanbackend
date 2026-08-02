const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const { getPaginationOptions } = require('../helpers/pagination');

const CATEGORY_FIELD_MAP = {
  direct_income: 'directIncome',
  indirect_income: 'indirectIncome',
  trading_profit: 'tradingProfit',
  bonus: 'bonus',
  registration: 'bonus'
};

const isTransientError = (error) => {
  if (!error) return false;
  const codeName = error.codeName || '';
  const labels = (error.errorLabels || []).join(',');
  const msg = String(error.message || '').toLowerCase();
  return (
    codeName === 'WriteConflict' ||
    labels.includes('TransientTransactionError') ||
    error.code === 112 ||
    error.code === 11600 ||
    msg.includes('write conflict') ||
    msg.includes('transienttransactionerror')
  );
};

const runInTransaction = async (fn, { retries = 5 } = {}) => {
  let attempt = 0;
  while (true) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      try { await session.abortTransaction(); } catch (_) {}
      attempt++;
      if (attempt >= retries || !isTransientError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    } finally {
      session.endSession();
    }
  }
};

const creditWalletInternal = async (userId, opts, session) => {
  const { amount, category, description, referenceId, referenceModel, metadata, walletType } = opts;
  if (!amount || amount <= 0) {
    throw new Error('Credit amount must be greater than zero');
  }

  const walletTypeFinal = walletType || 'main';
  let wallet = await Wallet.findOne({ userId, type: walletTypeFinal }).session(session);
  if (!wallet) {
    wallet = await Wallet.findOneAndUpdate(
      { userId, type: walletTypeFinal },
      { $setOnInsert: { userId, type: walletTypeFinal } },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );
  }

  if (wallet.isFrozen) {
    throw new Error('Wallet is frozen. Credits are temporarily disabled.');
  }

  const balanceBefore = wallet.availableBalance;
  wallet.availableBalance += amount;
  wallet.totalEarned += amount;

  const categoryField = CATEGORY_FIELD_MAP[category];
  if (categoryField && wallet[categoryField] !== undefined) {
    wallet[categoryField] += amount;
  }

  wallet.lastCreditAt = new Date();
  await wallet.save({ session });

  const transaction = await WalletTransaction.create([{
    walletId: wallet._id,
    userId,
    type: 'credit',
    category,
    amount,
    balanceAfter: wallet.availableBalance,
    description,
    referenceId: referenceId || null,
    referenceModel: referenceModel || null,
    metadata: metadata || null,
    status: 'completed'
  }], { session });

  return { wallet, transaction: transaction[0], balanceBefore };
};

const creditWallet = async (userId, opts) => {
  if (opts && opts.session) {
    return creditWalletInternal(userId, opts, opts.session);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await creditWalletInternal(userId, opts, session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const debitWalletInternal = async (userId, opts, session) => {
  const { amount, category, description, referenceId, referenceModel, walletType } = opts;
  if (!amount || amount <= 0) {
    throw new Error('Debit amount must be greater than zero');
  }

  const walletTypeFinal = walletType || 'main';
  const wallet = await Wallet.findOne({ userId, type: walletTypeFinal }).session(session);
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  if (wallet.isFrozen) {
    throw new Error('Wallet is frozen. Debits are temporarily disabled.');
  }

  if (wallet.availableBalance < amount) {
    const error = new Error(`Insufficient balance. Available: $${wallet.availableBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`);
    error.code = 'INSUFFICIENT_BALANCE';
    throw error;
  }

  wallet.availableBalance -= amount;
  if (category === 'withdrawal') {
    wallet.totalWithdrawn += amount;
  }
  wallet.lastDebitAt = new Date();
  await wallet.save({ session });

  const transaction = await WalletTransaction.create([{
    walletId: wallet._id,
    userId,
    type: 'debit',
    category,
    amount,
    balanceAfter: wallet.availableBalance,
    description,
    referenceId: referenceId || null,
    referenceModel: referenceModel || null,
    status: 'completed'
  }], { session });

  return { wallet, transaction: transaction[0] };
};

const debitWallet = async (userId, opts) => {
  if (opts && opts.session) {
    return debitWalletInternal(userId, opts, opts.session);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await debitWalletInternal(userId, opts, session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getWalletBalance = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.findOneAndUpdate(
      { userId, type: 'main' },
      { $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  return wallet;
};

const getTransactionHistory = async (userId, { page, limit, category, type } = {}) => {
  const options = getPaginationOptions({ page, limit });

  const filter = { userId };
  if (category) filter.category = category;
  if (type) filter.type = type;

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(filter)
      .sort(options.sort)
      .skip(options.skip)
      .limit(options.limit)
      .lean(),
    WalletTransaction.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / options.limit);

  return {
    transactions,
    pagination: {
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
      hasNext: options.page < totalPages,
      hasPrev: options.page > 1
    }
  };
};

module.exports = {
  creditWallet,
  debitWallet,
  getWalletBalance,
  getTransactionHistory,
  runInTransaction
};
