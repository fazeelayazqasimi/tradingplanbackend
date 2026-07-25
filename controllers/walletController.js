const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getMyWallet = async (req, res, next) => {
  try {
    const type = req.query.type || 'main';
    let wallet = await Wallet.findOne({ userId: req.user._id, type });
    if (!wallet) wallet = await Wallet.create({ userId: req.user._id, type });
    sendSuccess(res, wallet);
  } catch (error) { next(error); }
};

exports.getAllMyWallets = async (req, res, next) => {
  try {
    let wallets = await Wallet.find({ userId: req.user._id }).sort({ type: 1 });
    if (wallets.length === 0) {
      const types = ['main', 'funding', 'ib'];
      wallets = await Wallet.insertMany(types.map(type => ({ userId: req.user._id, type })));
    }
    sendSuccess(res, wallets);
  } catch (error) { next(error); }
};

exports.getWalletByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!['main', 'funding', 'ib'].includes(type)) {
      return sendError(res, 'Invalid wallet type. Use: main, funding, or ib', 400);
    }
    let wallet = await Wallet.findOne({ userId: req.user._id, type });
    if (!wallet) wallet = await Wallet.create({ userId: req.user._id, type });
    sendSuccess(res, wallet);
  } catch (error) { next(error); }
};

exports.getTransactionHistory = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const category = req.query.category;
    const type = req.query.type;
    const filter = { userId: req.user._id };
    if (category) filter.category = category;
    if (type) filter.type = type;
    const total = await WalletTransaction.countDocuments(filter);
    const transactions = await WalletTransaction.find(filter).sort(sort || { createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    sendPaginated(res, transactions, total, page, limit);
  } catch (error) { next(error); }
};

exports.getWalletStats = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) return sendSuccess(res, { totalEarned: 0, totalWithdrawn: 0, available: 0, pending: 0, byCategory: {}, expenses: {} });
    const byCategory = await WalletTransaction.aggregate([
      { $match: { userId: req.user._id, type: 'credit' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]);
    const expenses = await WalletTransaction.aggregate([
      { $match: { userId: req.user._id, type: 'debit' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]);
    sendSuccess(res, {
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      available: wallet.availableBalance,
      pending: wallet.pendingBalance,
      byCategory: byCategory.reduce((a, c) => { a[c._id] = c.total; return a; }, {}),
      expenses: expenses.reduce((a, c) => { a[c._id] = c.total; return a; }, {})
    });
  } catch (error) { next(error); }
};

exports.getAllWallets = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.search) {
      const users = await require('../models/User').find({
        $or: [
          { firstName: { $regex: req.query.search, $options: 'i' } },
          { lastName: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
        ],
      }).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
    }
    const total = await Wallet.countDocuments(filter);
    const wallets = await Wallet.find(filter)
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    sendPaginated(res, wallets, total, page, limit);
  } catch (error) { next(error); }
};

exports.adminWalletStats = async (req, res, next) => {
  try {
    const totalWallets = await Wallet.countDocuments();
    const totalBalance = await Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$availableBalance' } } }]);
    const totalPending = await Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$pendingBalance' } } }]);
    const totalEarned = await Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$totalEarned' } } }]);
    const totalWithdrawn = await Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$totalWithdrawn' } } }]);
    sendSuccess(res, {
      totalWallets,
      totalBalance: totalBalance[0]?.total || 0,
      totalPending: totalPending[0]?.total || 0,
      totalEarned: totalEarned[0]?.total || 0,
      totalWithdrawn: totalWithdrawn[0]?.total || 0,
    });
  } catch (error) { next(error); }
};

exports.creditWallet = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, category, description, type } = req.body;
    if (!amount || amount <= 0) return sendError(res, 'Invalid amount', 400);
    const walletType = type || 'main';
    let wallet = await Wallet.findOne({ userId, type: walletType });
    if (!wallet) {
      wallet = await Wallet.findOneAndUpdate(
        { userId, type: walletType },
        { $setOnInsert: { userId, type: walletType } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    wallet.availableBalance += amount;
    wallet.totalEarned += amount;
    wallet.lastCreditAt = new Date();
    await wallet.save();
    await WalletTransaction.create({
      walletId: wallet._id,
      userId,
      amount,
      type: 'credit',
      category: category || 'bonus',
      balanceAfter: wallet.availableBalance,
      description: description || 'Admin credit',
      referenceModel: 'User',
      status: 'completed',
    });
    sendSuccess(res, wallet, 'Wallet credited');
  } catch (error) { next(error); }
};

exports.deleteWallet = async (req, res, next) => {
  try {
    const wallet = await Wallet.findByIdAndDelete(req.params.id);
    if (!wallet) return sendError(res, 'Wallet not found', 404);
    await WalletTransaction.deleteMany({ walletId: req.params.id });
    sendSuccess(res, null, 'Wallet deleted');
  } catch (error) { next(error); }
};
