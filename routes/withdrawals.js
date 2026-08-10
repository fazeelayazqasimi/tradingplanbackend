const router = require('express').Router();
const { requestWithdrawal, getWithdrawals, getWithdrawalFeeInfo, approveWithdrawal, rejectWithdrawal, markPaid, deleteWithdrawal, sendWithdrawalOTP } = require('../controllers/withdrawalController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { requestWithdrawalValidator, adminWithdrawalValidator } = require('../validators/withdrawalValidators');

router.use(protect);
router.get('/fee-info', getWithdrawalFeeInfo);
router.post('/send-otp', sendWithdrawalOTP);
router.get('/', getWithdrawals);
router.post('/', validate(requestWithdrawalValidator), requestWithdrawal);
router.put('/:id/approve', authorize('admin'), approveWithdrawal);
router.put('/:id/reject', authorize('admin'), validate(adminWithdrawalValidator), rejectWithdrawal);
router.put('/:id/paid', authorize('admin'), markPaid);
router.delete('/:id', authorize('admin'), deleteWithdrawal);

module.exports = router;
