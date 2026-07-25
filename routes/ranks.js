const router = require('express').Router();
const { getRanks, getMyRank, getRankDistribution, adminOverrideRank, lockRank, unlockRank, updateRank, createRank, deleteRank } = require('../controllers/rankController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { rankValidator } = require('../validators/generalValidators');

router.get('/', getRanks);
router.get('/me', protect, getMyRank);
router.get('/distribution', protect, authorize('admin'), getRankDistribution);
router.post('/', protect, authorize('admin'), validate(rankValidator), createRank);
router.put('/:id', protect, authorize('admin'), updateRank);
router.delete('/:id', protect, authorize('admin'), deleteRank);
router.post('/override', protect, authorize('admin'), adminOverrideRank);
router.put('/:userId/lock', protect, authorize('admin'), lockRank);
router.put('/:userId/unlock', protect, authorize('admin'), unlockRank);

module.exports = router;
