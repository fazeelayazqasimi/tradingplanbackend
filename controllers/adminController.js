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

exports.logActivity = async (userId, action, entity, entityId, changes, req) => {
  try {
    await ActivityLog.create({ userId, action, entity, entityId, changes, ipAddress: req?.ip, userAgent: req?.get('user-agent') });
  } catch (e) { /* silent */ }
};
