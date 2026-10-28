const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const AppSettings = require('../models/AppSettings');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// @route   GET /api/admin/settings
// @desc    Get App Name, School Name, and Edit/Delete permissions (Accessible to all authenticated users)
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = await AppSettings.create({
        appName: 'REGISTERLY',
        schoolName: '',
        allowNonAdminEditDelete: false
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// All following admin routes require admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// @route   PUT /api/admin/settings
// @desc    Update App Name & School Name & Permissions
router.put('/settings', async (req, res) => {
  try {
    const { appName, schoolName, allowNonAdminEditDelete } = req.body;
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    if (appName !== undefined) settings.appName = (appName || '').trim();
    if (schoolName !== undefined) settings.schoolName = (schoolName || '').trim();
    if (allowNonAdminEditDelete !== undefined) settings.allowNonAdminEditDelete = Boolean(allowNonAdminEditDelete);
    settings.updatedAt = new Date();
    await settings.save();

    await ActivityLog.create({
      action: 'App & School Settings Updated',
      details: `App Name: ${settings.appName} • School Name: ${settings.schoolName} • Edit/Delete Access: ${settings.allowNonAdminEditDelete ? 'Enabled' : 'Disabled'}`,
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

// @route   PUT /api/admin/toggle-edit-delete-access
// @desc    Toggle non-admin access for edit and delete buttons across the app
router.put('/toggle-edit-delete-access', async (req, res) => {
  try {
    const { enabled } = req.body;
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    settings.allowNonAdminEditDelete = enabled !== undefined ? Boolean(enabled) : !settings.allowNonAdminEditDelete;
    settings.updatedAt = new Date();
    await settings.save();

    await ActivityLog.create({
      action: `Edit/Delete Button Access ${settings.allowNonAdminEditDelete ? 'Enabled' : 'Disabled'}`,
      details: `Access for non-admin edit/delete buttons ${settings.allowNonAdminEditDelete ? 'granted' : 'revoked'} by Admin`,
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.json({
      success: true,
      allowNonAdminEditDelete: settings.allowNonAdminEditDelete,
      data: settings
    });
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

// @route   PUT /api/admin/teachers/:id/toggle-admin (also supports /make-admin)
// @desc    Toggle account between Admin and Teacher role
router.put(['/teachers/:id/toggle-admin', '/teachers/:id/make-admin'], async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Toggle role: if admin, become teacher; if teacher, become admin
    const newRole = teacher.role === 'admin' ? 'teacher' : 'admin';
    teacher.role = newRole;
    await teacher.save();

    const isNowAdmin = newRole === 'admin';
    await ActivityLog.create({
      action: isNowAdmin ? `Account Promoted to Admin: ${teacher.name}` : `Admin Privileges Removed: ${teacher.name}`,
      details: isNowAdmin ? `Promoted by Admin ${req.user.name}` : `Demoted to Teacher by Admin ${req.user.name}`,
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.json({
      success: true,
      message: isNowAdmin ? `${teacher.name} is now an Admin` : `${teacher.name} is now a Teacher`,
      data: teacher
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/admin/teachers/:id
// @desc    USER DIRECTIVE: Remove a teacher / entering account
router.delete('/teachers/:id', async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher account not found' });
    }

    // Safety: prevent deleting the last admin
    if (teacher.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the only remaining admin account'
        });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    await ActivityLog.create({
      action: `Teacher Account Removed: ${teacher.name}`,
      details: `Email: ${teacher.email} (${teacher.role}) deleted by admin ${req.user ? req.user.name : ''}`,
      performedBy: req.user ? req.user.name : 'Admin',
      role: 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.json({
      success: true,
      message: `Account "${teacher.name}" removed successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/clear-data
// @desc    USER DIRECTIVE: Clear ONLY whole class attendance data (keeps teachers, students, class, subjects, details intact)
router.post('/clear-data', async (req, res) => {
  try {
    await Attendance.deleteMany({});

    await ActivityLog.create({
      action: 'Attendance Records Cleared',
      details: 'All class attendance records cleared by Admin (students, classes, subjects preserved)',
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'attendance',
      canUndo: false
    });

    res.json({ success: true, message: 'All class attendance records have been cleared. Students, classes, and subjects remain intact.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/reset-app
// @desc    USER DIRECTIVE: Clear all app data like new
router.post('/reset-app', async (req, res) => {
  try {
    // Clear all app records like brand new
    await Student.deleteMany({});
    await Attendance.deleteMany({});
    await Subject.deleteMany({});
    await Class.deleteMany({});
    await ActivityLog.deleteMany({});

    let settings = await AppSettings.findOne();
    if (settings) {
      settings.appName = 'REGISTERLY';
      settings.schoolName = '';
      settings.allowNonAdminEditDelete = false;
      await settings.save();
    }

    await ActivityLog.create({
      action: 'Application Reset Like New',
      details: 'All data cleared like brand new by Admin',
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.json({ success: true, message: 'Application has been reset like brand new. All data cleared.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
