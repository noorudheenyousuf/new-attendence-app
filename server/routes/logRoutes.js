const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const AppSettings = require('../models/AppSettings');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/logs
// @desc    Get activity logs (includes counts of present, absent, late)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/logs/:id/undo
// @desc    Undo an activity log (Admin accounts or authorized roles)
router.post('/:id/undo', authMiddleware, async (req, res) => {
  try {
    const settings = await AppSettings.findOne();
    const isAdmin = req.user && req.user.role === 'admin';
    const allowNonAdmin = settings && settings.allowNonAdminEditDelete;

    if (!isAdmin && !allowNonAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: Admin privileges required to undo activity logs' });
    }

    const log = await ActivityLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Log entry not found' });
    }

    if (log.isUndone) {
      return res.status(400).json({ success: false, message: 'This action has already been undone' });
    }

    if (log.canUndo === false) {
      return res.status(400).json({ success: false, message: 'This action cannot be undone' });
    }

    // Helper to clean previous state (remove _id and __v so Mongoose doesn't error on immutable _id)
    const cleanState = (state) => {
      if (!state || typeof state !== 'object') return state;
      const { _id, __v, createdAt, updatedAt, ...rest } = state;
      return rest;
    };

    const hasValidEntityId = log.entityId && mongoose.Types.ObjectId.isValid(log.entityId);

    // Revert logic based on entityType
    if (log.entityType === 'attendance') {
      if (log.previousState) {
        const cleaned = cleanState(log.previousState);
        if (hasValidEntityId) {
          const existing = await Attendance.findById(log.entityId);
          if (existing) {
            await Attendance.findByIdAndUpdate(log.entityId, { $set: cleaned });
          } else {
            await Attendance.create({ ...cleaned, _id: log.entityId });
          }
        } else if (log.previousState.date && log.previousState.class) {
          await Attendance.findOneAndUpdate(
            { date: log.previousState.date, class: log.previousState.class, subject: log.previousState.subject || 'all' },
            { $set: cleaned },
            { upsert: true }
          );
        }
      } else if (hasValidEntityId) {
        // Attendance was created fresh; undo deletes the created record
        await Attendance.findByIdAndDelete(log.entityId);
      }
    } else if (log.entityType === 'student') {
      if (log.previousState) {
        const cleaned = cleanState(log.previousState);
        if (hasValidEntityId) {
          const existing = await Student.findById(log.entityId);
          if (existing) {
            await Student.findByIdAndUpdate(log.entityId, { $set: cleaned });
          } else {
            // Re-create deleted student
            await Student.create({ ...cleaned, _id: log.entityId });
          }
        } else if (log.previousState.studentId) {
          await Student.findOneAndUpdate(
            { studentId: log.previousState.studentId },
            { $set: cleaned },
            { upsert: true }
          );
        }
      } else if (hasValidEntityId) {
        // Student was enrolled fresh; undo deletes the created student
        await Student.findByIdAndDelete(log.entityId);
      }
    } else if (log.entityType === 'subject') {
      if (log.previousState) {
        const cleaned = cleanState(log.previousState);
        if (hasValidEntityId) {
          const existing = await Subject.findById(log.entityId);
          if (existing) {
            await Subject.findByIdAndUpdate(log.entityId, { $set: cleaned });
          } else {
            await Subject.create({ ...cleaned, _id: log.entityId });
          }
        } else {
          await Subject.create(cleaned);
        }
        // Re-add to assigned classes if applicable
        if (Array.isArray(cleaned.assignedClasses) && cleaned.name) {
          for (const cls of cleaned.assignedClasses) {
            await Class.updateOne({ name: cls }, { $addToSet: { assignedSubjects: cleaned.name } });
          }
        }
      } else if (hasValidEntityId) {
        const sub = await Subject.findById(log.entityId);
        if (sub) {
          if (Array.isArray(sub.assignedClasses)) {
            for (const cls of sub.assignedClasses) {
              await Class.updateOne({ name: cls }, { $pull: { assignedSubjects: sub.name } });
            }
          }
          await Subject.findByIdAndDelete(log.entityId);
        }
      }
    } else if (log.entityType === 'class') {
      if (log.previousState) {
        const cleaned = cleanState(log.previousState);
        if (hasValidEntityId) {
          const existing = await Class.findById(log.entityId);
          if (existing) {
            await Class.findByIdAndUpdate(log.entityId, { $set: cleaned });
          } else {
            await Class.create({ ...cleaned, _id: log.entityId });
          }
        } else if (cleaned.name) {
          await Class.findOneAndUpdate(
            { name: cleaned.name },
            { $set: cleaned },
            { upsert: true }
          );
        }
      } else if (hasValidEntityId) {
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
    console.error('[Undo Error]:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to undo action' });
  }
});

module.exports = router;
