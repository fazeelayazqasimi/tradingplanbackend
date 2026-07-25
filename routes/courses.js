const router = require('express').Router();
const { getCourses, getCourse, createCourse, updateCourse, deleteCourse, addLesson, updateLesson, deleteLesson, enrollCourse, getCourseProgress, updateProgress, getEnrolledCourses } = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createCourseValidator, updateCourseValidator, addLessonValidator, updateLessonValidator } = require('../validators/courseValidators');
const { uploadCourse } = require('../middleware/upload');

router.get('/', getCourses);
router.get('/enrolled', protect, getEnrolledCourses);
router.get('/:slug', protect, getCourse);
router.post('/', protect, authorize('admin'), validate(createCourseValidator), createCourse);
router.put('/:id', protect, authorize('admin'), validate(updateCourseValidator), updateCourse);
router.delete('/:id', protect, authorize('admin'), deleteCourse);
router.post('/:id/lessons', protect, authorize('admin'), validate(addLessonValidator), addLesson);
router.put('/:id/lessons/:lessonId', protect, authorize('admin'), validate(updateLessonValidator), updateLesson);
router.delete('/:id/lessons/:lessonId', protect, authorize('admin'), deleteLesson);
router.post('/:id/enroll', protect, authorize('student'), enrollCourse);
router.get('/:id/progress', protect, getCourseProgress);
router.put('/:id/progress', protect, updateProgress);

module.exports = router;
