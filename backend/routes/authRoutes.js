const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const {
  registerUser,
  loginUser,
  getAllUsers,
  approveResponder,
  updateUserRole,
  deleteUser,
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/users', protect, requireAdmin, getAllUsers);
router.patch('/users/:id/approve', protect, requireAdmin, approveResponder);
router.patch('/users/:id/role', protect, requireAdmin, updateUserRole);
router.delete('/users/:id', protect, requireAdmin, deleteUser);

module.exports = router;
