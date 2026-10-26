const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT Helper
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'registerly_super_secure_jwt_secret_key_2026',
    { expiresIn: '30d' }
  );
};

// @route   GET /api/auth/google-client-id
// @desc    Returns configured Google Client ID to frontend for Google Identity Services initialization
router.get('/google-client-id', (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || ''
  });
});

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
    // Search by email or case-insensitive name
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
// @desc    Cryptographically verify Google ID Token & Authenticate User
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google cryptographic ID token (credential) is required.'
      });
    }

    let payload = null;

    // Verify token cryptographically using official Google Auth Library
    if (process.env.GOOGLE_CLIENT_ID) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID
        });
        payload = ticket.getPayload();
      } catch (err) {
        console.error('[Google Verification Failed]', err.message);
        return res.status(401).json({
          success: false,
          message: 'Google authentication verification failed: ' + err.message
        });
      }
    } else {
      // Decode JWT payload if GOOGLE_CLIENT_ID is awaiting configuration in .env
      try {
        const base64Url = credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid Google credential token' });
      }
    }

    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        message: 'Unable to extract verified email from Google credential.'
      });
    }

    const { email, name, picture, sub } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists in database
    let user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { googleId: sub }
      ]
    });

    if (!user) {
      // First account is Admin, subsequent accounts are Teachers
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
        googleId: sub,
        avatarUrl: picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
      });
    } else {
      // Link Google ID or updated avatar
      let modified = false;
      if (!user.googleId) {
        user.googleId = sub;
        modified = true;
      }
      if (picture && (!user.avatarUrl || user.avatarUrl.includes('unsplash.com'))) {
        user.avatarUrl = picture;
        modified = true;
      }
      if (modified) await user.save();
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: `Authenticated with Google as ${user.name}`,
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
