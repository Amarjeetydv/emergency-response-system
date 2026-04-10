const express = require('express');
const router = express.Router();
const {
  createEmergency,
  getAllEmergencies,
  updateStatus,
  acceptRequest
} = require('../controllers/emergencyController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createEmergency);
router.get('/', protect, getAllEmergencies);
router.post('/accept-request', protect, acceptRequest);
router.put('/:id/status', protect, updateStatus);

module.exports = router;
