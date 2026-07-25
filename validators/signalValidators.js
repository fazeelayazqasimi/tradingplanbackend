const { body } = require('express-validator');

const createSignalValidator = [
  body('symbol')
    .trim()
    .notEmpty()
    .withMessage('Symbol is required'),
  body('action')
    .isIn(['BUY', 'SELL', 'CLOSE', 'MODIFY'])
    .withMessage('Action must be BUY, SELL, CLOSE, or MODIFY'),
  body('side')
    .isIn(['LONG', 'SHORT'])
    .withMessage('Side must be LONG or SHORT'),
  body('volume')
    .isNumeric()
    .withMessage('Volume must be a number')
    .custom((value) => {
      if (parseFloat(value) < 0.01) {
        throw new Error('Volume must be at least 0.01');
      }
      return true;
    }),
  body('openPrice')
    .isNumeric()
    .withMessage('Open price must be a number'),
  body('stopLoss')
    .optional()
    .isNumeric()
    .withMessage('Stop loss must be a number'),
  body('takeProfit')
    .optional()
    .isNumeric()
    .withMessage('Take profit must be a number'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
];

const updateSignalValidator = [
  body('symbol')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Symbol cannot be empty'),
  body('action')
    .optional()
    .isIn(['BUY', 'SELL', 'CLOSE', 'MODIFY'])
    .withMessage('Action must be BUY, SELL, CLOSE, or MODIFY'),
  body('side')
    .optional()
    .isIn(['LONG', 'SHORT'])
    .withMessage('Side must be LONG or SHORT'),
  body('volume')
    .optional()
    .isNumeric()
    .withMessage('Volume must be a number')
    .custom((value) => {
      if (parseFloat(value) < 0.01) {
        throw new Error('Volume must be at least 0.01');
      }
      return true;
    }),
  body('openPrice')
    .optional()
    .isNumeric()
    .withMessage('Open price must be a number'),
  body('stopLoss')
    .optional()
    .isNumeric()
    .withMessage('Stop loss must be a number'),
  body('takeProfit')
    .optional()
    .isNumeric()
    .withMessage('Take profit must be a number'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
];

module.exports = {
  createSignalValidator,
  updateSignalValidator,
};
