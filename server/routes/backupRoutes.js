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
const Enrollment = require('../models/Enrollment');
const PromotionBatch = require('../models/PromotionBatch');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers, rows) {
  const headerLine = headers.map(csvEscape).join(',');
  const bodyLines = rows.map(row => row.map(csvEscape).join(','));
  // Prepend UTF-8 BOM (\uFEFF) so Excel opens Malayalam/Unicode names cleanly
  return '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
}

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
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
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
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
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

// @route   GET /api/backup/year-archive
// @desc    Download Academic Year-End JSON Snapshot (for Library Backup & Offline Archive Viewer) + stamp AppSettings
router.get('/year-archive', async (req, res) => {
  try {
    let settings = await AppSettings.findOne();
    if (!settings) settings = await AppSettings.create({});

    const academicYear = (req.query.year && String(req.query.year).trim())
      || settings.currentAcademicYear
      || '2026-27';

    const [classes, subjects, students, teachers, attendance, enrollments, promotionBatches] = await Promise.all([
      Class.find().sort({ order: 1, name: 1 }).lean(),
      Subject.find().lean(),
      Student.find().sort({ class: 1, roll: 1 }).lean(),
      User.find().select('-password').lean(),
      Attendance.find().sort({ date: 1 }).lean(),
      Enrollment.find({ academicYear }).lean(),
      PromotionBatch.find().sort({ createdAt: -1 }).limit(20).lean()
    ]);

    // Pre-compute attendance summary per student for instant offline viewing
    const studentStatsMap = new Map();
    for (const att of attendance) {
      if (!Array.isArray(att.records)) continue;
      for (const rec of att.records) {
        const key = `${Boolean(att.isPrivate)}|${(att.ownerEmail || '').toLowerCase()}|${String(rec.studentId)}`;
        if (!studentStatsMap.has(key)) {
          studentStatsMap.set(key, { sessions: 0, present: 0, absent: 0, leave: 0 });
        }
        const st = studentStatsMap.get(key);
        st.sessions++;
        if (rec.status === 'P') st.present++;
        else if (rec.status === 'A') st.absent++;
        else if (rec.status === 'L') st.leave++;
      }
    }

    const enrichedStudents = students.map(s => {
      const key = `${Boolean(s.isPrivate)}|${(s.ownerEmail || '').toLowerCase()}|${String(s.studentId)}`;
      const st = studentStatsMap.get(key) || { sessions: 0, present: 0, absent: 0, leave: 0 };
      const percentage = st.sessions > 0 ? Number(((st.present / st.sessions) * 100).toFixed(1)) : null;
      return {
        ...s,
        attendanceSessions: st.sessions,
        attendancePresent: st.present,
        attendanceAbsent: st.absent,
        attendanceLeave: st.leave,
        attendancePercentage: percentage
      };
    });

    const archiveData = {
      archiveType: 'REGISTERLY_YEAR_ARCHIVE',
      version: '3.0',
      academicYear,
      appName: settings.appName || 'REGISTERLY',
      schoolName: settings.schoolName || '',
      exportDate: new Date().toISOString(),
      counts: {
        classes: classes.length,
        subjects: subjects.length,
        students: enrichedStudents.length,
        activeStudents: enrichedStudents.filter(s => !s.lifecycleStatus || s.lifecycleStatus === 'active').length,
        alumni: enrichedStudents.filter(s => s.lifecycleStatus === 'alumni').length,
        tc: enrichedStudents.filter(s => s.lifecycleStatus === 'tc').length,
        attendanceSessions: attendance.length
      },
      classes,
      subjects,
      students: enrichedStudents,
      teachers,
      attendance,
      enrollments,
      promotionBatches,
      settings: settings.toObject()
    };

    settings.lastYearBackupAt = new Date();
    settings.lastYearBackupYear = academicYear;
    await settings.save();

    await ActivityLog.create({
      action: `Year-End Archive Exported (${academicYear})`,
      details: `${enrichedStudents.length} Students, ${classes.length} Classes, ${attendance.length} Attendance Sessions`,
      performedBy: (req.user && req.user.name) ? req.user.name : 'Admin',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: (req.user && req.user.role) ? req.user.role : 'admin',
      entityType: 'backup',
      canUndo: false
    });

    const safeYear = academicYear.replace(/[^a-zA-Z0-9_-]/g, '-');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="REGISTERLY_Archive_${safeYear}.json"`);
    res.send(JSON.stringify(archiveData, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/backup/year-csv?type=students|attendance|alumni
// @desc    Export Excel-ready CSV with UTF-8 BOM (Malayalam-safe)
router.get('/year-csv', async (req, res) => {
  try {
    const type = String(req.query.type || 'students').toLowerCase();
    const settings = await AppSettings.findOne().lean();
    const academicYear = (settings && settings.currentAcademicYear) ? settings.currentAcademicYear : '2026-27';
    const safeYear = academicYear.replace(/[^a-zA-Z0-9_-]/g, '-');

    const students = await Student.find({ isPrivate: { $ne: true }, registrationStatus: { $ne: 'pending' } })
      .sort({ class: 1, roll: 1 })
      .lean();

    if (type === 'alumni') {
      const exited = students.filter(s => s.lifecycleStatus === 'alumni' || s.lifecycleStatus === 'tc');
      const headers = [
        'Student ID', 'Name', 'Status', 'Exit Year', 'Last Class', 'Last Roll',
        'TC Number', 'Exit Date', 'Reason', 'Father Name', 'Father Mobile', 'Place'
      ];
      const rows = exited.map(s => [
        s.studentId,
        s.name,
        (s.lifecycleStatus || '').toUpperCase(),
        (s.exitInfo && s.exitInfo.exitYear) || '',
        (s.exitInfo && s.exitInfo.lastClass) || s.class || '',
        (s.exitInfo && s.exitInfo.lastRoll) || s.roll || '',
        (s.exitInfo && s.exitInfo.tcNumber) || '',
        (s.exitInfo && s.exitInfo.exitDate) || '',
        (s.exitInfo && s.exitInfo.reason) || '',
        (s.familyDetails && s.familyDetails.fatherName) || '',
        (s.familyDetails && s.familyDetails.fatherMobile) || '',
        (s.address && s.address.place) || ''
      ]);
      const csv = buildCsv(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="REGISTERLY_Alumni_TC_${safeYear}.csv"`);
      return res.send(csv);
    }

    const attendance = await Attendance.find({ isPrivate: { $ne: true } }, 'records').lean();
    const statsMap = new Map();
    for (const att of attendance) {
      if (!Array.isArray(att.records)) continue;
      for (const rec of att.records) {
        const sid = String(rec.studentId);
        if (!statsMap.has(sid)) statsMap.set(sid, { sessions: 0, present: 0, absent: 0, leave: 0 });
        const st = statsMap.get(sid);
        st.sessions++;
        if (rec.status === 'P') st.present++;
        else if (rec.status === 'A') st.absent++;
        else if (rec.status === 'L') st.leave++;
      }
    }

    const activeStudents = students.filter(s => !s.lifecycleStatus || s.lifecycleStatus === 'active');

    if (type === 'attendance') {
      const headers = [
        'Academic Year', 'Student ID', 'Class', 'Roll No', 'Name', 'Rank',
        'Total Sessions', 'Present', 'Absent', 'Leave', 'Attendance %'
      ];
      const rows = activeStudents.map(s => {
        const st = statsMap.get(String(s.studentId)) || { sessions: 0, present: 0, absent: 0, leave: 0 };
        const pct = st.sessions > 0 ? `${((st.present / st.sessions) * 100).toFixed(1)}%` : '0.0%';
        return [
          academicYear,
          s.studentId,
          s.class,
          s.roll,
          s.name,
          (s.academicStatus && s.academicStatus.rank) || '',
          st.sessions,
          st.present,
          st.absent,
          st.leave,
          pct
        ];
      });
      const csv = buildCsv(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="REGISTERLY_Attendance_Summary_${safeYear}.csv"`);
      return res.send(csv);
    }

    // Default: type === 'students'
    const headers = [
      'Student ID', 'Class', 'Roll No', 'Name', 'Rank', 'Gender', 'DOB', 'Blood Group',
      'Admission No', 'Father Name', 'Father Mobile', 'Mother Name', 'Place', 'District', 'Attendance %'
    ];
    const rows = activeStudents.map(s => {
      const st = statsMap.get(String(s.studentId)) || { sessions: 0, present: 0 };
      const pct = st.sessions > 0 ? `${((st.present / st.sessions) * 100).toFixed(1)}%` : '';
      return [
        s.studentId,
        s.class,
        s.roll,
        s.name,
        (s.academicStatus && s.academicStatus.rank) || '',
        (s.personalDetails && s.personalDetails.gender) || '',
        (s.personalDetails && s.personalDetails.dob) || '',
        (s.personalDetails && s.personalDetails.bloodGroup) || '',
        (s.academicStatus && s.academicStatus.admissionNo) || '',
        (s.familyDetails && s.familyDetails.fatherName) || '',
        (s.familyDetails && s.familyDetails.fatherMobile) || '',
        (s.familyDetails && s.familyDetails.motherName) || '',
        (s.address && s.address.place) || '',
        (s.address && s.address.district) || '',
        pct
      ];
    });
    const csv = buildCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="REGISTERLY_Students_${safeYear}.csv"`);
    return res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/backup/cleanup-year
// @desc    Safe Cleanup Gate: purge old Attendance logs ONLY after Year-End JSON Archive has been downloaded
router.post('/cleanup-year', async (req, res) => {
  try {
    const settings = await AppSettings.findOne();
    if (!settings || !settings.lastYearBackupAt) {
      return res.status(400).json({
        success: false,
        message: 'Safe Cleanup Locked: Please download the Full Year JSON Archive first before purging attendance logs.'
      });
    }

    const { beforeDate, includePrivate = false } = req.body || {};
    const filter = {};
    if (!includePrivate) {
      filter.isPrivate = { $ne: true };
    }
    if (beforeDate && String(beforeDate).trim()) {
      filter.date = { $lte: String(beforeDate).trim() };
    }

    const result = await Attendance.deleteMany(filter);

    await ActivityLog.create({
      action: 'Year-End Safe Cleanup Completed',
      details: `Purged ${result.deletedCount} attendance session records to free database space (Backup verified: ${settings.lastYearBackupYear || settings.currentAcademicYear})`,
      performedBy: (req.user && req.user.name) ? req.user.name : 'Admin',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: (req.user && req.user.role) ? req.user.role : 'admin',
      entityType: 'backup',
      canUndo: false
    });

    res.json({
      success: true,
      message: `Safe Cleanup complete! Removed ${result.deletedCount} attendance records. Students, classes, Alumni & TC directory remain intact.`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
