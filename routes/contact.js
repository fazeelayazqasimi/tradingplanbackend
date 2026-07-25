const router = require('express').Router();
const { submitContact, getContacts, getContact, updateContactStatus, deleteContact } = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', submitContact);
router.get('/', protect, authorize('admin'), getContacts);
router.get('/:id', protect, authorize('admin'), getContact);
router.put('/:id/status', protect, authorize('admin'), updateContactStatus);
router.delete('/:id', protect, authorize('admin'), deleteContact);

module.exports = router;
