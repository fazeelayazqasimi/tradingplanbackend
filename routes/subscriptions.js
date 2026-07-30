const router = require('express').Router();
const { getSubscriptions, getMySubscription, createSubscription, updateSubscription, approveSubscription, rejectSubscription, deleteSubscription, activateWithPin, activateWithBalance, activateByUpline, getActivationInfo, adminActivateStudent } = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createSubscriptionValidator, adminApprovalValidator } = require('../validators/subscriptionValidators');

router.use(protect);
router.get('/', authorize('admin'), getSubscriptions);
router.get('/me', getMySubscription);
router.get('/activation-info', getActivationInfo);
router.post('/activate-with-pin', activateWithPin);
router.post('/activate-with-balance', activateWithBalance);
router.post('/activate-by-upline', activateByUpline);
router.post('/admin-activate/:userId', authorize('admin'), adminActivateStudent);

router.post('/', validate(createSubscriptionValidator), createSubscription);
router.put('/:id', authorize('admin'), updateSubscription);
router.put('/:id/approve', authorize('admin'), validate(adminApprovalValidator), approveSubscription);
router.put('/:id/reject', authorize('admin'), rejectSubscription);
router.delete('/:id', authorize('admin'), deleteSubscription);

module.exports = router;
