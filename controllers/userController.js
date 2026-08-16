const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const Subscription = require('../models/Subscription');
const UserRank = require('../models/UserRank');
const UserProgress = require('../models/UserProgress');
const Referral = require('../models/Referral');
const CoursePurchase = require('../models/CoursePurchase');
const Certificate = require('../models/Certificate');
const Support = require('../models/Support');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const CopyTrading = require('../models/CopyTrading');
const Quiz = require('../models/Quiz');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions, buildPaginationMeta } = require('../helpers/pagination');
const { sendAccountDeactivatedEmail } = require('../services/emailService');

exports.getUsers = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const search = req.query.search;
    const role = req.query.role;
    const isActive = req.query.isActive;
    const filter = {};
    if (search) filter.$or = [{ firstName: { $regex: search, $options: 'i' } }, { lastName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const total = await User.countDocuments(filter);
    const users = await User.find(filter).select('-password').sort(sort).skip((page - 1) * limit).limit(limit).lean();
    const userIds = users.map(u => u._id);
    const [wallets, userRanks] = await Promise.all([
      Wallet.find({ userId: { $in: userIds } }).lean(),
      UserRank.find({ userId: { $in: userIds } }).populate('currentRankId').lean(),
    ]);
    const walletMap = wallets.reduce((m, w) => { m[w.userId.toString()] = w; return m; }, {});
    const rankMap = userRanks.reduce((m, r) => { m[r.userId.toString()] = r; return m; }, {});
    const enriched = users.map(u => ({
      ...u,
      rankName: rankMap[u._id.toString()]?.currentRankId?.name || 'N/A',
      totalEarnings: walletMap[u._id.toString()]?.totalEarned || 0,
    }));
    sendPaginated(res, enriched, total, page, limit);
  } catch (error) {
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return sendError(res, 'User not found', 404);
    const wallet = await Wallet.findOne({ userId: user._id });
    const rank = await UserRank.findOne({ userId: user._id }).populate('currentRankId');
    const subscription = await Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 });
    sendSuccess(res, { user, wallet, rank, subscription });
  } catch (error) {
    next(error);
  }
};

const ALLOWED_UPDATE_FIELDS = ['firstName', 'lastName', 'phone', 'country', 'avatar', 'isActive', 'isEmailVerified', 'isApproved', 'address', 'dateOfBirth', 'bio'];

exports.adminUpdateUser = async (req, res, next) => {
  try {
    const updateData = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
    if (!user) return sendError(res, 'User not found', 404);
    if (req.body.isActive === false) {
      sendAccountDeactivatedEmail(user).catch((e) => console.error('[EMAIL] sendAccountDeactivatedEmail:', e.message));
    }
    sendSuccess(res, user, 'User updated');
  } catch (error) {
    next(error);
  }
};

exports.connectMT = async (req, res, next) => {
  try {
    const { accountNumber, server, platform } = req.body;
    const updateData = {};
    if (platform === 'MT4') {
      updateData['mt4Connection.accountId'] = accountNumber;
      updateData['mt4Connection.server'] = server;
      updateData['mt4Connection.isConnected'] = true;
      updateData['mt4Connection.lastSyncAt'] = new Date();
    } else {
      updateData['mt5Connection.accountId'] = accountNumber;
      updateData['mt5Connection.server'] = server;
      updateData['mt5Connection.isConnected'] = true;
      updateData['mt5Connection.lastSyncAt'] = new Date();
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-password');
    sendSuccess(res, user, 'MetaTrader account connected');
  } catch (error) {
    next(error);
  }
};

exports.disconnectMT = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, {
      'mt4Connection.isConnected': false,
      'mt4Connection.accountId': null,
      'mt4Connection.server': null,
      'mt5Connection.isConnected': false,
      'mt5Connection.accountId': null,
      'mt5Connection.server': null,
    }, { new: true }).select('-password');
    sendSuccess(res, user, 'MetaTrader account disconnected');
  } catch (error) {
    next(error);
  }
};

exports.markWhatsappClick = async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, whatsappClicked: { $ne: true } },
      { whatsappClicked: true, whatsappClickedAt: new Date() },
      { new: true }
    ).select('-password');
    sendSuccess(res, { alreadyClicked: !user, clicked: !!user }, user ? 'WhatsApp channel visited' : 'Already recorded');
  } catch (error) {
    next(error);
  }
};

exports.getDashboardStats = async (req, res, next) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const activeStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalRevenue = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const pendingApprovals = await Subscription.countDocuments({ status: 'pending' });
    const pendingWithdrawals = await (require('../models/Withdrawal')).countDocuments({ status: 'pending' });

    sendSuccess(res, {
      totalStudents,
      activeStudents,
      totalRevenue: totalRevenue[0]?.total || 0,
      pendingApprovals,
      pendingWithdrawals,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return sendError(res, 'User not found', 404);
    const userId = user._id;
    await Wallet.deleteMany({ userId });
    await WalletTransaction.deleteMany({ userId });
    await UserRank.deleteMany({ userId });
    await UserProgress.deleteMany({ userId });
    await Referral.deleteMany({ referrerId: userId });
    await Referral.deleteMany({ referredUserId: userId });
    await Subscription.deleteMany({ userId });
    await CoursePurchase.deleteMany({ userId });
    await Certificate.deleteMany({ userId });
    await Support.deleteMany({ userId });
    await Deposit.deleteMany({ userId });
    await Withdrawal.deleteMany({ userId });
    await CopyTrading.deleteMany({ userId });
    await Quiz.deleteMany({ 'attempts.userId': userId });
    sendSuccess(res, null, 'User and all associated records deleted successfully');
  } catch (error) { next(error); }
};
