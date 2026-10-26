const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const AppSettings = require('../models/AppSettings');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Only allow Admin to access Backup Export & Import/Restore
router.use(authMiddleware);
router.use(adminMiddleware);

// @route   GET /api/backup/export
// @desc    Admin export complete database backup as JSON
router.get('/export', async (req, res) => {
  try {
    const classes = await Class.find();
    const subjects = await Subject.find();
    const students = await Student.find();
    const attendance = await Attendance.find();
    const settings = await AppSettings.findOne();

    const backupData = {
      appName: settings ? settings.appName : 'REGISTERLY',
      exportDate: new Date().toISOString(),
      classes,
      subjects,
      students,
      attendance,
      settings
    };

    await ActivityLog.create({
      action: 'Database Backup Exported',
      details: `${students.length} Students, ${classes.length} Classes, ${attendance.length} Attendance Records`,
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'backup',
      canUndo: false
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="REGISTERLY_backup_${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/backup/import
// @desc    Admin import / restore database from JSON file
router.post('/import', async (req, res) => {
  try {
    const { classes, subjects, students, attendance, settings } = req.body;

    if (!Array.isArray(students) && !Array.isArray(classes)) {
      return res.status(400).json({ success: false, message: 'Invalid backup file format' });
    }

    // Restore classes
    if (Array.isArray(classes) && classes.length > 0) {
      for (const c of classes) {
        await Class.findOneAndUpdate({ name: c.name }, c, { upsert: true });
      }
    }

    // Restore subjects
    if (Array.isArray(subjects) && subjects.length > 0) {
      for (const s of subjects) {
        await Subject.findOneAndUpdate({ subjectCode: s.subjectCode }, s, { upsert: true });
      }
    }

    // Restore students
    if (Array.isArray(students) && students.length > 0) {
      for (const st of students) {
        await Student.findOneAndUpdate({ studentId: st.studentId }, st, { upsert: true });
      }
    }

    // Restore attendance
    if (Array.isArray(attendance) && attendance.length > 0) {
      for (const att of attendance) {
        await Attendance.findOneAndUpdate(
          { date: att.date, class: att.class, subject: att.subject },
          att,
          { upsert: true }
        );
      }
    }

    // Restore settings
    if (settings && (settings.appName || settings.schoolName)) {
      await AppSettings.findOneAndUpdate({}, settings, { upsert: true });
    }

    await ActivityLog.create({
      action: 'Database Restored from Backup',
      details: `Import completed by Admin ${req.user.name}`,
      performedBy: req.user.name,
      role: 'admin',
      entityType: 'backup',
      canUndo: false
    });

    res.json({ success: true, message: 'Database restored successfully from backup' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
