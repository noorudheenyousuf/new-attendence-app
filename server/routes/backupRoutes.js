const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const AppSettings = require('../models/AppSettings');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Only allow Admin to access Backup Export & Import/Restore
router.use(authMiddleware);
router.use(adminMiddleware);

// @route   GET /api/backup/export
// @desc    Admin export complete database backup as JSON (including full student & teacher details)
router.get('/export', async (req, res) => {
  try {
    const classes = await Class.find().lean();
    const subjects = await Subject.find().lean();
    const students = await Student.find().lean();
    const teachers = await User.find().lean();
    const attendance = await Attendance.find().lean();
    const settings = await AppSettings.findOne().lean();

    const backupData = {
      appName: (settings && settings.appName) ? settings.appName : 'REGISTERLY',
      exportDate: new Date().toISOString(),
      classes,
      subjects,
      students,
      teachers,
      attendance,
      settings
    };

    await ActivityLog.create({
      action: 'Database Backup Exported',
      details: `${students.length} Students, ${teachers.length} Teachers, ${classes.length} Classes, ${subjects.length} Subjects, ${attendance.length} Attendance Records (full details)`,
      performedBy: (req.user && req.user.name) ? req.user.name : 'Admin',
      role: (req.user && req.user.role) ? req.user.role : 'admin',
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
    const { classes, subjects, students, teachers, attendance, settings } = req.body;

    if (!Array.isArray(students) && !Array.isArray(classes) && !Array.isArray(teachers)) {
      return res.status(400).json({ success: false, message: 'Invalid backup file format' });
    }

    // 1. Restore classes
    if (Array.isArray(classes) && classes.length > 0) {
      for (const c of classes) {
        if (!c.name) continue;
        const { _id, __v, ...cData } = c;
        await Class.findOneAndUpdate(
          { name: c.name },
          { $set: cData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 2. Restore subjects
    if (Array.isArray(subjects) && subjects.length > 0) {
      for (const s of subjects) {
        if (!s.subjectCode && !s.name) continue;
        const filter = s.subjectCode ? { subjectCode: s.subjectCode } : { name: s.name };
        const { _id, __v, ...sData } = s;
        await Subject.findOneAndUpdate(
          filter,
          { $set: sData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 3. Restore students (Full student details: address, familyDetails, academicStatus, photoUrl, etc.)
    if (Array.isArray(students) && students.length > 0) {
      for (const st of students) {
        if (!st.studentId) continue;
        const { _id, __v, ...stData } = st;
        await Student.findOneAndUpdate(
          { studentId: st.studentId },
          { $set: stData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 4. Restore teachers (Full teacher details: name, email, avatarUrl, assignedClasses, assignedSubjects, role, phone, etc.)
    if (Array.isArray(teachers) && teachers.length > 0) {
      for (const t of teachers) {
        if (!t.email) continue;
        const { _id, __v, ...tData } = t;
        await User.findOneAndUpdate(
          { email: t.email.toLowerCase().trim() },
          { $set: tData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 5. Restore attendance
    if (Array.isArray(attendance) && attendance.length > 0) {
      for (const att of attendance) {
        const { _id, __v, ...attData } = att;
        await Attendance.findOneAndUpdate(
          { date: att.date, class: att.class, subject: att.subject },
          { $set: attData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 6. Restore settings
    if (settings && (settings.appName || settings.schoolName)) {
      const { _id, __v, ...setData } = settings;
      await AppSettings.findOneAndUpdate({}, { $set: setData }, { upsert: true, new: true });
    }

    await ActivityLog.create({
      action: 'Database Backup Restored',
      details: `${students ? students.length : 0} Students, ${teachers ? teachers.length : 0} Teachers, ${classes ? classes.length : 0} Classes, ${subjects ? subjects.length : 0} Subjects restored`,
      performedBy: (req.user && req.user.name) ? req.user.name : 'Admin',
      role: (req.user && req.user.role) ? req.user.role : 'admin',
      entityType: 'backup',
      canUndo: false
    });

    res.json({
      success: true,
      message: 'Database backup imported successfully. All students, teachers, and details restored.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
