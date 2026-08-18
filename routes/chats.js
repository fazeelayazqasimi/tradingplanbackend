const router = require('express').Router();
const {
  getMyChat,
  getChat,
  listChats,
  sendMessage,
  markRead,
  getUnreadCount
} = require('../controllers/chatController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/me', getMyChat);
router.get('/all', authorize('admin'), listChats);
router.get('/unread-count', getUnreadCount);
router.get('/:id', getChat);
router.post('/:id/messages', sendMessage);
router.put('/:id/read', markRead);

module.exports = router;
