const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { exportUsers } = require('../controllers/exportController');

router.use(protect, authorize('admin'));
router.get('/users', exportUsers);

module.exports = router;
