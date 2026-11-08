const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const authMiddleware = require('../middleware/auth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// @route   GET /api/reports/class
// @desc    Whole class students report with roll, sessions, present, absent, late, percent (case-insensitive)
router.get('/class', authMiddleware, async (req, res) => {
  try {
    const { class: className, year, period, subject } = req.query;
    const isAllClasses = !className || className === 'all';

    // 1. Fetch students (all classes or specific class)
    const studentFilter = isAllClasses ? {} : { class: caseInsensitiveRegex(className) };
    const students = await Student.find(studentFilter).sort({ class: 1, roll: 1 });

    // 2. Build attendance match filter
    let attendanceFilter = isAllClasses ? {} : { class: caseInsensitiveRegex(className) };

    // Subject filter ('whole' means all subjects combined)
    if (subject && subject !== 'whole' && subject !== 'all') {
      attendanceFilter.subject = caseInsensitiveRegex(subject);
    }

    // Year and Period / Month filters (strictly validated)
    const hasSpecificYear = year && year !== 'all' && year !== 'all-year' && /^\d{4}$/.test(String(year));
    const hasSpecificMonth = period && period !== 'all-year' && period !== 'all' && /^\d{1,2}$/.test(String(period));

    const yearPattern = hasSpecificYear ? String(year) : '\\d{4}';
    const monthPattern = hasSpecificMonth ? String(period).padStart(2, '0') : '\\d{2}';

    if (hasSpecificYear || hasSpecificMonth) {
      attendanceFilter.date = { $regex: `^${yearPattern}-${monthPattern}-` };
    }

    const attendanceDocs = await Attendance.find(attendanceFilter);

    // 3. Compute student statistics
    const reportData = students.map(st => {
      let sessions = 0;
      let present = 0;
      let absent = 0;
      let leave = 0;

      attendanceDocs.forEach(att => {
        const studentRec = att.records.find(r => r.studentId === st.studentId);
        if (studentRec) {
          sessions++;
          if (studentRec.status === 'P') present++;
          else if (studentRec.status === 'A') absent++;
          else if (studentRec.status === 'L') leave++;
        }
      });

      const percent = sessions > 0 ? Number(((present / sessions) * 100).toFixed(1)) : 100.0;

      let status = 'Regular';
      if (percent >= 90) {
        status = 'Excellent';
      } else if (percent >= 75) {
        status = 'Regular';
      } else if (percent >= 60) {
        status = 'Warning';
      } else {
        status = 'Critical';
      }

      return {
        studentId: st.studentId,
        roll: st.roll,
        name: st.name,
        photoUrl: st.photoUrl,
        class: st.class,
        sessions,
        present,
        absent,
        leave,
        late: leave,
        percent,
        status
      };
    });

    const totalSessions = attendanceDocs.length;
    const avgPercent = reportData.length > 0
      ? (reportData.reduce((acc, cur) => acc + cur.percent, 0) / reportData.length).toFixed(1)
      : 100.0;

    res.json({
      success: true,
      data: reportData,
      summary: {
        totalStudents: students.length,
        totalSessions,
        classAverage: avgPercent
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/reports/student-logs/:studentId
// @desc    Detailed log history for a specific student (date, period/subject, status, note)
router.get('/student-logs/:studentId', authMiddleware, async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const attendanceDocs = await Attendance.find({
      'records.studentId': studentId
    }).sort({ date: -1 });

    const logs = [];
    attendanceDocs.forEach(doc => {
      const rec = doc.records.find(r => r.studentId === studentId);
      if (rec) {
        const subDisplay = (!doc.subject || doc.subject === 'whole' || doc.subject === 'all')
          ? 'General Attendance'
          : doc.subject;
        logs.push({
          date: doc.date,
          subject: subDisplay,
          period: subDisplay,
          status: rec.status,
          statusText: rec.status === 'P' ? 'Present' : rec.status === 'A' ? 'Absent' : 'Leave',
          note: rec.note || ''
        });
      }
    });

    res.json({
      success: true,
      student: {
        name: student.name,
        roll: student.roll,
        studentId: student.studentId,
        class: student.class
      },
      logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
