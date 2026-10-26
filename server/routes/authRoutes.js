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
// @desc    Register a new user (First registered user is automatically Admin)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide full name, email, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    // First account is Admin, subsequent accounts are Teachers
    const userCount = await User.countDocuments();
    const isFirstAccount = userCount === 0;
    const role = isFirstAccount ? 'admin' : 'teacher';

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      isFirstAccount
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: isFirstAccount ? 'Admin account created successfully!' : 'Account registered successfully!',
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
      return res.status(400).json({ success: false, message: 'Please enter your username/email and password' });
    }

    const trimmedInput = email.trim();
    // Search by email or case-insensitive exact name
    const user = await User.findOne({
      $or: [
        { email: trimmedInput.toLowerCase() },
        { name: new RegExp(`^${trimmedInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      ]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
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
// @desc    Google Sign-In / OAuth Authentication
router.post('/google', async (req, res) => {
  try {
    let { credential, email, name, avatarUrl, googleId } = req.body;

    // If client sent Google One Tap / GSI credential (JWT id_token)
    if (credential) {
      try {
        const payloadBase64 = credential.split('.')[1];
        const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        email = decoded.email;
        name = decoded.name;
        avatarUrl = decoded.picture;
        googleId = decoded.sub;
      } catch (err) {
        console.error('[Google Credential Decode Error]', err);
      }
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Google account email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        ...(googleId ? [{ googleId }] : [])
      ]
    });

    if (!user) {
      // First account is admin, subsequent accounts are teachers
      const userCount = await User.countDocuments();
      const isFirstAccount = userCount === 0;
      const role = isFirstAccount ? 'admin' : 'teacher';

      const salt = await bcrypt.genSalt(10);
      const randomPassword = await bcrypt.hash(Math.random().toString(36), salt);

      user = await User.create({
        name: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: randomPassword,
        role,
        isFirstAccount,
        googleId: googleId || null,
        avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
      });
    } else {
      // Update Google ID or avatar if available
      let modified = false;
      if (googleId && !user.googleId) {
        user.googleId = googleId;
        modified = true;
      }
      if (avatarUrl && (!user.avatarUrl || user.avatarUrl.includes('unsplash.com'))) {
        user.avatarUrl = avatarUrl;
        modified = true;
      }
      if (modified) await user.save();
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: `Signed in with Google as ${user.name}`,
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

// @route   POST /api/auth/demo-login
// @desc    1-Click Quick Demo Login (for Admin or Teacher testing)
router.post('/demo-login', async (req, res) => {
  try {
    const { role } = req.body;
    const targetRole = role === 'teacher' ? 'teacher' : 'admin';

    let user = await User.findOne({ role: targetRole });
    if (!user) {
      user = await User.findOne();
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'No demo accounts found' });
    }

    const token = generateToken(user);
    res.json({
      success: true,
      message: `Signed in as ${user.role.toUpperCase()}: ${user.name}`,
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
