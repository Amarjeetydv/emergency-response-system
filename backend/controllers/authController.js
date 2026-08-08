const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const userModel = require("../models/userModel");
const Token = require("../models/tokenModel");
const User = userModel;

// Helper: access token (15 mins)
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

// Helper: parse cookies from header
const getRefreshTokenFromCookie = (req) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=').map((c) => c.trim());
    if (key && value) acc[key] = value;
    return acc;
  }, {});
  return cookies.refreshToken || null;
};

// Helper: set refresh token cookie
const setRefreshTokenCookie = async (res, userId) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await Token.create(userId, rawToken, expiresAt);

  const cookieOptions = [
    `refreshToken=${rawToken}`,
    'HttpOnly',
    'Path=/api/auth',
    `Max-Age=${7 * 24 * 60 * 60}`,
    'SameSite=Lax',
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));
};

// Helper: clear refresh token cookie
const clearRefreshTokenCookie = (res) => {
  const cookieOptions = [
    'refreshToken=',
    'HttpOnly',
    'Path=/api/auth',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'SameSite=Lax',
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));
};


// Add approval_status for responders
const registerUser = async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      message: "Missing required fields",
      required: ["name", "email", "password", "role"],
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email address format" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters long" });
  }

  try {
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    // IMPORTANT: admin ko citizen me downgrade mat karo
    const userRole = role;

    const approval_status =
      ["police", "ambulance", "fire", "responder", "dispatcher"].includes(userRole)
        ? "pending"
        : null;

    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = await User.create({
      name,
      email,
      password: hashedPassword,
      role: userRole,
      phone: phone || null,
      approval_status,
    });

    const createdUser = await User.findById(userId);
    await setRefreshTokenCookie(res, userId);

    return res.status(201).json({
      message: "User registered successfully",
      token: generateAccessToken(createdUser),
      user: createdUser, // must include role
    });
  } catch (error) {
    console.error("registerUser error:", error);
    return res.status(500).json({ message: "Server error during registration" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);

    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    let ok = await bcrypt.compare(password, user.password);

    // Legacy compatibility: if old seed data stored plain-text password,
    // allow one-time login and immediately migrate to bcrypt hash.
    if (!ok && password === user.password) {
      ok = true;
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.updatePasswordHash(user.id, hashedPassword);
    }

    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    await setRefreshTokenCookie(res, user.id);

    return res.status(200).json({
      message: "Login successful",
      token: generateAccessToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        approval_status: user.approval_status
      }
    });
  } catch (err) {
    console.error("loginUser error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// Get all users (for admin dashboard)
const getAllUsers = async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 50;
  const offset = (page - 1) * limit;

  try {
    const users = await User.getAll(limit, offset);
    res.json(users);
  } catch (error) {
    console.error('getAllUsers Controller Error:', error);
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

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admins from deleting themselves via this endpoint if desired
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ message: 'Cannot delete your own admin account' });
    }

    await User.delete(id); 
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('deleteUser Error:', error); // Logs full error details to the server console
    res.status(500).json({ 
      message: 'Failed to delete user', 
      details: error.message,
      code: error.code 
    });
  }
};

const refreshAccessToken = async (req, res) => {
  const refreshToken = getRefreshTokenFromCookie(req);
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const tokenRecord = await Token.findByToken(refreshToken);
    if (!tokenRecord) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(tokenRecord.user_id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Token rotation: generate new raw token, replace old hash with new hash in DB
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await Token.replace(refreshToken, newRefreshToken, expiresAt);

    const cookieOptions = [
      `refreshToken=${newRefreshToken}`,
      'HttpOnly',
      'Path=/api/auth',
      `Max-Age=${7 * 24 * 60 * 60}`,
      'SameSite=Lax',
    ];
    if (process.env.NODE_ENV === 'production') {
      cookieOptions.push('Secure');
    }
    res.setHeader('Set-Cookie', cookieOptions.join('; '));

    const accessToken = generateAccessToken(user);
    return res.status(200).json({ token: accessToken });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    clearRefreshTokenCookie(res);
    return res.status(401).json({ message: 'Session expired or invalidated' });
  }
};

const logoutUser = async (req, res) => {
  const refreshToken = getRefreshTokenFromCookie(req);
  if (refreshToken) {
    try {
      await Token.revoke(refreshToken);
    } catch (err) {
      console.error('Failed to revoke refresh token on logout:', err);
    }
  }
  clearRefreshTokenCookie(res);
  return res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = {
  registerUser,
  loginUser,
  getAllUsers,
  approveResponder,
  updateUserRole,
  deleteUser,
  refreshAccessToken,
  logoutUser,
};
