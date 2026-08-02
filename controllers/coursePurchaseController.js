const CoursePurchase = require('../models/CoursePurchase');
const Course = require('../models/Course');
const User = require('../models/User');
const UserRank = require('../models/UserRank');
const Rank = require('../models/Rank');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { processReferralCommission } = require('../services/referralService');
const { sendAccountApprovedEmail, sendPaymentReceivedEmail, sendCourseEnrollmentPendingEmail } = require('../services/emailService');
const { notifyStudentActivity } = require('../services/studentActivityService');

exports.createPurchase = async (req, res, next) => {
  try {
    const { courseId, broker, paymentMethod } = req.body;
    if (!courseId) return sendError(res, 'Course ID is required', 400);

    const course = await Course.findById(courseId);
    if (!course) return sendError(res, 'Course not found', 404);
    if (!course.isPublished) return sendError(res, 'Course not available', 400);

    const existing = await CoursePurchase.findOne({ userId: req.user._id, courseId, status: { $in: ['pending', 'active'] } });
    if (existing) return sendError(res, 'You already have a pending or active purchase for this course', 400);

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

    try {
      await sendPaymentReceivedEmail(req.user, course.price || 0);
      await sendCourseEnrollmentPendingEmail(req.user, course);
    } catch (e) { console.error('[EMAIL] create/payment/enrollment:', e.message); }

    notifyStudentActivity({
      user: req.user,
      action: 'course_enrollment_pending',
      details: { course: course.title, amount: course.price || 0, method: paymentMethod || 'card' }
    });

    sendSuccess(res, {
      purchase,
      transactionRef,
      amount: course.price || 0,
      message: 'Payment initiated. Admin will verify and activate your course access.'
    }, 'Purchase initiated', 201);
  } catch (error) { next(error); }
};

exports.approvePurchase = async (req, res, next) => {
  try {
    const purchase = await CoursePurchase.findById(req.params.id).populate('userId').populate('courseId');
    if (!purchase) return sendError(res, 'Purchase not found', 404);
    if (purchase.status !== 'pending') return sendError(res, 'Purchase already processed', 400);

    purchase.status = 'active';
    purchase.approvedBy = req.user._id;
    purchase.approvedAt = new Date();
    if (req.body.adminNote) purchase.adminNote = req.body.adminNote;
    await purchase.save();

    await User.findByIdAndUpdate(purchase.userId._id, { isApproved: true });

    await Course.findByIdAndUpdate(purchase.courseId._id, { $inc: { totalStudents: 1 } });

    const existingRank = await UserRank.findOne({ userId: purchase.userId._id });
    if (!existingRank) {
      const firstRank = await Rank.findOne({ isActive: true }).sort({ order: 1 });
      if (firstRank) {
        await UserRank.create({
          userId: purchase.userId._id,
          currentRankId: firstRank._id,
          rankHistory: [{
            rankId: firstRank._id,
            achievedAt: new Date(),
            reason: `Assigned ${firstRank.name} on course purchase approval`,
            changeType: 'automatic'
          }]
        });
      }
    }

    try {
      await sendAccountApprovedEmail(purchase.userId);
    } catch (e) { console.error('[EMAIL] sendAccountApprovedEmail:', e.message); }

    try {
      const result = await processReferralCommission(purchase.userId._id, purchase.amount, 'course');
      if (result) {
        purchase.metadata = { ...purchase.metadata, referralCommissions: result };
        await purchase.save();
      }
    } catch (e) { console.error('[REFERRAL] processReferralCommission:', e.message); }

    notifyStudentActivity({
      user: purchase.userId,
      action: 'course_purchased',
      details: { course: purchase.courseId?.title || 'Course', amount: purchase.amount, method: purchase.paymentMethod }
    });

    sendSuccess(res, purchase, 'Purchase approved');
  } catch (error) { next(error); }
};

exports.rejectPurchase = async (req, res, next) => {
  try {
    const purchase = await CoursePurchase.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', adminNote: req.body.adminNote || '', approvedBy: req.user._id },
      { new: true }
    );
    if (!purchase) return sendError(res, 'Purchase not found', 404);
    sendSuccess(res, purchase, 'Purchase rejected');
  } catch (error) { next(error); }
};

exports.getMyPurchases = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = { userId: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    const total = await CoursePurchase.countDocuments(filter);
    const purchases = await CoursePurchase.find(filter)
      .populate('courseId', 'title slug thumbnail level category')
      .sort(sort || { createdAt: -1 })
      .skip((page - 1) * limit).limit(limit);
    sendPaginated(res, purchases, total, page, limit);
  } catch (error) { next(error); }
};

exports.getAllPurchases = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const users = await User.find({
        $or: [
          { firstName: { $regex: req.query.search, $options: 'i' } },
          { lastName: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } }
        ]
      }).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
    }
    const total = await CoursePurchase.countDocuments(filter);
    const purchases = await CoursePurchase.find(filter)
      .populate('userId', 'firstName lastName email avatar')
      .populate('courseId', 'title slug price')
      .sort(sort || { createdAt: -1 })
      .skip((page - 1) * limit).limit(limit);
    sendPaginated(res, purchases, total, page, limit);
  } catch (error) { next(error); }
};

exports.getPendingCount = async (req, res, next) => {
  try {
    const count = await CoursePurchase.countDocuments({ status: 'pending' });
    sendSuccess(res, { count });
  } catch (error) { next(error); }
};

exports.getMyApprovalStatus = async (req, res, next) => {
  try {
    const approved = await CoursePurchase.findOne({ userId: req.user._id, status: 'active' });
    const pending = await CoursePurchase.findOne({ userId: req.user._id, status: 'pending' });
    sendSuccess(res, {
      isApproved: !!approved,
      hasPending: !!pending,
      approvedCourse: approved ? { id: approved._id, courseId: approved.courseId } : null,
      pendingPurchase: pending ? { id: pending._id, courseId: pending.courseId } : null
    });
  } catch (error) { next(error); }
};

exports.deletePurchase = async (req, res, next) => {
  try {
    const purchase = await CoursePurchase.findByIdAndDelete(req.params.id);
    if (!purchase) return sendError(res, 'Purchase not found', 404);
    sendSuccess(res, null, 'Purchase deleted');
  } catch (error) { next(error); }
};
