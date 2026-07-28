const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { marketUpdateValidator, idValidator } = require('../validators/generalValidators');
const { getMarketUpdates, getMarketUpdate, createMarketUpdate, updateMarketUpdate, deleteMarketUpdate, getStats } = require('../controllers/marketUpdateController');

router.get('/', getMarketUpdates);
router.get('/stats', getStats);
router.get('/:id', getMarketUpdate);
router.post('/', protect, authorize('admin'), validate(marketUpdateValidator), createMarketUpdate);
router.put('/:id', protect, authorize('admin'), validate(marketUpdateValidator), updateMarketUpdate);
router.delete('/:id', protect, authorize('admin'), idValidator, deleteMarketUpdate);

module.exports = router;