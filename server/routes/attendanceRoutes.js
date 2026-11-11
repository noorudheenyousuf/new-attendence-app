const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// @route   GET /api/attendance
// @desc    Get attendance for date, class, and subject (case-insensitive)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { date, class: className, subject } = req.query;
    if (!date || !className) {
      return res.status(400).json({ success: false, message: 'Date and Class are required' });
    }

    const targetSubject = subject || 'all';
    const record = await Attendance.findOne({
      date,
      class: caseInsensitiveRegex(className),
      subject: caseInsensitiveRegex(targetSubject)
    });

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/attendance
// @desc    Save or update attendance session (case-insensitive check)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { date, class: className, subject, records } = req.body;
    if (!date || !className || !records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Invalid attendance submission payload' });
    }

    const cleanClass = className.trim();
    const targetSubject = (subject || 'all').trim();

    // Calculate counts
    const total = records.length;
    const present = records.filter(r => r.status === 'P').length;
    const absent = records.filter(r => r.status === 'A').length;
    const leave = records.filter(r => r.status === 'L').length;
    const percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;

    const summary = { total, present, absent, leave, late: leave, percentage };
    const markedBy = req.user ? req.user.name : 'Teacher';
    const markedByEmail = (req.user && req.user.email) ? req.user.email.toLowerCase() : '';

    const previousDoc = await Attendance.findOne({
      date,
      class: caseInsensitiveRegex(cleanClass),
      subject: caseInsensitiveRegex(targetSubject)
    });

    // Capture previous state snapshot BEFORE mutating document
    const previousSnapshot = previousDoc ? previousDoc.toObject() : null;

    let updatedAttendance;
    if (previousDoc) {
      previousDoc.class = cleanClass;
      previousDoc.subject = targetSubject;
      previousDoc.records = records;
      previousDoc.summary = summary;
      previousDoc.markedBy = markedBy;
      previousDoc.markedByEmail = markedByEmail;
      updatedAttendance = await previousDoc.save();
    } else {
      updatedAttendance = await Attendance.create({
        date,
        class: cleanClass,
        subject: targetSubject,
        records,
        summary,
        markedBy,
        markedByEmail
      });
    }

    await ActivityLog.create({
      action: `Attendance Marked: ${cleanClass}`,
      details: `${present} Present, ${absent} Absent, ${leave} Leave (${percentage}%) • Date: ${date}`,
      performedBy: markedBy,
      role: req.user ? req.user.role : 'teacher',
      counts: { present, absent, leave, late: leave },
      entityType: 'attendance',
      entityId: updatedAttendance._id.toString(),
      canUndo: true,
      previousState: previousSnapshot
    });

    res.json({ success: true, data: updatedAttendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/attendance
// @desc    Delete recorded attendance for date, class, and subject (case-insensitive)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { date, class: className, subject } = req.query;
    if (!date || !className) {
      return res.status(400).json({ success: false, message: 'Date and Class are required' });
    }

    const targetSubject = subject || 'all';
    const deletedRecord = await Attendance.findOneAndDelete({
      date,
      class: caseInsensitiveRegex(className),
      subject: caseInsensitiveRegex(targetSubject)
    });

    if (deletedRecord) {
      await ActivityLog.create({
        action: `Attendance Deleted: ${className}`,
        details: `Deleted attendance record for ${className} • Subject: ${targetSubject} • Date: ${date}`,
        performedBy: req.user ? req.user.name : 'Teacher',
        role: req.user ? req.user.role : 'teacher',
        entityType: 'attendance',
        canUndo: false
      });
    }

    res.json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
