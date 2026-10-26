const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// Generate JWT Helper
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'registerly_super_secure_jwt_secret_key_2026',
    { expiresIn: '30d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a user (First user is automatically Admin)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    // Check if this is the first entering account
    const userCount = await User.countDocuments();
    const isFirstAccount = userCount === 0;
    const role = isFirstAccount ? 'admin' : 'teacher';

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      isFirstAccount
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isFirstAccount: user.isFirstAccount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Login with Email / Username & Password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isFirstAccount: user.isFirstAccount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/google
// @desc    Google Sign-In / Demo 1-click Authentication
router.post('/google', async (req, res) => {
  try {
    const { name, email, avatarUrl } = req.body;
    const userEmail = email || 'sarah.jenkins@stxavier.edu';
    const userName = name || 'Sarah Jenkins';

    let user = await User.findOne({ email: userEmail });
    if (!user) {
      const userCount = await User.countDocuments();
      const isFirstAccount = userCount === 0;
      const role = isFirstAccount ? 'admin' : 'teacher';

      const salt = await bcrypt.genSalt(10);
      const randomPassword = await bcrypt.hash(Math.random().toString(36), salt);

      user = await User.create({
        name: userName,
        email: userEmail,
        password: randomPassword,
        role,
        isFirstAccount,
        avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isFirstAccount: user.isFirstAccount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        avatarUrl: req.user.avatarUrl,
        isFirstAccount: req.user.isFirstAccount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
