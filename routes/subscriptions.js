const router = require('express').Router();
const { getSubscriptions, getMySubscription, createSubscription, updateSubscription, approveSubscription, rejectSubscription, cancelSubscription, deleteSubscription } = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createSubscriptionValidator, adminApprovalValidator } = require('../validators/subscriptionValidators');

router.use(protect);
router.get('/', authorize('admin'), getSubscriptions);
router.get('/me', getMySubscription);
router.put('/me/cancel', cancelSubscription);
router.post('/', validate(createSubscriptionValidator), createSubscription);
router.put('/:id', authorize('admin'), updateSubscription);
router.put('/:id/approve', authorize('admin'), validate(adminApprovalValidator), approveSubscription);
router.put('/:id/reject', authorize('admin'), rejectSubscription);
router.put('/:id/cancel', cancelSubscription);
router.delete('/:id', authorize('admin'), deleteSubscription);

module.exports = router;
