const router = require('express').Router();
const { createDeposit, getMyDeposits, getDepositById, getAllDeposits, approveDeposit, rejectDeposit, deleteDeposit, getSupportedCoins, verifyCryptoPayment } = require('../controllers/depositController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.post('/', createDeposit);
router.get('/coins', getSupportedCoins);
router.post('/verify-crypto', verifyCryptoPayment);
router.get('/mine', getMyDeposits);
router.get('/all', authorize('admin'), getAllDeposits);
router.get('/:id', getDepositById);
router.put('/:id/approve', authorize('admin'), approveDeposit);
router.put('/:id/reject', authorize('admin'), rejectDeposit);
router.delete('/:id', authorize('admin'), deleteDeposit);

module.exports = router;
