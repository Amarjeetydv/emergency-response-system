const express = require('express');
const router = express.Router();
const {
  createEmergency,
  getAllEmergencies,
  updateEmergencyStatus,
} = require('../controllers/emergencyController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createEmergency);
router.get('/', protect, getAllEmergencies);
router.put('/:id', protect, updateEmergencyStatus);

module.exports = router;
