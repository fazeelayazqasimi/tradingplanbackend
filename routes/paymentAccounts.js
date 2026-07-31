const router = require('express').Router();
const { getAccounts, getAccount, createAccount, updateAccount, deleteAccount, uploadQr } = require('../controllers/paymentAccountController');
const { protect, authorize } = require('../middleware/auth');
const { uploadDepositScreenshot } = require('../middleware/upload');

router.use(protect);
router.get('/', getAccounts);
router.get('/:id', getAccount);
router.post('/upload-qr', authorize('admin'), uploadDepositScreenshot.single('qrCode'), uploadQr);
router.post('/', authorize('admin'), createAccount);
router.put('/:id', authorize('admin'), updateAccount);
router.delete('/:id', authorize('admin'), deleteAccount);

module.exports = router;
