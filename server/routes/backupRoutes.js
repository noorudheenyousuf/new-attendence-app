const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const AppSettings = require('../models/AppSettings');
const ActivityLog = require('../models/ActivityLog');
const Message    = require('../models/Message');
const Timetable  = require('../models/Timetable');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Only allow Admin to access Backup Export & Import/Restore
router.use(authMiddleware);
router.use(adminMiddleware);

// @route   GET /api/backup/export
// @desc    Admin export complete database backup as JSON (includes ALL data including private workspace)
router.get('/export', async (req, res) => {
  try {
    const classes = await Class.find().lean();
    const subjects = await Subject.find().lean();
    const students = await Student.find().lean();
    const teachers = await User.find().select('-password').lean();
    const attendance = await Attendance.find().lean();
    const settings = await AppSettings.findOne().lean();
    const messages     = await Message.find().lean();
    const timetable    = await Timetable.find().lean();
    const activityLogs = await ActivityLog.find().lean();

    const privateClasses  = classes.filter(c => c.isPrivate);
    const privateSubjects = subjects.filter(s => s.isPrivate);
    const privateStudents = students.filter(s => s.isPrivate);

    const backupData = {
      appName: (settings && settings.appName) ? settings.appName : 'REGISTERLY',
      exportDate: new Date().toISOString(),
      version: '2.0',
      classes,
      subjects,
      students,
      teachers,
      attendance,
      messages,
      timetable,
      activityLogs,
      settings,
      privateWorkspace: {
        classes: privateClasses,
        subjects: privateSubjects,
        students: privateStudents,
        count: {
          classes: privateClasses.length,
          subjects: privateSubjects.length,
          students: privateStudents.length
        }
      }
    };

    await ActivityLog.create({
      action: 'Database Backup Exported',
      details: `${students.length} Students (incl. ${privateStudents.length} private), ${teachers.length} Teachers, ${classes.length} Classes (incl. ${privateClasses.length} private), ${subjects.length} Subjects (incl. ${privateSubjects.length} private), ${attendance.length} Attendance Records`,
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
// @desc    Admin import / restore database from JSON file (preserves private workspace data)
router.post('/import', async (req, res) => {
  try {
    const { classes, subjects, students, teachers, attendance, messages, timetable, activityLogs, settings } = req.body;

    if (!Array.isArray(students) && !Array.isArray(classes) && !Array.isArray(teachers)) {
      return res.status(400).json({ success: false, message: 'Invalid backup file format' });
    }

    // 1. Restore classes (public + private — use name + ownerEmail + isPrivate as unique key)
    if (Array.isArray(classes) && classes.length > 0) {
      for (const c of classes) {
        if (!c.name) continue;
        const { _id, __v, ...cData } = c;
        const filter = c.isPrivate && c.ownerEmail
          ? { name: c.name, isPrivate: true, ownerEmail: c.ownerEmail }
          : { name: c.name, isPrivate: { $ne: true } };
        await Class.findOneAndUpdate(
          filter,
          { $set: cData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 2. Restore subjects
    if (Array.isArray(subjects) && subjects.length > 0) {
      for (const s of subjects) {
        if (!s.subjectCode && !s.name) continue;
        const { _id, __v, ...sData } = s;
        const filter = s.isPrivate && s.ownerEmail
          ? { name: s.name, ownerEmail: s.ownerEmail, isPrivate: true }
          : (s.subjectCode ? { subjectCode: s.subjectCode, isPrivate: { $ne: true } } : { name: s.name, isPrivate: { $ne: true } });
        await Subject.findOneAndUpdate(
          filter,
          { $set: sData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 3. Restore students (Full student details incl. private workspace students)
    if (Array.isArray(students) && students.length > 0) {
      for (const st of students) {
        if (st.studentId === undefined || st.studentId === null) continue;
        const { _id, __v, ...stData } = st;
        const filter = st.isPrivate && st.ownerEmail
          ? { studentId: st.studentId, isPrivate: true, ownerEmail: st.ownerEmail }
          : { studentId: st.studentId, isPrivate: { $ne: true } };
        await Student.findOneAndUpdate(
          filter,
          { $set: stData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 4. Restore teachers
    if (Array.isArray(teachers) && teachers.length > 0) {
      for (const t of teachers) {
        if (!t.name) continue;
        const { _id, __v, ...tData } = t;
        const filter = (t.email && t.email.trim())
          ? { email: t.email.toLowerCase().trim() }
          : (_id ? { _id } : { name: t.name });
        await User.findOneAndUpdate(
          filter,
          { $set: tData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 5. Restore attendance (private sessions use ownerEmail to avoid collisions)
    if (Array.isArray(attendance) && attendance.length > 0) {
      for (const att of attendance) {
        const { _id, __v, ...attData } = att;
        const filter = att.isPrivate && att.ownerEmail
          ? { date: att.date, class: att.class, subject: att.subject, isPrivate: true, ownerEmail: att.ownerEmail }
          : { date: att.date, class: att.class, subject: att.subject, isPrivate: { $ne: true } };
        await Attendance.findOneAndUpdate(
          filter,
          { $set: attData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 6. Restore messages
    if (Array.isArray(messages) && messages.length > 0) {
      await Message.deleteMany({});
      const msgDocs = messages.map(m => { const { _id, __v, ...d } = m; return d; });
      await Message.insertMany(msgDocs, { ordered: false });
    }

    // 7. Restore timetable
    if (Array.isArray(timetable) && timetable.length > 0) {
      await Timetable.deleteMany({});
      const allUsers = await User.find({}).select('_id name email').lean();
      const ttDocs = timetable.map(t => {
        const { _id, __v, teacher, ...d } = t;
        let email = (d.teacherEmail || '').trim().toLowerCase();
        let tId = d.teacherId || null;
        if (!email && teacher) {
          const match = allUsers.find(u => (u.name || '').trim().toLowerCase() === String(teacher).trim().toLowerCase());
          if (match) {
            email = (match.email || '').toLowerCase();
            tId = match._id;
          }
        }
        return { ...d, teacherEmail: email, teacherId: tId };
      }).filter(d => Boolean(d.teacherEmail));
      if (ttDocs.length > 0) {
        await Timetable.insertMany(ttDocs, { ordered: false });
      }
    }

    // 8. Restore activity logs
    if (Array.isArray(activityLogs) && activityLogs.length > 0) {
      await ActivityLog.deleteMany({});
      const logDocs = activityLogs.map(l => { const { _id, __v, ...d } = l; return d; });
      await ActivityLog.insertMany(logDocs, { ordered: false });
    }

    // 9. Restore settings
    if (settings && (settings.appName || settings.schoolName)) {
      const { _id, __v, ...setData } = settings;
      await AppSettings.findOneAndUpdate({}, { $set: setData }, { upsert: true, new: true });
    }

    const privateStudentsCount = Array.isArray(students) ? students.filter(s => s.isPrivate).length : 0;
    const privateClassesCount = Array.isArray(classes) ? classes.filter(c => c.isPrivate).length : 0;

    await ActivityLog.create({
      action: 'Database Backup Restored',
      details: `${students ? students.length : 0} Students (incl. ${privateStudentsCount} private), ${teachers ? teachers.length : 0} Teachers, ${classes ? classes.length : 0} Classes (incl. ${privateClassesCount} private), ${subjects ? subjects.length : 0} Subjects, ${attendance ? attendance.length : 0} Attendance restored`,
      performedBy: (req.user && req.user.name) ? req.user.name : 'Admin',
      role: (req.user && req.user.role) ? req.user.role : 'admin',
      entityType: 'backup',
      canUndo: false
    });

    res.json({
      success: true,
      message: 'Database backup imported successfully. All data including private workspaces restored.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
