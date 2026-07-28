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
  webinarValidator: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Description cannot exceed 5000 characters'),
    body('webinarUrl')
      .optional()
      .trim()
      .isURL()
      .withMessage('Must be a valid URL'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Date must be a valid ISO 8601 date'),
    body('duration')
      .optional()
      .isInt({ min: 1, max: 480 })
      .withMessage('Duration must be between 1 and 480 minutes'),
    body('maxParticipants')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max participants must be at least 1'),
    body('isPublished')
      .optional()
      .isBoolean()
      .withMessage('isPublished must be a boolean'),
    body('isFree')
      .optional()
      .isBoolean()
      .withMessage('isFree must be a boolean'),
    body('category')
      .optional()
      .isIn(['free-webinar', 'premium-webinar', 'zoom-session', 'market-update'])
      .withMessage('Invalid category'),
    body('targetRoles')
      .optional()
      .isArray()
      .withMessage('Target roles must be an array'),
    body('targetRoles.*')
      .optional()
      .isString()
      .withMessage('Each target role must be a string'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isString()
      .withMessage('Each tag must be a string'),
  ],
  zoomSessionValidator: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Description cannot exceed 5000 characters'),
    body('zoomLink')
      .optional()
      .trim()
      .isURL()
      .withMessage('Must be a valid URL'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Date must be a valid ISO 8601 date'),
    body('duration')
      .optional()
      .isInt({ min: 1, max: 480 })
      .withMessage('Duration must be between 1 and 480 minutes'),
    body('maxParticipants')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max participants must be at least 1'),
    body('isPublished')
      .optional()
      .isBoolean()
      .withMessage('isPublished must be a boolean'),
    body('isRecurring')
      .optional()
      .isBoolean()
      .withMessage('isRecurring must be a boolean'),
    body('recurrencePattern')
      .optional()
      .isIn(['daily', 'weekly', 'monthly'])
      .withMessage('Recurrence must be daily, weekly, or monthly'),
    body('category')
      .optional()
      .isIn(['free-zoom', 'premium-zoom'])
      .withMessage('Invalid category'),
    body('targetRoles')
      .optional()
      .isArray()
      .withMessage('Target roles must be an array'),
    body('targetRoles.*')
      .optional()
      .isString()
      .withMessage('Each target role must be a string'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isString()
      .withMessage('Each tag must be a string'),
  ],
  marketUpdateValidator: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('content')
      .trim()
      .isLength({ min: 10, max: 10000 })
      .withMessage('Content must be between 10 and 10000 characters'),
    body('category')
      .optional()
      .isIn(['market-update', 'free-training', 'basic-training', 'basic-lesson'])
      .withMessage('Invalid category'),
    body('type')
      .optional()
      .isIn(['text', 'video', 'pdf', 'link'])
      .withMessage('Type must be text, video, pdf, or link'),
    body('contentUrl')
      .optional()
      .trim()
      .isURL()
      .withMessage('Must be a valid URL'),
    body('summary')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Summary cannot exceed 500 characters'),
    body('isPublished')
      .optional()
      .isBoolean()
      .withMessage('isPublished must be a boolean'),
    body('pinned')
      .optional()
      .isBoolean()
      .withMessage('pinned must be a boolean'),
    body('targetRoles')
      .optional()
      .isArray()
      .withMessage('Target roles must be an array'),
    body('targetRoles.*')
      .optional()
      .isString()
      .withMessage('Each target role must be a string'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isString()
      .withMessage('Each tag must be a string'),
  ],
  idValidator: [
    body('id')
      .optional()
      .isMongoId()
      .withMessage('Invalid ID'),
  ],
};
