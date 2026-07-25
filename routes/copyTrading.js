const router = require('express').Router();
const { getCopyTradingStats, getCopyTradingHistory, distributeProfit, createCopyTrade } = require('../controllers/copyTradingController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/stats', getCopyTradingStats);
router.get('/history', getCopyTradingHistory);
router.post('/', createCopyTrade);
router.post('/distribute', authorize('admin'), distributeProfit);

module.exports = router;
