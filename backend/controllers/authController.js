const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};


// Add approval_status for responders
const registerUser = async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ 
      message: 'Missing required fields', 
      required: ['name', 'email', 'password', 'role'] 
    });
  }

  try {
    // Check if user exists
    const userExists = await User.findByEmail(email);
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Only allow admin@gmail.com to be admin
    let userRole = role;
    if (email === 'admin@gmail.com') {
      userRole = 'admin';
    }
    // If responder (police, fire, ambulance), set approval_status to 'pending'
    let approvalStatus = null;
    if (["police", "fire", "ambulance"].includes(userRole)) {
      approvalStatus = 'pending';
    }

    const userId = await User.create({
      name,
      email,
      password: hashedPassword,
      role: userRole,
      phone,
      approval_status: approvalStatus
    });
    const newUser = await User.findById(userId);

    if (newUser) {
      res.status(201).json({
        _id: newUser.id,
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        approval_status: newUser.approval_status,
        token: generateToken(newUser.id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    // Logging the actual error is key to debugging
    console.error('Registration Error:', error.message);
    res.status(500).json({ 
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    // Check for user by email
    const user = await User.findByEmail(email);

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        approval_status: user.approval_status,
        token: generateToken(user.id),
      });
    } else {
      res.status(400).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Get all users (for admin dashboard)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.getAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Approve responder
const approveResponder = async (req, res) => {
  const { id } = req.params;
  try {
    await User.setApprovalStatus(id, 'approved');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve responder' });
  }
};

const ALLOWED_ROLES = ['citizen', 'police', 'ambulance', 'fire', 'admin', 'responder', 'dispatcher'];

const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    await User.updateRole(id, role);
    if (['police', 'fire', 'ambulance'].includes(role)) {
      await User.setApprovalStatus(id, 'pending');
    } else {
      await User.setApprovalStatus(id, null);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('updateUserRole', error);
    res.status(500).json({ message: 'Failed to update role' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getAllUsers,
  approveResponder,
  updateUserRole,
};
