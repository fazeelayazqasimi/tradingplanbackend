const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const { getPaginationOptions } = require('../helpers/pagination');

const CATEGORY_FIELD_MAP = {
  direct_income: 'directIncome',
  indirect_income: 'indirectIncome',
  trading_profit: 'tradingProfit',
  bonus: 'bonus'
};

const creditWallet = async (userId, { amount, category, description, referenceId, referenceModel, metadata, walletType }) => {
  if (!amount || amount <= 0) {
    throw new Error('Credit amount must be greater than zero');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
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

    await session.commitTransaction();

    return { wallet, transaction: transaction[0] };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const debitWallet = async (userId, { amount, category, description, referenceId, referenceModel, walletType }) => {
  if (!amount || amount <= 0) {
    throw new Error('Debit amount must be greater than zero');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const walletTypeFinal = walletType || 'main';
    const wallet = await Wallet.findOne({ userId, type: walletTypeFinal }).session(session);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.isFrozen) {
      throw new Error('Wallet is frozen. Debits are temporarily disabled.');
    }

    if (wallet.availableBalance < amount) {
      throw new Error(`Insufficient balance. Available: $${wallet.availableBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`);
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

    await session.commitTransaction();

    return { wallet, transaction: transaction[0] };
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
  getTransactionHistory
};
