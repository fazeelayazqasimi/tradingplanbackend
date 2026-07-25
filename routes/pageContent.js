const router = require('express').Router();
const { getPublicContent, getPageContent, getAllContent, createContent, updateContent, deleteContent, bulkUpdateContent, seedContent } = require('../controllers/pageContentController');
const { protect, authorize } = require('../middleware/auth');

router.get('/public', getPublicContent);
router.get('/public/:page', getPublicContent);
router.get('/', protect, authorize('admin'), getAllContent);
router.get('/seed', protect, authorize('admin'), seedContent);
router.get('/:page', protect, authorize('admin'), getPageContent);
router.post('/', protect, authorize('admin'), createContent);
router.put('/:id', protect, authorize('admin'), updateContent);
router.delete('/:id', protect, authorize('admin'), deleteContent);
router.put('/bulk', protect, authorize('admin'), bulkUpdateContent);

module.exports = router;
