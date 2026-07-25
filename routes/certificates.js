const router = require('express').Router();
const { getMyCertificates, getCertificate, verifyCertificate, getAllCertificates, createCertificate, deleteCertificate } = require('../controllers/certificateController');
const { protect, authorize } = require('../middleware/auth');

router.get('/verify/:number', verifyCertificate);
router.get('/admin/all', protect, authorize('admin'), getAllCertificates);
router.post('/admin', protect, authorize('admin'), createCertificate);
router.delete('/admin/:id', protect, authorize('admin'), deleteCertificate);
router.get('/', protect, getMyCertificates);
router.get('/:id', protect, getCertificate);

module.exports = router;
