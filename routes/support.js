const router = require('express').Router();
const { createTicket, getTickets, getTicket, addMessage, updateTicketStatus, assignTicket, deleteTicket } = require('../controllers/supportController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { supportTicketValidator, supportMessageValidator } = require('../validators/generalValidators');

router.use(protect);
router.post('/', validate(supportTicketValidator), createTicket);
router.get('/', getTickets);
router.get('/:id', getTicket);
router.post('/:id/messages', validate(supportMessageValidator), addMessage);
router.put('/:id/status', authorize('admin'), updateTicketStatus);
router.put('/:id/assign', authorize('admin'), assignTicket);
router.delete('/:id', authorize('admin'), deleteTicket);

module.exports = router;
