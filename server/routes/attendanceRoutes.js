const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// @route   GET /api/attendance
// @desc    Get attendance for date, class, and subject (or all records for date if class not specified)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { date, class: className, subject, scope } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const cleanClassName = (typeof className === 'string' && className !== 'undefined' && className !== 'null') ? className.trim() : '';
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';

    // If className is not provided, return all attendance records for date (used for Live Campus Overview)
    if (!cleanClassName) {
      let query = { date };
      if (scope === 'public') {
        query.isPrivate = { $ne: true };
      } else if (scope === 'private') {
        if (!userEmail) return res.json({ success: true, data: [] });
        query.isPrivate = true;
        query.ownerEmail = userEmail;
      } else {
        // When no explicit scope is passed:
        // Exclude other users' private attendance records!
        if (!userEmail) {
          query.isPrivate = { $ne: true };
        } else if (req.user?.role !== 'admin') {
          query.$or = [
            { isPrivate: { $ne: true } },
            { isPrivate: true, ownerEmail: userEmail }
          ];
        }
      }
      const records = await Attendance.find(query);
      return res.json({ success: true, data: records });
    }

    const targetSubject = (subject && subject !== 'undefined' && subject !== 'null') ? subject.trim() : 'all';

    // Check if this class is private
    const classDoc = await Class.findOne({
      name: caseInsensitiveRegex(cleanClassName),
      ...(userEmail ? { $or: [{ isPrivate: { $ne: true } }, { isPrivate: true, ownerEmail: userEmail }] } : { isPrivate: { $ne: true } })
    });

    let query = {
      date,
      class: caseInsensitiveRegex(cleanClassName),
      subject: caseInsensitiveRegex(targetSubject)
    };

    if (classDoc && classDoc.isPrivate) {
      query.isPrivate = true;
      if (userEmail) query.ownerEmail = userEmail;
    }

    const record = await Attendance.findOne(query);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/attendance
// @desc    Save or update attendance session
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { date, class: className, subject, records } = req.body;
    if (!date || !className || !records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Invalid attendance submission payload' });
    }

    const cleanClass = className.trim();
    const targetSubject = (subject || 'all').trim();
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const markedBy = req.user ? req.user.name : 'Teacher';
    const markedByEmail = userEmail;

    // Check if class is private
    const classDoc = await Class.findOne({
      name: caseInsensitiveRegex(cleanClass),
      $or: [{ isPrivate: { $ne: true } }, { isPrivate: true, ownerEmail: userEmail }]
    });
    const isPrivate = Boolean(classDoc && classDoc.isPrivate);

    // Permission check: teachers can only mark attendance for their assigned classes/subjects
    if (req.user && req.user.role !== 'admin' && !isPrivate) {
      const normUser = (req.user.name || '').trim().toLowerCase();
      const normEmail = userEmail;
      const isClassTeacher = classDoc && (classDoc.classTeacher || '').trim().toLowerCase() === normUser;
      const userCTOf = ((req.user.classTeacherOf || '').trim().toLowerCase() === cleanClass.toLowerCase());

      const subjectDoc = await Subject.findOne({
        name: caseInsensitiveRegex(targetSubject),
        $or: [
          { assignedClasses: caseInsensitiveRegex(cleanClass) },
          { class: caseInsensitiveRegex(cleanClass) }
        ],
        $or: [
          { teacher: caseInsensitiveRegex(req.user.name) },
          { teacherEmail: normEmail }
        ]
      });

      const hasAssignedClass = (req.user.assignedClasses || []).some(c => c.trim().toLowerCase() === cleanClass.toLowerCase());

      if (!isClassTeacher && !userCTOf && !subjectDoc && !hasAssignedClass) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: You are not assigned to take attendance for Class "${cleanClass}" and Subject "${targetSubject}".`
        });
      }
    }

    // Calculate counts
    const total = records.length;
    const present = records.filter(r => r.status === 'P').length;
    const absent = records.filter(r => r.status === 'A').length;
    const leave = records.filter(r => r.status === 'L').length;
    const percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;

    const summary = { total, present, absent, leave, late: leave, percentage };

    let findQuery = {
      date,
      class: caseInsensitiveRegex(cleanClass),
      subject: caseInsensitiveRegex(targetSubject)
    };
    if (isPrivate) {
      findQuery.isPrivate = true;
      findQuery.ownerEmail = userEmail;
    } else {
      findQuery.isPrivate = { $ne: true };
    }

    const previousDoc = await Attendance.findOne(findQuery);
    const previousSnapshot = previousDoc ? previousDoc.toObject() : null;

    let updatedAttendance;
    if (previousDoc) {
      previousDoc.class = cleanClass;
      previousDoc.subject = targetSubject;
      previousDoc.records = records;
      previousDoc.summary = summary;
      previousDoc.markedBy = markedBy;
      previousDoc.markedByEmail = markedByEmail;
      previousDoc.isPrivate = isPrivate;
      previousDoc.ownerEmail = isPrivate ? userEmail : '';
      updatedAttendance = await previousDoc.save();
    } else {
      updatedAttendance = await Attendance.create({
        date,
        class: cleanClass,
        subject: targetSubject,
        records,
        summary,
        markedBy,
        markedByEmail,
        isPrivate,
        ownerEmail: isPrivate ? userEmail : ''
      });
    }

    await ActivityLog.create({
      action: `${isPrivate ? 'Private Attendance Marked' : 'Attendance Marked'}: ${cleanClass}`,
      details: `${present} Present, ${absent} Absent, ${leave} Leave (${percentage}%) • Date: ${date}`,
      performedBy: markedBy,
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: req.user ? req.user.role : 'teacher',
      counts: { present, absent, leave, late: leave },
      entityType: 'attendance',
      entityId: updatedAttendance._id.toString(),
      canUndo: true,
      previousState: previousSnapshot,
      isPrivate,
      ownerEmail: isPrivate ? userEmail : ''
    });

    res.json({ success: true, data: updatedAttendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/attendance
// @desc    Delete recorded attendance for date, class, and subject
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { date, class: className, subject } = req.query;
    if (!date || !className) {
      return res.status(400).json({ success: false, message: 'Date and Class are required' });
    }

    const targetSubject = subject || 'all';
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';

    const classDoc = await Class.findOne({
      name: caseInsensitiveRegex(className),
      $or: [{ isPrivate: { $ne: true } }, { isPrivate: true, ownerEmail: userEmail }]
    });
    const isPrivate = Boolean(classDoc && classDoc.isPrivate);

    let query = {
      date,
      class: caseInsensitiveRegex(className),
      subject: caseInsensitiveRegex(targetSubject)
    };
    if (isPrivate) {
      query.isPrivate = true;
      query.ownerEmail = userEmail;
    }

    const deletedRecord = await Attendance.findOneAndDelete(query);

    if (deletedRecord) {
      await ActivityLog.create({
        action: `${isPrivate ? 'Private Attendance Deleted' : 'Attendance Deleted'}: ${className}`,
        details: `Deleted attendance record for ${className} • Subject: ${targetSubject} • Date: ${date}`,
        performedBy: req.user ? req.user.name : 'Teacher',
        performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
        role: req.user ? req.user.role : 'teacher',
        entityType: 'attendance',
        canUndo: false,
        isPrivate,
        ownerEmail: isPrivate ? userEmail : ''
      });
    }

    res.json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
