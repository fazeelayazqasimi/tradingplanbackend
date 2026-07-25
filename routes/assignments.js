const router = require('express').Router();
const { getAssignments, getAssignment, submitAssignment, gradeAssignment, createAssignment, deleteAssignment } = require('../controllers/assignmentController');
const { protect, authorize } = require('../middleware/auth');
const { uploadResource } = require('../middleware/upload');

router.get('/', getAssignments);
router.get('/:id', protect, getAssignment);
router.post('/', protect, authorize('admin'), createAssignment);
router.post('/:id/submit', protect, uploadResource.single('file'), submitAssignment);
router.put('/:id/grade/:submissionId', protect, authorize('admin'), gradeAssignment);
router.delete('/:id', protect, authorize('admin'), deleteAssignment);

module.exports = router;
