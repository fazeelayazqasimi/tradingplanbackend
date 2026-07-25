const { body, query } = require('express-validator');

const announcementValidator = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('content')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Content must be between 10 and 5000 characters'),
  body('type')
    .isIn(['general', 'course', 'signal', 'promotion', 'maintenance', 'update', 'system'])
    .withMessage('Type must be general, course, signal, promotion, maintenance, update, or system'),
  body('targetRoles')
    .optional()
    .isArray()
    .withMessage('Target roles must be an array'),
  body('targetRoles.*')
    .optional()
    .isString()
    .withMessage('Each target role must be a string'),
];

const supportTicketValidator = [
  body('subject')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters'),
  body('category')
    .isIn(['general', 'technical', 'billing', 'other'])
    .withMessage('Category must be general, technical, billing, or other'),
  body('priority')
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent'),
];

const supportMessageValidator = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters'),
];

const rankValidator = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
];

const settingValidator = [
  body('key')
    .trim()
    .notEmpty()
    .withMessage('Key is required'),
  body('value')
    .trim()
    .notEmpty()
    .withMessage('Value is required'),
];

const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be an integer greater than 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
];

module.exports = {
  announcementValidator,
  supportTicketValidator,
  supportMessageValidator,
  rankValidator,
  settingValidator,
  paginationValidator,
};
