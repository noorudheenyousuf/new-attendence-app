const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const ActivityLog = require('../models/ActivityLog');
const AppSettings = require('../models/AppSettings');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const authMiddleware = require('../middleware/auth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

const canUserManage = async (user) => {
  if (user && user.role === 'admin') return true;
  const settings = await AppSettings.findOne();
  return Boolean(settings && settings.allowNonAdminEditDelete);
};

// Helper to get Gravatar URL based on email
function getGravatarUrl(email) {
  if (!email) return '';
  const cleanEmail = email.trim().toLowerCase();
  const hash = crypto.createHash('md5').update(cleanEmail).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=150`;
}

// @route   GET /api/teachers
// @desc    Get all teachers with assigned classes, subjects, google connection status, and session counts
// Supports query: ?year=2026&class=Class+10
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { year, class: classFilter } = req.query;
    const teachers = await User.find().select('-password').sort({ order: 1, createdAt: -1 }).lean();

    // Fetch distinct dates to extract all available academic years in attendance
    const allDates = await Attendance.distinct('date');
    const detectedYears = new Set();
    const currentYear = new Date().getFullYear().toString();
    detectedYears.add(currentYear);
    allDates.forEach(d => {
      if (typeof d === 'string' && d.length >= 4) {
        const yr = d.substring(0, 4);
        if (/^\d{4}$/.test(yr)) detectedYears.add(yr);
      }
    });
    const availableYears = Array.from(detectedYears).sort().reverse();

    // Load active subjects & classes to dynamically derive teacher assignments
    const allSubjects = await Subject.find({}).lean();
    const allClasses = await Class.find({}).lean();

    // Compute live attendance session counts for each teacher based on year & class
    const enrichedTeachers = await Promise.all(
      teachers.map(async (t) => {
        const emailLower = (t.email || '').toLowerCase();
        const teacherName = t.name || '';
        const normName = teacherName.trim().toLowerCase();

        // Dynamically derive assigned subjects & classes from Subject and Class collections
        const tSubs = allSubjects.filter(s => {
          const sTeacher = (s.teacher || '').trim().toLowerCase();
          const sOwner = (s.ownerEmail || '').trim().toLowerCase();
          return (normName && sTeacher === normName) || (emailLower && sOwner === emailLower);
        });

        const assignedSubjects = Array.from(new Set(tSubs.map(s => s.name.trim()).filter(Boolean)));
        const classesFromSubs = tSubs.flatMap(s => s.assignedClasses || []);
        const classesAsClassTeacher = allClasses.filter(c => (c.classTeacher || '').trim().toLowerCase() === normName).map(c => c.name);
        const assignedClasses = Array.from(new Set([...classesFromSubs, ...classesAsClassTeacher].map(c => String(c).trim()).filter(Boolean)));
        const classTeacherOf = t.classTeacherOf || classesAsClassTeacher[0] || '';

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
        let totalAllTimeSessions = 0;

        if (orConditions.length > 0) {
          totalAllTimeSessions = await Attendance.countDocuments({ $or: orConditions });

          // Specific filtered count
          const query = { $or: orConditions };
          if (year && year !== 'all') {
            query.date = { $regex: `^${year}` };
          }
          if (classFilter && classFilter !== 'all') {
            query.class = caseInsensitiveRegex(classFilter);
          }
          sessionCount = await Attendance.countDocuments(query);
        }

        return {
          ...t,
          assignedClasses,
          assignedSubjects,
          classTeacherOf,
          googleConnected: Boolean(t.googleId),
          sessionCount,
          totalAllTimeSessions
        };
      })
    );

    res.json({
      success: true,
      data: enrichedTeachers,
      availableYears
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/teachers/:id
// @desc    Get a single teacher profile
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id).select('-password').lean();
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    const allSubjects = await Subject.find({}).lean();
    const allClasses = await Class.find({}).lean();
    const normName = (teacher.name || '').trim().toLowerCase();
    const normEmail = (teacher.email || '').trim().toLowerCase();
    const tSubs = allSubjects.filter(s => {
      const sTeacher = (s.teacher || '').trim().toLowerCase();
      const sOwner = (s.ownerEmail || '').trim().toLowerCase();
      return (normName && sTeacher === normName) || (normEmail && sOwner === normEmail);
    });
    const assignedSubjects = Array.from(new Set(tSubs.map(s => s.name.trim()).filter(Boolean)));
    const classesFromSubs = tSubs.flatMap(s => s.assignedClasses || []);
    const classesAsClassTeacher = allClasses.filter(c => (c.classTeacher || '').trim().toLowerCase() === normName).map(c => c.name);
    const assignedClasses = Array.from(new Set([...classesFromSubs, ...classesAsClassTeacher].map(c => String(c).trim()).filter(Boolean)));
    const classTeacherOf = teacher.classTeacherOf || classesAsClassTeacher[0] || '';
    res.json({
      success: true,
      data: {
        ...teacher,
        classTeacherOf,
        assignedClasses,
        assignedSubjects,
        googleConnected: Boolean(teacher.googleId)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/teachers/:id/logs
// @desc    USER DIRECTIVE: Log button for how many classes attended in which days in which class, and how many sessions
// Supports query: ?year=2026&class=Class+10
router.get('/:id/logs', authMiddleware, async (req, res) => {
  try {
    const { year, class: classFilter } = req.query;
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

    let allSessions = [];
    if (orConditions.length > 0) {
      allSessions = await Attendance.find({ $or: orConditions }).sort({ date: -1, createdAt: -1 }).lean();
    }

    // Extract available years for this teacher's sessions
    const sessionYears = new Set();
    const currentYear = new Date().getFullYear().toString();
    sessionYears.add(currentYear);
    allSessions.forEach(s => {
      if (s.date && s.date.length >= 4) {
        const yr = s.date.substring(0, 4);
        if (/^\d{4}$/.test(yr)) sessionYears.add(yr);
      }
    });
    const availableYears = Array.from(sessionYears).sort().reverse();

    // Filter sessions by requested year and class
    let filteredSessions = allSessions;
    if (year && year !== 'all') {
      filteredSessions = filteredSessions.filter(s => s.date && s.date.startsWith(year));
    }
    if (classFilter && classFilter !== 'all') {
      filteredSessions = filteredSessions.filter(s => s.class === classFilter);
    }

    // Compute stats
    const uniqueDates = new Set();
    const uniqueClasses = new Set();
    const uniqueSubjects = new Set();
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;

    filteredSessions.forEach(s => {
      if (s.date) uniqueDates.add(s.date);
      if (s.class) uniqueClasses.add(s.class);
      if (s.subject && s.subject !== 'all') uniqueSubjects.add(s.subject);
      if (s.summary) {
        totalPresent += (s.summary.present || 0);
        totalAbsent += (s.summary.absent || 0);
        totalLate += (s.summary.leave || s.summary.late || 0);
      }
    });

    // Also get all unique classes from all sessions to populate class filter
    const allClassesInHistory = Array.from(new Set(allSessions.map(s => s.class).filter(Boolean)));

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
        totalSessions: filteredSessions.length,
        allTimeTotalSessions: allSessions.length,
        totalDays: uniqueDates.size,
        classesCount: uniqueClasses.size,
        classesList: allClassesInHistory,
        subjectsList: Array.from(uniqueSubjects),
        totalPresent,
        totalAbsent,
        totalLeave: totalLate,
        totalLate
      },
      availableYears,
      sessions: filteredSessions.map(s => ({
        id: s._id,
        date: s.date,
        class: s.class,
        subject: s.subject,
        summary: s.summary ? {
          ...s.summary,
          leave: s.summary.leave !== undefined ? s.summary.leave : (s.summary.late || 0)
        } : { total: 0, present: 0, absent: 0, leave: 0, late: 0, percentage: 0 },
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
// @desc    USER DIRECTIVE: Add teacher with name, optional email, photo, assigned classes & subjects
router.post('/', authMiddleware, async (req, res) => {
  try {
    const allowed = await canUserManage(req.user);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Permission denied: Admin privileges required to add teachers' });
    }

    const { name, email, password, avatarUrl, assignedClasses, assignedSubjects, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Teacher name is required' });
    }

    let normalizedEmail = undefined;
    if (email && email.trim()) {
      normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `An account with email "${normalizedEmail}" already exists. You can edit this teacher.`
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || 'teacher123', salt);

    // Fallback avatar: provided photoUrl, or email gravatar, or empty (simple account avatar)
    const finalAvatar = avatarUrl && avatarUrl.trim()
      ? avatarUrl.trim()
      : (normalizedEmail ? getGravatarUrl(normalizedEmail) : '');

    const classesArray = Array.isArray(assignedClasses)
      ? assignedClasses.map(c => String(c).trim()).filter(Boolean)
      : (typeof assignedClasses === 'string' && assignedClasses.trim() ? assignedClasses.split(',').map(c => c.trim()).filter(Boolean) : []);

    const subjectsArray = Array.isArray(assignedSubjects)
      ? assignedSubjects.map(s => String(s).trim()).filter(Boolean)
      : (typeof assignedSubjects === 'string' && assignedSubjects.trim() ? assignedSubjects.split(',').map(s => s.trim()).filter(Boolean) : []);

    const teacherData = {
      name: name.trim(),
      password: hashedPassword,
      role: 'teacher',
      avatarUrl: finalAvatar,
      assignedClasses: classesArray,
      assignedSubjects: subjectsArray,
      phone: phone ? String(phone).trim() : ''
    };
    if (normalizedEmail) {
      teacherData.email = normalizedEmail;
    }

    const newTeacher = await User.create(teacherData);

    await ActivityLog.create({
      action: `Teacher Profile Created: ${newTeacher.name}`,
      details: `Email: ${newTeacher.email || 'None'} | Classes: ${classesArray.join(', ') || 'None'} | Subjects: ${subjectsArray.join(', ') || 'None'}`,
      performedBy: req.user ? req.user.name : 'Admin',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: req.user ? req.user.role : 'admin',
      entityType: 'settings',
      canUndo: false
    });

    res.status(201).json({
      success: true,
      message: `Teacher "${newTeacher.name}" created successfully.` + (newTeacher.email ? ' Profile will connect upon Google login.' : ''),
      data: {
        id: newTeacher._id,
        name: newTeacher.name,
        email: newTeacher.email || '',
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

// @route   PUT /api/teachers/reorder
// @desc    Update teachers display order via drag-and-drop
router.put('/reorder', authMiddleware, async (req, res) => {
  try {
    const allowed = await canUserManage(req.user);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Permission denied: Cannot reorder teachers' });
    }

    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ success: false, message: 'orderedIds array required' });
    }

    const updatePromises = orderedIds.map((id, index) =>
      User.findByIdAndUpdate(id, { order: index })
    );
    await Promise.all(updatePromises);
    res.json({ success: true, message: 'Teachers reordered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/teachers/:id
// @desc    USER DIRECTIVE: Edit teacher details (photo, name, email, classes, subjects)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const isSelf = req.user && req.user._id && req.user._id.toString() === req.params.id;
    const allowed = isSelf || (await canUserManage(req.user));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Permission denied: Cannot edit other teacher profiles' });
    }

    const { name, email, avatarUrl, assignedClasses, assignedSubjects, phone, role, classTeacherOf } = req.body;
    const teacher = await User.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const oldName = teacher.name;
    const nameChanged = Boolean(name && name.trim() && name.trim() !== oldName);
    if (name && name.trim()) teacher.name = name.trim();

    const oldEmail = (teacher.email || '').toLowerCase().trim();
    let emailChanged = false;

    if (email !== undefined) {
      const trimmedEmail = (email || '').toLowerCase().trim();
      if (trimmedEmail) {
        if (trimmedEmail !== oldEmail) {
          const conflict = await User.findOne({ email: trimmedEmail, _id: { $ne: teacher._id } });
          if (conflict) {
            return res.status(400).json({ success: false, message: `Email "${trimmedEmail}" is already in use by another account.` });
          }
          teacher.email = trimmedEmail;
          emailChanged = true;
        }
      } else {
        teacher.email = undefined;
        teacher.googleId = null;
        if (oldEmail) emailChanged = true;
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

    if (classTeacherOf !== undefined) {
      const newCT = String(classTeacherOf).trim();
      const oldCT = (teacher.classTeacherOf || '').trim();
      teacher.classTeacherOf = newCT;
      try {
        if (newCT) {
          await User.updateMany({ _id: { $ne: teacher._id }, classTeacherOf: caseInsensitiveRegex(newCT) }, { $set: { classTeacherOf: '' } });
          if (oldCT && oldCT.toLowerCase() !== newCT.toLowerCase()) {
            await Class.updateMany({ name: caseInsensitiveRegex(oldCT), classTeacher: teacher.name }, { $set: { classTeacher: 'Not Assigned', classTeacherEmail: '' } });
          }
          await Class.updateMany({ name: caseInsensitiveRegex(newCT) }, { $set: { classTeacher: teacher.name, classTeacherEmail: (teacher.email || '').toLowerCase().trim() } });
        } else if (oldCT) {
          await Class.updateMany({ name: caseInsensitiveRegex(oldCT), classTeacher: teacher.name }, { $set: { classTeacher: 'Not Assigned', classTeacherEmail: '' } });
        }
      } catch (ctErr) {
        console.error('[Teacher ClassTeacher Sync]', ctErr);
      }
    }

    // Role changes are strictly Admin only
    if (role && (role === 'admin' || role === 'teacher')) {
      if (req.user && req.user.role === 'admin') {
        teacher.role = role;
      }
    }

    await teacher.save();

    if (nameChanged) {
      await Attendance.updateMany({ markedBy: oldName }, { markedBy: teacher.name });
      await Subject.updateMany({ teacher: oldName }, { teacher: teacher.name });
      await Class.updateMany({ classTeacher: oldName }, { classTeacher: teacher.name });
      await Timetable.updateMany({ teacher: oldName }, { teacher: teacher.name });
    }

    if (emailChanged && oldEmail && teacher.email) {
      await Timetable.updateMany({ teacherEmail: oldEmail }, { teacherEmail: teacher.email });
    }

    await ActivityLog.create({
      action: `Teacher Profile Updated: ${teacher.name}`,
      details: `Updated by ${req.user ? req.user.name : 'User'}`,
      performedBy: req.user ? req.user.name : 'Admin',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
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
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const allowed = await canUserManage(req.user);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Permission denied: Admin privileges required to delete teachers' });
    }

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

    // Clean up timetable, subject, and class references to this teacher
    if (teacher.email) {
      await Timetable.deleteMany({ teacherEmail: teacher.email });
    }
    await Subject.updateMany({ teacher: teacher.name }, { teacher: '' });
    await Class.updateMany({ classTeacher: teacher.name }, { classTeacher: '' });

    await ActivityLog.create({
      action: `Teacher Account Deleted: ${teacher.name}`,
      details: `Email: ${teacher.email} deleted by ${req.user ? req.user.name : 'Admin'}`,
      performedBy: req.user ? req.user.name : 'Admin',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
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
