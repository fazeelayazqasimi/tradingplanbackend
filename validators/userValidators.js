const { body } = require('express-validator');

const updateProfileValidator = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s\-()]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

const connectMTValidator = [
  body('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required'),
  body('server')
    .trim()
    .notEmpty()
    .withMessage('Server is required'),
  body('platform')
    .isIn(['MT4', 'MT5'])
    .withMessage('Platform must be MT4 or MT5'),
];

const botAccountValidator = [
  body('platform')
    .isIn(['MT4', 'MT5'])
    .withMessage('Platform must be MT4 or MT5'),
  body('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required'),
  body('server')
    .trim()
    .notEmpty()
    .withMessage('Server is required'),
  body('brokerName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Broker name cannot exceed 100 characters'),
  body('accountType')
    .optional({ values: 'falsy' })
    .isIn(['demo', 'real'])
    .withMessage('Account type must be demo or real'),
  body('strategyId')
    .trim()
    .notEmpty()
    .withMessage('Trading strategy is required')
    .isMongoId()
    .withMessage('Invalid strategy'),
  body('password')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Password cannot exceed 200 characters'),
];

const adminUpdateUserValidator = [
  body('role')
    .optional()
    .isIn(['admin', 'student'])
    .withMessage('Role must be admin or student'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

module.exports = {
  updateProfileValidator,
  connectMTValidator,
  botAccountValidator,
  adminUpdateUserValidator,
};
