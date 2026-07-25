const router = require('express').Router();
const { getCoupons, getCoupon, createCoupon, updateCoupon, deleteCoupon, validateCoupon, applyCoupon, generateCoupons } = require('../controllers/couponController');
const { protect, authorize } = require('../middleware/auth');

router.post('/validate', protect, validateCoupon);
router.post('/apply', protect, applyCoupon);

router.use(protect);
router.use(authorize('admin'));
router.post('/generate', generateCoupons);
router.get('/', getCoupons);
router.get('/:id', getCoupon);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);

module.exports = router;
