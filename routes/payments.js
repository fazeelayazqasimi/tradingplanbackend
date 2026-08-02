const router = require('express').Router();
const mongoose = require('mongoose');
const CoursePurchase = require('../models/CoursePurchase');
const Course = require('../models/Course');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const UserRank = require('../models/UserRank');
const Rank = require('../models/Rank');
const UserProgress = require('../models/UserProgress');
const { protect } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../helpers/response');
const { debitWallet, runInTransaction } = require('../services/walletService');
const { processReferralCommission } = require('../services/referralService');
const { sendAccountApprovedEmail } = require('../services/emailService');
const { notifyStudentActivity } = require('../services/studentActivityService');

const businessError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

router.post('/create-payment-intent', protect, async (req, res, next) => {
  try {
    const { courseId, broker, paymentMethod } = req.body;
    if (!courseId) return sendError(res, 'Course ID is required', 400);

    const course = await Course.findById(courseId);
    if (!course) return sendError(res, 'Course not found', 404);
    if (!course.isPublished) return sendError(res, 'Course not available', 400);

    const existing = await CoursePurchase.findOne({ userId: req.user._id, courseId, status: { $in: ['pending', 'active'] } });
    if (existing) return sendError(res, 'You already have a pending or active purchase for this course', 400);

    if (paymentMethod === 'wallet') {
      // The wallet balance is verified on the backend inside the same
      // transaction that deducts it. The debit happens BEFORE the purchase
      // is created, so a failed debit can never leave an unpaid "active"
      // purchase behind.
      const purchase = await runInTransaction(async (session) => {
        const already = await CoursePurchase.findOne({ userId: req.user._id, courseId, status: { $in: ['pending', 'active'] } }).session(session);
        if (already) throw businessError('You already have a pending or active purchase for this course', 400);

        const wallet = await Wallet.findOne({ userId: req.user._id, type: 'main' }).session(session);
        if (!wallet || wallet.availableBalance < course.price) {
          throw businessError('Insufficient wallet balance. Please deposit first.', 400);
        }

        await debitWallet(req.user._id, {
          amount: course.price,
          category: 'purchase',
          description: `Course purchase - ${course.title}`,
          referenceModel: 'CoursePurchase',
          session,
        });

        const transactionRef = `CP-WALLET-${Date.now().toString(36).toUpperCase()}`;
        const [newPurchase] = await CoursePurchase.create([{
          userId: req.user._id,
          courseId,
          amount: course.price || 0,
          broker: broker || 'dma',
          paymentMethod: 'wallet',
          status: 'active',
          transactionRef,
          approvedBy: req.user._id,
          approvedAt: new Date(),
          metadata: { courseTitle: course.title }
        }], { session });

        await Course.findByIdAndUpdate(courseId, { $inc: { totalStudents: 1 } }, { session });

        await User.findByIdAndUpdate(req.user._id, { isApproved: true }, { session });

        const existingRank = await UserRank.findOne({ userId: req.user._id }).session(session);
        if (!existingRank) {
          const firstRank = await Rank.findOne({ isActive: true }).sort({ order: 1 }).session(session);
          if (firstRank) {
            await UserRank.create([{
              userId: req.user._id,
              currentRankId: firstRank._id,
              rankHistory: [{
                rankId: firstRank._id,
                achievedAt: new Date(),
                reason: `Assigned ${firstRank.name} on course purchase via wallet`,
                changeType: 'automatic'
              }]
            }], { session });
          }
        }

        await UserProgress.findOneAndUpdate(
          { userId: req.user._id, courseId },
          { $setOnInsert: { userId: req.user._id, courseId, enrolledAt: new Date(), completedLessons: [], progress: 0, isCompleted: false } },
          { upsert: true, session }
        );

        return newPurchase;
      });

      try { await sendAccountApprovedEmail(req.user); } catch (e) { console.error('[EMAIL] sendAccountApprovedEmail:', e.message); }

      try {
        const result = await processReferralCommission(req.user._id, course.price, 'course');
        if (result) {
          purchase.metadata = { ...purchase.metadata, referralCommissions: result };
          await purchase.save();
        }
      } catch (e) { console.error('[REFERRAL] processReferralCommission:', e.message); }

      notifyStudentActivity({
        user: req.user,
        action: 'course_purchased',
        details: { course: course.title, amount: course.price || 0, method: 'wallet' }
      });

      sendSuccess(res, {
        purchase,
        transactionRef: purchase.transactionRef,
        amount: course.price || 0,
        message: 'Course activated successfully via wallet payment!'
      }, 'Course purchased', 201);
    } else {
      const transactionRef = `CP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const purchase = await CoursePurchase.create({
        userId: req.user._id,
        courseId,
        amount: course.price || 0,
        broker: broker || 'dma',
        paymentMethod: paymentMethod || 'card',
        status: 'pending',
        transactionRef,
        metadata: { courseTitle: course.title }
      });

      sendSuccess(res, {
        purchase,
        transactionRef,
        amount: course.price || 0,
        message: 'Payment initiated. Admin will verify and activate your course access.'
      }, 'Payment initiated', 201);
    }
  } catch (error) { next(error); }
});

router.post('/verify-payment', protect, async (req, res, next) => {
  try {
    const { transactionRef } = req.body;
    if (!transactionRef) return sendError(res, 'Transaction reference is required', 400);
    const purchase = await CoursePurchase.findOne({ transactionRef, userId: req.user._id });
    if (!purchase) return sendError(res, 'Purchase not found', 404);
    if (purchase.status !== 'pending') return sendError(res, 'Purchase already processed', 400);
    sendSuccess(res, { purchase, status: purchase.status }, 'Payment verification pending admin approval');
  } catch (error) { next(error); }
});

module.exports = router;
