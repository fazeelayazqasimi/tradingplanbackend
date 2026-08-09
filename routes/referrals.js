const router = require('express').Router();
const { getMyReferralCode, getReferralStats, getReferralTree, getReferralChildren, getReferralEarnings, deleteReferral } = require('../controllers/referralController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/code', getMyReferralCode);
router.get('/stats', getReferralStats);
router.get('/tree', getReferralTree);
router.get('/tree/:userId', getReferralChildren);
router.get('/earnings', getReferralEarnings);
router.delete('/:id', protect, authorize('admin'), deleteReferral);

module.exports = router;
