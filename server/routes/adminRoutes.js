const express = require('express');
const router = express.Router();
const AppSettings = require('../models/AppSettings');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// All admin routes require auth and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// @route   GET /api/admin/settings
// @desc    Get App Name & School Name
router.get('/settings', async (req, res) => {
  try {
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = await AppSettings.create({
        appName: 'REGISTERLY',
        schoolName: 'St. Xavier Higher Secondary School'
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/admin/settings
// @desc    Update App Name & School Name
router.put('/settings', async (req, res) => {
  try {
    const { appName, schoolName } = req.body;
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    if (appName) settings.appName = appName;
    if (schoolName) settings.schoolName = schoolName;
    settings.updatedAt = new Date();
    await settings.save();

    await ActivityLog.create({
      action: 'App & School Settings Updated',
      details: `App Name: ${settings.appName} • School Name: ${settings.schoolName}`,
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers and entering accounts list
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: teachers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/teachers
// @desc    Admin manually adds a new teacher
router.post('/teachers', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || 'teacher123', salt);

    const newTeacher = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'teacher'
    });

    await ActivityLog.create({
      action: `Teacher Added: ${name}`,
      details: `Email: ${email}`,
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.status(201).json({
      success: true,
      data: {
        id: newTeacher._id,
        name: newTeacher.name,
        email: newTeacher.email,
        role: newTeacher.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/admin/teachers/:id
// @desc    Edit teacher name / details
router.put('/teachers/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const teacher = await User.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const oldName = teacher.name;
    teacher.name = name || teacher.name;
    await teacher.save();

    await ActivityLog.create({
      action: `Teacher Renamed: ${oldName} -> ${teacher.name}`,
      details: `Updated by Admin ${req.user.name}`,
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.json({ success: true, data: teacher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/admin/teachers/:id/make-admin
// @desc    Promote teacher account to Admin
router.put('/teachers/:id/make-admin', async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    teacher.role = 'admin';
    await teacher.save();

    await ActivityLog.create({
      action: `Account Promoted to Admin: ${teacher.name}`,
      details: `Promoted by Admin ${req.user.name}`,
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.json({ success: true, message: `${teacher.name} is now an Admin`, data: teacher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
