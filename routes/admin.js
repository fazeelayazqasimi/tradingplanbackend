const { getDashboard, getRevenueReport, getActivityLogs, getReferrals, getReferralStats, getReferralTree, getReferralById } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../helpers/response');
const { bulkDeleteValidator, idValidator } = require('../validators/generalValidators');
const { backup, importBackup, deleteAll, getStats } = require('../controllers/backupController');

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
  webinar: require('../models/Webinar'),
  zoomsession: require('../models/ZoomSession'),
  marketupdate: require('../models/MarketUpdate'),
};

router.use(protect, authorize('admin'));
router.get('/dashboard', getDashboard);
router.get('/revenue', getRevenueReport);
router.get('/activity-logs', getActivityLogs);
router.get('/referrals', getReferrals);
router.get('/referrals/stats', getReferralStats);
router.get('/referrals/tree', getReferralTree);
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

router.get('/backup/stats', getStats);
router.get('/backup', backup);
router.post('/backup/import', importBackup);
router.delete('/backup/all', deleteAll);

// Webinar CRUD
const { getWebinars, getWebinar, createWebinar, updateWebinar, deleteWebinar } = require('../controllers/webinarController');
router.get('/webinars', getWebinars);
router.get('/webinars/stats', async (req, res, next) => { try { const total = await require('../models/Webinar').countDocuments(); const published = await require('../models/Webinar').countDocuments({ isPublished: true }); const free = await require('../models/Webinar').countDocuments({ isFree: true, isPublished: true }); const upcoming = await require('../models/Webinar').countDocuments({ date: { $gt: new Date() }, isPublished: true }); sendSuccess(res, { total, published, free, upcoming }); } catch (e) { next(e); } });
router.get('/webinars/:id', getWebinar);
router.post('/webinars', protect, authorize('admin'), createWebinar);
router.put('/webinars/:id', protect, authorize('admin'), updateWebinar);
router.delete('/webinars/:id', protect, authorize('admin'), deleteWebinar);

// Zoom Session CRUD
const { getZoomSessions, getZoomSession, createZoomSession, updateZoomSession, deleteZoomSession } = require('../controllers/zoomSessionController');
router.get('/zoom-sessions', getZoomSessions);
router.get('/zoom-sessions/stats', async (req, res, next) => { try { const total = await require('../models/ZoomSession').countDocuments(); const published = await require('../models/ZoomSession').countDocuments({ isPublished: true }); const free = await require('../models/ZoomSession').countDocuments({ category: 'free-zoom', isPublished: true }); const upcoming = await require('../models/ZoomSession').countDocuments({ date: { $gt: new Date() }, isPublished: true }); sendSuccess(res, { total, published, free, upcoming }); } catch (e) { next(e); } });
router.get('/zoom-sessions/:id', getZoomSession);
router.post('/zoom-sessions', protect, authorize('admin'), createZoomSession);
router.put('/zoom-sessions/:id', protect, authorize('admin'), updateZoomSession);
router.delete('/zoom-sessions/:id', protect, authorize('admin'), deleteZoomSession);

// Market Update CRUD
const { getMarketUpdates, getMarketUpdate, createMarketUpdate, updateMarketUpdate, deleteMarketUpdate } = require('../controllers/marketUpdateController');
router.get('/market-updates', getMarketUpdates);
router.get('/market-updates/stats', async (req, res, next) => { try { const total = await require('../models/MarketUpdate').countDocuments(); const published = await require('../models/MarketUpdate').countDocuments({ isPublished: true }); sendSuccess(res, { total, published }); } catch (e) { next(e); } });
router.get('/market-updates/:id', getMarketUpdate);
router.post('/market-updates', protect, authorize('admin'), createMarketUpdate);
router.put('/market-updates/:id', protect, authorize('admin'), updateMarketUpdate);
router.delete('/market-updates/:id', protect, authorize('admin'), deleteMarketUpdate);

module.exports = router;
