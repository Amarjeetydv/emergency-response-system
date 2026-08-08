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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP images and MP4, MOV, WebM videos are allowed.'), false);
    }
  }
});

// Ensure 'media' matches the key used in Angular's formData.append('media', ...)
router.post('/', protect, upload.single('media'), createEmergency);
router.get('/', protect, getAllEmergencies);
router.post('/accept-request', protect, acceptRequest);
router.put('/:id', protect, updateStatus);

module.exports = router;
