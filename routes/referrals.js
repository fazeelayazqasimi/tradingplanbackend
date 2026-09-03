const router = require('express').Router();
const { getMyReferralCode, getReferralStats, getReferralTree, getReferralChildren, getReferralEarnings, deleteReferral } = require('../controllers/referralController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/code', authorize('admin', 'student'), getMyReferralCode);
router.get('/stats', authorize('admin', 'student'), getReferralStats);
router.get('/tree', authorize('admin', 'student'), getReferralTree);
router.get('/tree/:userId', authorize('admin', 'student'), getReferralChildren);
router.get('/earnings', authorize('admin', 'student'), getReferralEarnings);
router.delete('/:id', protect, authorize('admin'), deleteReferral);

module.exports = router;
