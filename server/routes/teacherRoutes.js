const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');

// Require authentication for all teacher routes
router.use(authMiddleware);

// Helper to get Gravatar URL based on email
function getGravatarUrl(email) {
  if (!email) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face';
  const cleanEmail = email.trim().toLowerCase();
  const hash = crypto.createHash('md5').update(cleanEmail).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=150`;
}

// @route   GET /api/teachers
// @desc    Get all teachers with assigned classes, subjects, google connection status, and session counts
router.get('/', async (req, res) => {
  try {
    const teachers = await User.find().select('-password').sort({ createdAt: -1 }).lean();

    // Compute live attendance session counts for each teacher
    const enrichedTeachers = await Promise.all(
      teachers.map(async (t) => {
        const emailLower = (t.email || '').toLowerCase();
        const teacherName = t.name || '';
        const assignedClasses = Array.isArray(t.assignedClasses) ? t.assignedClasses : [];
        const assignedSubjects = Array.isArray(t.assignedSubjects) ? t.assignedSubjects : [];

        // Match sessions marked by this teacher or assigned to this teacher
        const orConditions = [];
        if (emailLower) {
          orConditions.push({ markedByEmail: emailLower });
        }
        if (teacherName) {
          orConditions.push({ markedBy: new RegExp(`^${teacherName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        }
        if (assignedClasses.length > 0 && assignedSubjects.length > 0) {
          orConditions.push({
            class: { $in: assignedClasses },
            subject: { $in: assignedSubjects }
          });
        }

        let sessionCount = 0;
        if (orConditions.length > 0) {
          sessionCount = await Attendance.countDocuments({ $or: orConditions });
        }

        return {
          ...t,
          assignedClasses,
          assignedSubjects,
          googleConnected: Boolean(t.googleId),
          sessionCount
        };
      })
    );

    res.json({
      success: true,
      data: enrichedTeachers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/teachers/:id
// @desc    Get a single teacher profile
router.get('/:id', async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id).select('-password').lean();
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    res.json({
      success: true,
      data: {
        ...teacher,
        assignedClasses: teacher.assignedClasses || [],
        assignedSubjects: teacher.assignedSubjects || [],
        googleConnected: Boolean(teacher.googleId)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/teachers/:id/logs
// @desc    USER DIRECTIVE: Log button for how many classes attended in which days in which class, and how many sessions
router.get('/:id/logs', async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id).select('-password').lean();
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const emailLower = (teacher.email || '').toLowerCase();
    const teacherName = teacher.name || '';
    const assignedClasses = Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses : [];
    const assignedSubjects = Array.isArray(teacher.assignedSubjects) ? teacher.assignedSubjects : [];

    const orConditions = [];
    if (emailLower) {
      orConditions.push({ markedByEmail: emailLower });
    }
    if (teacherName) {
      orConditions.push({ markedBy: new RegExp(`^${teacherName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    }
    if (assignedClasses.length > 0 && assignedSubjects.length > 0) {
      orConditions.push({
        class: { $in: assignedClasses },
        subject: { $in: assignedSubjects }
      });
    }

    let sessions = [];
    if (orConditions.length > 0) {
      sessions = await Attendance.find({ $or: orConditions }).sort({ date: -1, createdAt: -1 }).lean();
    }

    // Compute stats
    const uniqueDates = new Set();
    const uniqueClasses = new Set();
    const uniqueSubjects = new Set();
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;

    sessions.forEach(s => {
      if (s.date) uniqueDates.add(s.date);
      if (s.class) uniqueClasses.add(s.class);
      if (s.subject && s.subject !== 'all') uniqueSubjects.add(s.subject);
      if (s.summary) {
        totalPresent += (s.summary.present || 0);
        totalAbsent += (s.summary.absent || 0);
        totalLate += (s.summary.late || 0);
      }
    });

    res.json({
      success: true,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        avatarUrl: teacher.avatarUrl,
        assignedClasses,
        assignedSubjects,
        googleConnected: Boolean(teacher.googleId)
      },
      stats: {
        totalSessions: sessions.length,
        totalDays: uniqueDates.size,
        classesCount: uniqueClasses.size,
        classesList: Array.from(uniqueClasses),
        subjectsList: Array.from(uniqueSubjects),
        totalPresent,
        totalAbsent,
        totalLate
      },
      sessions: sessions.map(s => ({
        id: s._id,
        date: s.date,
        class: s.class,
        subject: s.subject,
        summary: s.summary || { total: 0, present: 0, absent: 0, late: 0, percentage: 0 },
        markedBy: s.markedBy || 'Teacher',
        markedByEmail: s.markedByEmail || '',
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/teachers
// @desc    USER DIRECTIVE: Add teacher with photo(email-connected), name, email, assigned classes & subjects
router.post('/', async (req, res) => {
  try {
    const { name, email, password, avatarUrl, assignedClasses, assignedSubjects, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Teacher name and email are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An account with email "${normalizedEmail}" already exists. You can edit this teacher.`
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || 'teacher123', salt);

    // Fallback avatar: provided photoUrl or email gravatar
    const finalAvatar = avatarUrl && avatarUrl.trim()
      ? avatarUrl.trim()
      : getGravatarUrl(normalizedEmail);

    const classesArray = Array.isArray(assignedClasses)
      ? assignedClasses.map(c => String(c).trim()).filter(Boolean)
      : (typeof assignedClasses === 'string' && assignedClasses.trim() ? assignedClasses.split(',').map(c => c.trim()).filter(Boolean) : []);

    const subjectsArray = Array.isArray(assignedSubjects)
      ? assignedSubjects.map(s => String(s).trim()).filter(Boolean)
      : (typeof assignedSubjects === 'string' && assignedSubjects.trim() ? assignedSubjects.split(',').map(s => s.trim()).filter(Boolean) : []);

    const newTeacher = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'teacher',
      avatarUrl: finalAvatar,
      assignedClasses: classesArray,
      assignedSubjects: subjectsArray,
      phone: phone ? String(phone).trim() : ''
    });

    await ActivityLog.create({
      action: `Teacher Profile Created: ${newTeacher.name}`,
      details: `Email: ${newTeacher.email} | Classes: ${classesArray.join(', ') || 'None'} | Subjects: ${subjectsArray.join(', ') || 'None'}`,
      performedBy: req.user ? req.user.name : 'Admin',
      role: req.user ? req.user.role : 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.status(201).json({
      success: true,
      message: `Teacher "${newTeacher.name}" created successfully. Profile will connect upon Google login.`,
      data: {
        id: newTeacher._id,
        name: newTeacher.name,
        email: newTeacher.email,
        role: newTeacher.role,
        avatarUrl: newTeacher.avatarUrl,
        assignedClasses: newTeacher.assignedClasses,
        assignedSubjects: newTeacher.assignedSubjects,
        googleConnected: false,
        sessionCount: 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/teachers/:id
// @desc    USER DIRECTIVE: Edit teacher details (photo, name, email, classes, subjects)
router.put('/:id', async (req, res) => {
  try {
    const { name, email, avatarUrl, assignedClasses, assignedSubjects, phone, role } = req.body;
    const teacher = await User.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const oldName = teacher.name;
    if (name && name.trim()) teacher.name = name.trim();

    if (email && email.trim()) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== teacher.email) {
        const conflict = await User.findOne({ email: normalizedEmail, _id: { $ne: teacher._id } });
        if (conflict) {
          return res.status(400).json({ success: false, message: `Email "${normalizedEmail}" is already in use by another account.` });
        }
        teacher.email = normalizedEmail;
      }
    }

    if (avatarUrl && avatarUrl.trim()) {
      teacher.avatarUrl = avatarUrl.trim();
    }

    if (assignedClasses !== undefined) {
      teacher.assignedClasses = Array.isArray(assignedClasses)
        ? assignedClasses.map(c => String(c).trim()).filter(Boolean)
        : (typeof assignedClasses === 'string' && assignedClasses.trim() ? assignedClasses.split(',').map(c => c.trim()).filter(Boolean) : []);
    }

    if (assignedSubjects !== undefined) {
      teacher.assignedSubjects = Array.isArray(assignedSubjects)
        ? assignedSubjects.map(s => String(s).trim()).filter(Boolean)
        : (typeof assignedSubjects === 'string' && assignedSubjects.trim() ? assignedSubjects.split(',').map(s => s.trim()).filter(Boolean) : []);
    }

    if (phone !== undefined) {
      teacher.phone = String(phone).trim();
    }

    if (role && (role === 'admin' || role === 'teacher')) {
      teacher.role = role;
    }

    await teacher.save();

    await ActivityLog.create({
      action: `Teacher Profile Updated: ${teacher.name}`,
      details: `Updated by ${req.user ? req.user.name : 'User'}`,
      performedBy: req.user ? req.user.name : 'Admin',
      role: req.user ? req.user.role : 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.json({
      success: true,
      message: `Teacher "${teacher.name}" updated successfully.`,
      data: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        avatarUrl: teacher.avatarUrl,
        assignedClasses: teacher.assignedClasses,
        assignedSubjects: teacher.assignedSubjects,
        googleConnected: Boolean(teacher.googleId)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/teachers/:id
// @desc    USER DIRECTIVE: Delete teacher account
router.delete('/:id', async (req, res) => {
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
          message: 'Cannot delete the only remaining Admin account'
        });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    await ActivityLog.create({
      action: `Teacher Account Deleted: ${teacher.name}`,
      details: `Email: ${teacher.email} deleted by ${req.user ? req.user.name : 'Admin'}`,
      performedBy: req.user ? req.user.name : 'Admin',
      role: req.user ? req.user.role : 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.json({
      success: true,
      message: `Teacher "${teacher.name}" has been removed.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
