const router = require('express').Router();
const { requestWithdrawal, getWithdrawals, approveWithdrawal, rejectWithdrawal, markPaid, deleteWithdrawal } = require('../controllers/withdrawalController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { requestWithdrawalValidator, adminWithdrawalValidator } = require('../validators/withdrawalValidators');

router.use(protect);
router.get('/', getWithdrawals);
router.post('/', validate(requestWithdrawalValidator), requestWithdrawal);
router.put('/:id/approve', authorize('admin'), approveWithdrawal);
router.put('/:id/reject', authorize('admin'), validate(adminWithdrawalValidator), rejectWithdrawal);
router.put('/:id/paid', authorize('admin'), markPaid);
router.delete('/:id', authorize('admin'), deleteWithdrawal);

module.exports = router;
