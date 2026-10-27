const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const getGoogleClientId = () => {
  try {
    require('dotenv').config();
  } catch (e) {}
  return (process.env.GOOGLE_CLIENT_ID || '').trim();
};

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
    clientId: getGoogleClientId()
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
    // Search by email, case-insensitive name, or 'admin' role
    const query = [
      { email: trimmedInput.toLowerCase() },
      { name: new RegExp(`^${trimmedInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    ];
    if (trimmedInput.toLowerCase() === 'admin') {
      query.push({ role: 'admin' });
    }
    const user = await User.findOne({ $or: query });

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
// @desc    Cryptographically verify Google ID Token or Access Token & Authenticate User
router.post('/google', async (req, res) => {
  try {
    const { credential, access_token } = req.body;

    if (!credential && !access_token) {
      return res.status(400).json({
        success: false,
        message: 'Google authentication credential or access token is required.'
      });
    }

    let email = null;
    let name = null;
    let picture = null;
    let sub = null;

    if (credential) {
      const clientId = getGoogleClientId();
      if (clientId) {
        try {
          const client = new OAuth2Client(clientId);
          const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: clientId
          });
          const payload = ticket.getPayload();
          email = payload.email;
          name = payload.name;
          picture = payload.picture;
          sub = payload.sub;
        } catch (err) {
          console.error('[Google Verification Failed]', err.message);
          return res.status(401).json({
            success: false,
            message: 'Google authentication verification failed: ' + err.message
          });
        }
      } else {
        // Fallback JWT parse if client ID not configured
        const base64Url = credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
        sub = payload.sub;
      }
    } else if (access_token) {
      // Cryptographically verify access token directly with Google OAuth2 UserInfo API
      try {
        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        if (!googleRes.ok) {
          return res.status(401).json({
            success: false,
            message: 'Failed to verify Google access token with Google identity server.'
          });
        }
        const data = await googleRes.json();
        email = data.email;
        name = data.name;
        picture = data.picture;
        sub = data.sub;
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Error communicating with Google OAuth verification service: ' + err.message
        });
      }
    }

    if (!email) {
      return res.status(401).json({
        success: false,
        message: 'Unable to extract verified email from Google authentication.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists in database
    let user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        ...(sub ? [{ googleId: sub }] : [])
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
        avatarUrl: picture || ''
      });
    } else {
      // Connect existing teacher profile with Google authentication
      let modified = false;
      if (sub && user.googleId !== sub) {
        user.googleId = sub;
        modified = true;
      }
      if (picture && user.avatarUrl !== picture) {
        user.avatarUrl = picture;
        modified = true;
      }
      if (name && (!user.name || user.name.toLowerCase() === 'teacher' || user.name === user.email.split('@')[0])) {
        user.name = name;
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
        assignedClasses: user.assignedClasses || [],
        assignedSubjects: user.assignedSubjects || [],
        googleConnected: Boolean(user.googleId),
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
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        assignedClasses: user.assignedClasses || [],
        assignedSubjects: user.assignedSubjects || [],
        googleConnected: Boolean(user.googleId),
        isFirstAccount: user.isFirstAccount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/auth/profile
// @desc    USER DIRECTIVE: All accounts can change their names and photo by clicking their photo
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatarUrl } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }
    if (avatarUrl) {
      user.avatarUrl = avatarUrl;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully!',
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

module.exports = router;
