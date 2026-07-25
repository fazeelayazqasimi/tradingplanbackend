const router = require('express').Router();
const { getAccounts, getAccount, createAccount, updateAccount, deleteAccount } = require('../controllers/paymentAccountController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getAccounts);
router.get('/:id', getAccount);
router.post('/', authorize('admin'), createAccount);
router.put('/:id', authorize('admin'), updateAccount);
router.delete('/:id', authorize('admin'), deleteAccount);

module.exports = router;
