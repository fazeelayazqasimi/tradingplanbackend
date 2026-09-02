const router = require('express').Router();
const { getMyReferralCode, getReferralStats, getReferralTree, getReferralChildren, getReferralEarnings, deleteReferral } = require('../controllers/referralController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/code', authorize('admin'), getMyReferralCode);
router.get('/stats', authorize('admin'), getReferralStats);
router.get('/tree', authorize('admin'), getReferralTree);
router.get('/tree/:userId', authorize('admin'), getReferralChildren);
router.get('/earnings', authorize('admin'), getReferralEarnings);
router.delete('/:id', protect, authorize('admin'), deleteReferral);

module.exports = router;
