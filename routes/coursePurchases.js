const router = require('express').Router();
const { createPurchase, approvePurchase, rejectPurchase, getMyPurchases, getAllPurchases, getPendingCount, getMyApprovalStatus, deletePurchase } = require('../controllers/coursePurchaseController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/my', getMyPurchases);
router.get('/my/approval-status', getMyApprovalStatus);
router.post('/', createPurchase);
router.get('/pending-count', authorize('admin'), getPendingCount);
router.get('/all', authorize('admin'), getAllPurchases);
router.put('/:id/approve', authorize('admin'), approvePurchase);
router.put('/:id/reject', authorize('admin'), rejectPurchase);
router.delete('/:id', authorize('admin'), deletePurchase);

module.exports = router;
