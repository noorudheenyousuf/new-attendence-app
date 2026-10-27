const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/attendance
// @desc    Get attendance for date, class, and subject
router.get('/', async (req, res) => {
  try {
    const { date, class: className, subject } = req.query;
    if (!date || !className) {
      return res.status(400).json({ success: false, message: 'Date and Class are required' });
    }

    const targetSubject = subject || 'all';
    const record = await Attendance.findOne({
      date,
      class: className,
      subject: targetSubject
    });

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

    const targetSubject = subject || 'all';

    // Calculate counts
    const total = records.length;
    const present = records.filter(r => r.status === 'P').length;
    const absent = records.filter(r => r.status === 'A').length;
    const late = records.filter(r => r.status === 'L').length;
    const percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;

    const summary = { total, present, absent, late, percentage };
    const markedBy = req.user ? req.user.name : 'Teacher';
    const markedByEmail = (req.user && req.user.email) ? req.user.email.toLowerCase() : '';

    const previousDoc = await Attendance.findOne({ date, class: className, subject: targetSubject });

    const updatedAttendance = await Attendance.findOneAndUpdate(
      { date, class: className, subject: targetSubject },
      {
        date,
        class: className,
        subject: targetSubject,
        records,
        summary,
        markedBy,
        markedByEmail
      },
      { upsert: true, new: true }
    );

    // USER DIRECTIVE: add in logs of attendance .....present,absent,late
    await ActivityLog.create({
      action: `Attendance Marked: ${className}`,
      details: `${present} Present, ${absent} Absent, ${late} Late (${percentage}%) • Date: ${date}`,
      performedBy: markedBy,
      role: req.user ? req.user.role : 'teacher',
      counts: { present, absent, late },
      entityType: 'attendance',
      entityId: updatedAttendance._id.toString(),
      canUndo: true,
      previousState: previousDoc ? previousDoc.toObject() : null
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
    const deletedRecord = await Attendance.findOneAndDelete({
      date,
      class: className,
      subject: targetSubject
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
