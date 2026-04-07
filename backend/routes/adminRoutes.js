const express = require('express');
const router = express.Router();
const { getLogs } = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

router.get('/logs', protect, requireAdmin, getLogs);

module.exports = router;
