const express = require('express');
const router = express.Router();
const { getLogs, getAnalytics } = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

router.get('/logs', protect, requireAdmin, getLogs);
router.get('/analytics', protect, requireAdmin, getAnalytics);

module.exports = router;
