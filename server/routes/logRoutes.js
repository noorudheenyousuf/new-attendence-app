const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const { caseInsensitiveRegex } = require('../utils/caseHelper');

// @route   GET /api/logs
// @desc    Get activity logs (includes counts of present, absent, late, and optional email filtering)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { email, limit } = req.query;
    let query = {};
    if (email && email.trim()) {
      const cleanEmail = email.trim();
      query = {
        $or: [
          { performedByEmail: caseInsensitiveRegex(cleanEmail) },
          { performedBy: caseInsensitiveRegex(cleanEmail) }
        ]
      };
    }
    const maxLimit = Math.min(parseInt(limit, 10) || 100, 200);
    const logs = await ActivityLog.find(query).sort({ createdAt: -1 }).limit(maxLimit);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/logs/:id/undo
// @desc    Undo an activity log (Admin only! Non-admin accounts cannot undo)
router.post('/:id/undo', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const log = await ActivityLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Log entry not found' });
    }

    if (log.isUndone) {
      return res.status(400).json({ success: false, message: 'This action has already been undone' });
    }

    // Helper to clean previous state (remove _id and __v so Mongoose doesn't error on immutable _id)
    const cleanState = (state) => {
      if (!state || typeof state !== 'object') return state;
      const { _id, __v, ...rest } = state;
      return rest;
    };

    // Revert logic based on entityType
    if (log.entityType === 'attendance') {
      if (log.previousState) {
        await Attendance.findByIdAndUpdate(log.entityId, { $set: cleanState(log.previousState) }, { upsert: true });
      } else {
        await Attendance.findByIdAndDelete(log.entityId);
      }
    } else if (log.entityType === 'student') {
      if (log.previousState) {
        await Student.findByIdAndUpdate(log.entityId, { $set: cleanState(log.previousState) }, { upsert: true });
      } else {
        await Student.findByIdAndDelete(log.entityId);
      }
    } else if (log.entityType === 'subject') {
      if (log.previousState) {
        await Subject.findByIdAndUpdate(log.entityId, { $set: cleanState(log.previousState) }, { upsert: true });
      } else {
        await Subject.findByIdAndDelete(log.entityId);
      }
    } else if (log.entityType === 'class') {
      if (log.previousState) {
        await Class.findByIdAndUpdate(log.entityId, { $set: cleanState(log.previousState) }, { upsert: true });
      } else {
        await Class.findByIdAndDelete(log.entityId);
      }
    }

    log.isUndone = true;
    await log.save();

    res.json({
      success: true,
      message: `Action "${log.action}" was successfully reverted`,
      data: log
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
