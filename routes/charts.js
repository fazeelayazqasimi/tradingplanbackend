const router = require('express').Router();
const { getDrawing, saveDrawing, deleteDrawing } = require('../controllers/chartController');
const { protect } = require('../middleware/auth');

router.get('/drawings', protect, getDrawing);
router.post('/drawings', protect, saveDrawing);
router.delete('/drawings', protect, deleteDrawing);

module.exports = router;
