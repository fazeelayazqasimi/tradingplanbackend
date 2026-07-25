const { body } = require('express-validator');

const createCourseValidator = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters'),
  body('level')
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Level must be beginner, intermediate, or advanced'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
];

const updateCourseValidator = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters'),
  body('level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Level must be beginner, intermediate, or advanced'),
  body('category')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category cannot be empty'),
];

const addLessonValidator = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('type')
    .isIn(['video', 'text', 'quiz', 'exercise'])
    .withMessage('Type must be video, text, quiz, or exercise'),
  body('content')
    .optional()
    .isString()
    .withMessage('Content must be a string'),
  body('videoUrl')
    .optional()
    .isURL()
    .withMessage('Video URL must be a valid URL'),
  body('videoDuration')
    .optional()
    .isNumeric()
    .withMessage('Video duration must be a number'),
];

const updateLessonValidator = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('type')
    .optional()
    .isIn(['video', 'text', 'quiz', 'exercise'])
    .withMessage('Type must be video, text, quiz, or exercise'),
  body('content')
    .optional()
    .isString()
    .withMessage('Content must be a string'),
  body('videoUrl')
    .optional()
    .isURL()
    .withMessage('Video URL must be a valid URL'),
  body('videoDuration')
    .optional()
    .isNumeric()
    .withMessage('Video duration must be a number'),
  body('order')
    .optional()
    .isNumeric()
    .withMessage('Order must be a number'),
];

module.exports = {
  createCourseValidator,
  updateCourseValidator,
  addLessonValidator,
  updateLessonValidator,
};
