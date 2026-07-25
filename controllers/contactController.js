const Contact = require('../models/Contact');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.submitContact = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    const contact = await Contact.create({ name, email, subject, message });
    sendSuccess(res, contact, 'Message sent successfully', 201);
  } catch (error) {
    next(error);
  }
};

exports.getContacts = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    const total = await Contact.countDocuments(filter);
    const contacts = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    sendPaginated(res, contacts, total, page, limit);
  } catch (error) {
    next(error);
  }
};

exports.getContact = async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return sendError(res, 'Contact not found', 404);
    if (contact.status === 'new') {
      contact.status = 'read';
      await contact.save();
    }
    sendSuccess(res, contact);
  } catch (error) {
    next(error);
  }
};

exports.updateContactStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status, ...(status === 'replied' ? { repliedAt: new Date() } : {}) },
      { new: true }
    );
    if (!contact) return sendError(res, 'Contact not found', 404);
    sendSuccess(res, contact, 'Status updated');
  } catch (error) {
    next(error);
  }
};

exports.deleteContact = async (req, res, next) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return sendError(res, 'Contact not found', 404);
    sendSuccess(res, null, 'Contact deleted');
  } catch (error) {
    next(error);
  }
};
