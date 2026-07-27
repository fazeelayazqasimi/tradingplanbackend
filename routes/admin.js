const router = require('express').Router();
const { getDashboard, getRevenueReport, getActivityLogs, getReferrals, getReferralStats, getReferralById } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../helpers/response');

const bulkModels = {
  user: require('../models/User'),
  course: require('../models/Course'),
  purchase: require('../models/CoursePurchase'),
  subscription: require('../models/Subscription'),
  withdrawal: require('../models/Withdrawal'),
  deposit: require('../models/Deposit'),
  wallet: require('../models/Wallet'),
  rank: require('../models/Rank'),
  signal: require('../models/Signal'),
  announcement: require('../models/Announcement'),
  faq: require('../models/FAQ'),
  support: require('../models/Support'),
  contact: require('../models/Contact'),
  referral: require('../models/Referral'),
  assignment: require('../models/Assignment'),
  quiz: require('../models/Quiz'),
  certificate: require('../models/Certificate'),
  content: require('../models/PageContent'),
  paymentAccount: require('../models/PaymentAccount'),
};

router.use(protect, authorize('admin'));
router.get('/dashboard', getDashboard);
router.get('/revenue', getRevenueReport);
router.get('/activity-logs', getActivityLogs);
router.get('/referrals', getReferrals);
router.get('/referrals/stats', getReferralStats);
router.get('/referrals/:id', getReferralById);

router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { model, ids } = req.body;
    if (!model || !ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'Model name and non-empty ids array are required', 400);
    }
    const Model = bulkModels[model.toLowerCase()];
    if (!Model) return sendError(res, `Invalid model: ${model}`, 400);
    const result = await Model.deleteMany({ _id: { $in: ids } });
    sendSuccess(res, { deletedCount: result.deletedCount }, `${result.deletedCount} record(s) deleted`);
  } catch (error) { next(error); }
});

module.exports = router;
