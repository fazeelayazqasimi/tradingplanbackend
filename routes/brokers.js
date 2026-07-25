const router = require('express').Router();
const {
  getBrokers, getAllBrokers, createBroker, updateBroker, deleteBroker,
  getAccounts, createAccount, updateAccount, deleteAccount
} = require('../controllers/brokerController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getBrokers);

router.use(protect);

router.get('/all', authorize('admin'), getAllBrokers);
router.post('/', authorize('admin'), createBroker);
router.put('/:id', authorize('admin'), updateBroker);
router.delete('/:id', authorize('admin'), deleteBroker);

router.get('/:brokerId/accounts', getAccounts);
router.post('/:brokerId/accounts', authorize('admin'), createAccount);
router.put('/:brokerId/accounts/:accountId', authorize('admin'), updateAccount);
router.delete('/:brokerId/accounts/:accountId', authorize('admin'), deleteAccount);

module.exports = router;
