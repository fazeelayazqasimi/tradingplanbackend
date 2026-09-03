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
    const [wallets, userRanks, referrals] = await Promise.all([
      Wallet.find({ userId: { $in: userIds } }).lean(),
      UserRank.find({ userId: { $in: userIds } }).populate('currentRankId').lean(),
      Referral.find({ referredUserId: { $in: userIds } }).lean(),
    ]);
    const walletMap = wallets.reduce((m, w) => { m[w.userId.toString()] = w; return m; }, {});
    const rankMap = userRanks.reduce((m, r) => { m[r.userId.toString()] = r; return m; }, {});
    const referralMap = referrals.reduce((m, r) => {
      m[r.referredUserId.toString()] = r.referrerId.toString();
      return m;
    }, {});
    const referrerIds = [...new Set(Object.values(referralMap).filter(Boolean))];
    const referrerNames = {};
    if (referrerIds.length > 0) {
      const referrerUsers = await User.find({ _id: { $in: referrerIds } }).select('firstName lastName');
      referrerUsers.forEach(u => {
        referrerNames[u._id.toString()] = `${u.firstName} ${u.lastName}`;
      });
    }
    const enriched = users.map(u => ({
      ...u,
      rankName: rankMap[u._id.toString()]?.currentRankId?.name || 'N/A',
      totalEarnings: walletMap[u._id.toString()]?.totalEarned || 0,
      referralCode: u.referralCode || '',
      upline: referralMap[u._id.toString()] || null,
      referrerName: referrerNames[u._id.toString()] || null,
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

const ALLOWED_UPDATE_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'country', 'avatar', 'isActive', 'isEmailVerified', 'isApproved', 'address', 'dateOfBirth', 'bio'];

exports.adminUpdateUser = async (req, res, next) => {
  try {
    const updateData = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    // Validate email uniqueness when an admin changes it (exclude the target user).
    if (updateData.email) {
      const normalizedEmail = updateData.email.toString().trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: req.params.id } });
      if (existing) return sendError(res, 'Email is already in use by another account', 400);
      updateData.email = normalizedEmail;
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

exports.getStudentDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const isPremium = req.user.subscriptionStatus === 'active';

    // Every sub-query is wrapped so a single failing lookup can NEVER
    // the whole dashboard. Failures degrade to empty defaults and are logged for
    // diagnosis, keeping the dashboard fast and always rendering.
    const safe = async (promise, fallback) => {
      try {
        const value = await promise;
        return value === undefined ? fallback : value;
      } catch (err) {
        console.error('[DASHBOARD] sub-query failed:', err.message);
        return fallback;
      }
    };

    // Ensure UserRank document exists (same logic as getMyRank)
    let userRankDoc = await UserRank.findOne({ userId }).lean();
    if (!userRankDoc) {
      const Rank = require('../models/Rank');
      const defaultRank = await Rank.findOne({ isActive: true }).sort({ order: 1 });
      if (defaultRank) {
        userRankDoc = await UserRank.create({ userId, currentRankId: defaultRank._id });
      }
    }

    // Populate currentRankId
    const rankPopulated = userRankDoc ? await UserRank.findOne({ userId }).populate('currentRankId', 'name').lean() : null;

    const MarketOverview = require('./marketOverviewController');
    const Webinar = require('../models/Webinar');
    const ZoomSession = require('../models/ZoomSession');
    const MarketUpdate = require('../models/MarketUpdate');
    const Announcement = require('../models/Announcement');
    const Course = require('../models/Course');
    const CopyTrading = require('../models/CopyTrading');
    const BusinessProfile = require('../models/BusinessProfile');
    const Signal = require('../models/Signal');
    const { getDownlineMembers } = require('../controllers/referralController');

    const [
      enrolled,
      signals,
      wallets,
      rank,
      downlineRaw,
      referralCode,
      marketOverview,
      openSignalsCount,
      freeWebinars,
      freeZoomSessions,
      marketUpdates,
      announcements,
      freeCourses,
      copyStats,
      businessProfiles,
      commissionAgg,
      freeRegAgg,
    ] = await Promise.all([
      safe(UserProgress.find({ userId }).populate({ path: 'courseId', select: 'title slug thumbnail level category totalLessons' }).limit(3).lean(), []),
      safe(Signal.find({ isPublished: true }).sort({ createdAt: -1 }).limit(5).select('title symbol side isPublished createdAt').lean(), []),
      safe(Wallet.find({ userId }).lean(), []),
      safe(UserRank.findOne({ userId }).populate('currentRankId', 'name').lean(), null),
      safe(getDownlineMembers(userId), []),
      safe(User.findById(userId).select('referralCode').lean(), null),
      safe(MarketOverview.getMarketOverviewInternal(), {}),
      safe(Signal.countDocuments({ isPublished: true, status: 'open' }), 0),
      safe(Webinar.find({ isFree: true, isPublished: true }).sort({ date: -1 }).limit(5).select('title date publishedAt summary description').lean(), []),
      safe(ZoomSession.find({ category: 'free-zoom', isPublished: true }).sort({ date: -1 }).limit(5).select('title date publishedAt summary description').lean(), []),
      safe(MarketUpdate.find({ isPublished: true }).sort({ createdAt: -1 }).limit(5).select('title createdAt summary description').lean(), []),
      safe(Announcement.find({ isPublished: true }).sort({ createdAt: -1 }).limit(5).select('title createdAt content').lean(), []),
      safe(Course.find({ isFree: true }).sort({ order: -1 }).limit(5).select('title slug thumbnail level category totalLessons').lean(), []),
      safe(CopyTrading.aggregate([
        { $match: { userId } },
        { $group: { _id: null, totalTrades: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } }, totalProfit: { $sum: '$profit' }, openTrades: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0 ] } } } },
      ]), []),
      safe(BusinessProfile.find({ isPublished: true }).select('title fileUrl fileName').lean(), []),
      safe(Referral.aggregate([
        { $match: { referrerId: userId, status: { $in: ['converted', 'paid'] } } },
        { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
      ]), []),
      safe(WalletTransaction.aggregate([
        { $match: { userId, category: 'registration' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]), []),
    ]);

    const walletList = wallets || [];
    const mainWallet = walletList.find(w => w.type === 'main') || { availableBalance: 0, pendingBalance: 0 };
    const fundingWallet = walletList.find(w => w.type === 'funding') || { availableBalance: 0 };
    const ws = { available: mainWallet.availableBalance || 0, pending: mainWallet.pendingBalance || 0 };
    const downline = downlineRaw || [];
    const isActiveMemberFn = (u) => !!(u && u.isApproved && u.subscriptionStatus === 'active');
    const directRef = downline.filter(m => m.depth === 1).length;
    const indirectRef = downline.filter(m => m.depth >= 2).length;
    const activeMem = downline.filter(m => isActiveMemberFn(m.ref?.referredUserId)).length;
    const r = {
      totalReferrals: downline.length,
      directReferrals: directRef,
      indirectReferrals: indirectRef,
      freeMembers: downline.length - activeMem,
      activeReferrals: activeMem,
      totalCommission: (commissionAgg[0]?.total || 0),
      freeRegistrationEarnings: freeRegAgg[0]?.total || 0,
    };
    const cp = copyStats[0] || { totalTrades: 0, wins: 0, totalProfit: 0, openTrades: 0 };

    const Rank = require('../models/Rank');

// Compute next rank info
    let nextRank = null;
    try {
      if (rankPopulated?.currentRankId?._id) {
        const currentRankId = rankPopulated.currentRankId._id;
        const currentRank = await Rank.findById(currentRankId).lean();
        if (currentRank) {
          const allRanks = await Rank.find({}).sort({ order: 1, name: 1 }).lean();
          const currentIndex = allRanks.findIndex(r => r._id.toString() === currentRankId.toString());
          if (currentIndex >= 0 && currentIndex < allRanks.length - 1) {
            nextRank = {
              name: allRanks[currentIndex + 1].name,
              minDirectReferrals: allRanks[currentIndex + 1].minDirectReferrals || 0,
              minTeamSize: allRanks[currentIndex + 1].minTeamSize || 0,
            };
          }
}
      }
    } catch (err) {
      console.error('[DASHBOARD] Next rank computation error:', err.message);
    }

    sendSuccess(res, {
      isPremium,
      enrolled: enrolled?.map(e => e.courseId).filter(Boolean) || [],
      signals,
      walletData: mainWallet,
      fundingWalletData: fundingWallet,
      walletStats: ws,
      rank,
      nextRank,
      referralStats: r,
      referralCode: referralCode?.referralCode || '',
      marketOverview,
      openSignalsCount,
      freeWebinars,
      freeZoomSessions,
      marketUpdates,
      announcements,
      freeCourses,
      copyStats: cp,
      businessProfiles,
    });
  } catch (error) {
    console.error('[DASHBOARD] handler error:', error.message);
    const isPremium = req.user?.subscriptionStatus === 'active';
    sendSuccess(res, {
      isPremium,
      enrolled: [],
      signals: [],
      walletData: { availableBalance: 0, pendingBalance: 0 },
      fundingWalletData: { availableBalance: 0 },
      walletStats: { available: 0, pending: 0 },
      rank: null,
      nextRank: null,
      referralStats: { totalReferrals: 0, directReferrals: 0, indirectReferrals: 0, freeMembers: 0, activeReferrals: 0, totalCommission: 0, freeRegistrationEarnings: 0 },
      referralCode: '',
      marketOverview: {},
      openSignalsCount: 0,
      freeWebinars: [],
      freeZoomSessions: [],
      marketUpdates: [],
      announcements: [],
      freeCourses: [],
      copyStats: { totalTrades: 0, wins: 0, totalProfit: 0, openTrades: 0 },
      businessProfiles: [],
    });
  }
};
