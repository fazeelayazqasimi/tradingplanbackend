const express = require('express');
const router = express.Router();
const { getMarketOverview, updateMarketOverview } = require('../controllers/marketOverviewController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getMarketOverview);
router.put('/', protect, authorize('admin'), updateMarketOverview);

module.exports = router;
