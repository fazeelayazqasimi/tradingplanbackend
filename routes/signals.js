const router = require('express').Router();
const { getSignals, getSignal, createSignal, updateSignal, deleteSignal, getSignalStats, hitTakeProfit, hitStopLoss, runResultCheck } = require('../controllers/signalController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createSignalValidator, updateSignalValidator } = require('../validators/signalValidators');

router.get('/', getSignals);
router.get('/stats', getSignalStats);
router.get('/:id', getSignal);
router.post('/', protect, authorize('admin'), validate(createSignalValidator), createSignal);
router.put('/:id', protect, authorize('admin'), validate(updateSignalValidator), updateSignal);
router.delete('/:id', protect, authorize('admin'), deleteSignal);
router.post('/:id/hit-tp', protect, authorize('admin'), hitTakeProfit);
router.post('/:id/hit-sl', protect, authorize('admin'), hitStopLoss);
router.post('/run-check', protect, authorize('admin'), runResultCheck);

module.exports = router;
