const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const {
  registerUser,
  loginUser,
  getAllUsers,
  approveResponder,
  updateUserRole,
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/users', protect, requireAdmin, getAllUsers);
router.patch('/users/:id/approve', protect, requireAdmin, approveResponder);
router.patch('/users/:id/role', protect, requireAdmin, updateUserRole);

module.exports = router;
