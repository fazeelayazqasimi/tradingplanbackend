const User = require('../models/User');
const Subscription = require('../models/Subscription');
const CoursePurchase = require('../models/CoursePurchase');
const Course = require('../models/Course');
const Signal = require('../models/Signal');
const Withdrawal = require('../models/Withdrawal');
const Deposit = require('../models/Deposit');
const Wallet = require('../models/Wallet');
const Referral = require('../models/Referral');
const ActivityLog = require('../models/ActivityLog');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getDashboard = async (req, res, next) => {
  try {
    const [
      totalStudents,
      approvedStudents,
      unapprovedStudents,
      activeSubscriptions,
      totalCourses,
      totalSignals,
      pendingCoursePurchases,
      depositStats,
      withdrawalStats,
      walletStats,
      referralStats,
      subscriptionRevenue,
      totalRevenueResult,
      monthlyRevenueResult,
      recentDeposits,
      recentWithdrawals,
      recentSubscriptions,
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', isApproved: true }),
      User.countDocuments({ role: 'student', isApproved: false }),
      Subscription.countDocuments({ status: 'active' }),
      Course.countDocuments(),
      Signal.countDocuments(),
      CoursePurchase.countDocuments({ status: 'pending' }),
      Deposit.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $in: ['$status', ['failed', 'expired']] }, 1, 0] } },
            pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
            approvedAmount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] } },
          },
        },
      ]),
      Withdrawal.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
            paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
            paidAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          },
        },
      ]),
      Wallet.aggregate([
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$availableBalance' },
            totalPending: { $sum: '$pendingBalance' },
            totalEarned: { $sum: '$totalEarned' },
            totalWithdrawn: { $sum: '$totalWithdrawn' },
            walletCount: { $sum: 1 },
          },
        },
      ]),
      Referral.aggregate([
        {
          $group: {
            _id: null,
            totalReferrals: { $sum: 1 },
            convertedCount: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
            totalCommission: { $sum: '$commissionAmount' },
          },
        },
      ]),
      Subscription.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CoursePurchase.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CoursePurchase.aggregate([
        { $match: { status: 'active', createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Deposit.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'firstName lastName email').lean(),
      Withdrawal.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'firstName lastName email').lean(),
      Subscription.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'firstName lastName email').lean(),
    ]);

    const d = depositStats[0] || { total: 0, totalAmount: 0, pending: 0, approved: 0, rejected: 0, failed: 0, pendingAmount: 0, approvedAmount: 0 };
    const w = withdrawalStats[0] || { total: 0, totalAmount: 0, pending: 0, approved: 0, processing: 0, paid: 0, rejected: 0, failed: 0, pendingAmount: 0, paidAmount: 0 };
    const wall = walletStats[0] || { totalBalance: 0, totalPending: 0, totalEarned: 0, totalWithdrawn: 0, walletCount: 0 };
    const ref = referralStats[0] || { totalReferrals: 0, convertedCount: 0, totalCommission: 0 };

    const recentActivity = [
      ...recentDeposits.map((d) => ({
        description: `Deposit ${d.status === 'approved' ? 'credited' : 'requested'} — ${d.userId?.firstName || 'User'} ${d.userId?.lastName || ''} ($${d.amount})`,
        timestamp: d.createdAt,
        type: 'deposit',
        status: d.status,
      })),
      ...recentWithdrawals.map((w) => ({
        description: `Withdrawal ${w.status} — ${w.userId?.firstName || 'User'} ${w.userId?.lastName || ''} ($${w.amount})`,
        timestamp: w.createdAt,
        type: 'withdrawal',
        status: w.status,
      })),
      ...recentSubscriptions.map((s) => ({
        description: `Subscription ${s.status} — ${s.userId?.firstName || 'User'} ${s.userId?.lastName || ''} (${s.plan})`,
        timestamp: s.createdAt,
        type: 'subscription',
        status: s.status,
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

    sendSuccess(res, {
      totalStudents,
      approvedStudents,
      unapprovedStudents,
      activeSubscriptions,
      pendingApprovals: pendingCoursePurchases,
      pendingCoursePurchases,
      totalCourses,
      totalSignals,
      totalRevenue: totalRevenueResult[0]?.total || 0,
      subscriptionRevenue: subscriptionRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenueResult[0]?.total || 0,
      deposits: d,
      withdrawals: w,
      wallets: wall,
      referrals: ref,
      recentActivity,
    });
  } catch (error) { next(error); }
};

exports.getRevenueReport = async (req, res, next) => {
  try {
    const { period = 'monthly' } = req.query;
    const groupBy = period === 'daily'
      ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }
      : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
    const report = await CoursePurchase.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: groupBy, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
      { $limit: 24 },
    ]);
    sendSuccess(res, report);
  } catch (error) { next(error); }
};

exports.getActivityLogs = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const total = await ActivityLog.countDocuments();
    const logs = await ActivityLog.find().sort(sort || { createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'firstName lastName email');
    sendPaginated(res, logs, total, page, limit);
  } catch (error) { next(error); }
};

exports.getReferrals = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.search) {
      const users = await User.find({
        $or: [
          { firstName: { $regex: req.query.search, $options: 'i' } },
          { lastName: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
        ],
      }).select('_id');
      filter.$or = [
        { referrerId: { $in: users.map(u => u._id) } },
        { referredUserId: { $in: users.map(u => u._id) } },
      ];
    }
    const total = await Referral.countDocuments(filter);
    const referrals = await Referral.find(filter)
      .sort(sort || { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('referrerId', 'firstName lastName email')
      .populate('referredUserId', 'firstName lastName email isApproved subscriptionStatus')
      .lean();
    const mapped = referrals.map(r => ({
      _id: r._id,
      referrer: r.referrerId,
      referredUser: r.referredUserId,
      referralCode: r.referralCode,
      level: r.level,
      status: r.status,
      commission: r.commissionAmount,
      createdAt: r.createdAt,
    }));
    sendPaginated(res, mapped, total, page, limit);
  } catch (error) { next(error); }
};

exports.getReferralStats = async (req, res, next) => {
  try {
    const totalReferrals = await Referral.countDocuments();
    const paid = await Referral.aggregate([
      { $match: { status: { $in: ['converted', 'paid'] } } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const pending = await Referral.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const activeReferrals = await Referral.countDocuments({ status: { $in: ['converted', 'paid'] } });
    const freeReferrals = await Referral.countDocuments({ status: 'pending' });
    sendSuccess(res, {
      totalReferrals,
      totalCommissionsPaid: paid[0]?.total || 0,
      pendingCommissions: pending[0]?.total || 0,
      activeReferrals,
      freeReferrals,
    });
  } catch (error) { next(error); }
};

const buildTree = async (userId, currentLevel = 1, maxDepth = 10) => {
  if (currentLevel > maxDepth || !userId) return [];
  const referrals = await Referral.find({ referrerId: userId, level: 1 })
    .populate('referredUserId', 'firstName lastName email createdAt isApproved subscriptionStatus')
    .lean();
  const nodes = [];
  for (const ref of referrals) {
    if (!ref.referredUserId) continue;
    const children = await buildTree(ref.referredUserId._id, currentLevel + 1, maxDepth);
    nodes.push({
      _id: ref._id,
      user: ref.referredUserId,
      level: currentLevel,
      status: ref.status,
      commission: ref.commissionAmount,
      conversionType: ref.conversionType,
      conversionAmount: ref.conversionAmount,
      createdAt: ref.createdAt,
      children,
    });
  }
  return nodes;
};

exports.getReferralTree = async (req, res, next) => {
  try {
    const { userId } = req.query;
    const users = [];
    if (userId) {
      const u = await User.findById(userId).select('firstName lastName email');
      if (!u) return sendError(res, 'User not found', 404);
      const tree = await buildTree(userId);
      sendSuccess(res, {
        user: u,
        tree,
        stats: {
          totalDownline: countNodes(tree),
          active: countActive(tree),
          free: countFree(tree),
        },
      });
    } else {
      const referrers = await Referral.distinct('referrerId');
      for (const id of referrers) {
        const u = await User.findById(id).select('firstName lastName email');
        if (u) {
          const tree = await buildTree(id);
          users.push({
            user: u,
            tree,
            stats: {
              totalDownline: countNodes(tree),
              active: countActive(tree),
              free: countFree(tree),
            },
          });
        }
      }
      sendSuccess(res, { users });
    }
  } catch (error) { next(error); }
};

const countNodes = (nodes) => nodes.reduce((s, n) => s + 1 + countNodes(n.children || []), 0);
const countActive = (nodes) => nodes.reduce((s, n) => s + ((n.user?.isApproved && n.user?.subscriptionStatus === 'active') ? 1 : 0) + countActive(n.children || []), 0);
const countFree = (nodes) => nodes.reduce((s, n) => s + ((!n.user?.isApproved || n.user?.subscriptionStatus !== 'active') ? 1 : 0) + countFree(n.children || []), 0);

exports.getReferralById = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id)
      .populate('referrerId', 'firstName lastName email')
      .populate('referredUserId', 'firstName lastName email isApproved subscriptionStatus')
      .lean();
    if (!referral) return sendError(res, 'Referral not found', 404);
    sendSuccess(res, {
      ...referral,
      referrer: referral.referrerId,
      referredUser: referral.referredUserId,
    });
  } catch (error) { next(error); }
};

exports.logActivity = async (userId, action, entity, entityId, changes, req) => {
  try {
    await ActivityLog.create({ userId, action, entity, entityId, changes, ipAddress: req?.ip, userAgent: req?.get('user-agent') });
  } catch (e) { /* silent */ }
};
