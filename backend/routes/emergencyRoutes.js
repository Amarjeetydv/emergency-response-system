const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  createEmergency,
  getAllEmergencies,
  updateStatus,
  acceptRequest
} = require('../controllers/emergencyController');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

// Ensure 'media' matches the key used in Angular's formData.append('media', ...)
router.post('/', protect, upload.single('media'), createEmergency);
router.get('/', protect, getAllEmergencies);
router.post('/accept-request', protect, acceptRequest);
router.put('/:id', protect, updateStatus);

module.exports = router;
