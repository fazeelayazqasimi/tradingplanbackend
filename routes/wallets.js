const router = require('express').Router();
const { getMyWallet, getAllMyWallets, getWalletByType, getTransactionHistory, getWalletStats, getAllWallets, adminWalletStats, creditWallet, deleteWallet } = require('../controllers/walletController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getMyWallet);
router.get('/all-types', getAllMyWallets);
router.get('/type/:type', getWalletByType);
router.get('/transactions', getTransactionHistory);
router.get('/stats', getWalletStats);

router.get('/all', authorize('admin'), getAllWallets);
router.get('/admin/stats', authorize('admin'), adminWalletStats);
router.post('/:userId/credit', authorize('admin'), creditWallet);
router.delete('/:id', authorize('admin'), deleteWallet);

module.exports = router;
