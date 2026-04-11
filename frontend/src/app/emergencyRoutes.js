const express = require('express');
const router = express.Router();
const { createEmergency, getAllEmergencies, updateStatus, acceptRequest, getAdminLogs, getChatHistory } = require('../controllers/emergencyController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware'); // Assuming this exists for RBAC

router.post('/', protect, createEmergency);
router.get('/', protect, getAllEmergencies);
router.post('/accept-request', protect, acceptRequest);
router.put('/:id/status', protect, updateStatus);
router.get('/:id/chat', protect, getChatHistory);

// Admin specific monitoring routes
router.get('/admin/logs', protect, authorize('admin'), getAdminLogs);

module.exports = router;
