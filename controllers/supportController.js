const Support = require('../models/Support');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.createTicket = async (req, res, next) => {
  try {
    const ticket = await Support.create({ ...req.body, userId: req.user._id, messages: [{ sender: req.user._id, message: req.body.message }] });
    sendSuccess(res, ticket, 'Ticket created', 201);
  } catch (error) { next(error); }
};

exports.getTickets = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const status = req.query.status;
    const priority = req.query.priority;
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    const total = await Support.countDocuments(filter);
    const tickets = await Support.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'firstName lastName email');
    sendPaginated(res, tickets, total, page, limit);
  } catch (error) { next(error); }
};

exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await Support.findById(req.params.id).populate('userId', 'firstName lastName email').populate('messages.sender', 'firstName lastName');
    if (!ticket) return sendError(res, 'Not found', 404);
    sendSuccess(res, ticket);
  } catch (error) { next(error); }
};

exports.addMessage = async (req, res, next) => {
  try {
    const ticket = await Support.findById(req.params.id);
    if (!ticket) return sendError(res, 'Not found', 404);
    ticket.messages.push({ sender: req.user._id, message: req.body.message });
    if (ticket.status === 'open') ticket.status = 'in_progress';
    await ticket.save();
    sendSuccess(res, ticket, 'Message added');
  } catch (error) { next(error); }
};

exports.updateTicketStatus = async (req, res, next) => {
  try {
    const ticket = await Support.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!ticket) return sendError(res, 'Not found', 404);
    sendSuccess(res, ticket, 'Status updated');
  } catch (error) { next(error); }
};

exports.assignTicket = async (req, res, next) => {
  try {
    const ticket = await Support.findByIdAndUpdate(req.params.id, { assignedTo: req.body.assignedTo, status: 'in_progress' }, { new: true });
    if (!ticket) return sendError(res, 'Not found', 404);
    sendSuccess(res, ticket, 'Ticket assigned');
  } catch (error) { next(error); }
};

exports.deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Support.findByIdAndDelete(req.params.id);
    if (!ticket) return sendError(res, 'Ticket not found', 404);
    sendSuccess(res, null, 'Ticket deleted');
  } catch (error) { next(error); }
};
