const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Subject = require('../models/Subject');

// @route   GET /api/reports/class
// @desc    Whole class students report with roll, sessions, present, absent, late, percent
router.get('/class', async (req, res) => {
  try {
    const { class: className, year, period, subject } = req.query;
    if (!className) {
      return res.status(400).json({ success: false, message: 'Class parameter is required' });
    }

    // 1. Fetch all students in this class
    const students = await Student.find({ class: className }).sort({ roll: 1 });

    // 2. Build attendance match filter
    let attendanceFilter = { class: className };

    // Subject filter ('whole' means all subjects combined)
    if (subject && subject !== 'whole' && subject !== 'all') {
      attendanceFilter.subject = subject;
    }

    // Year and Period / Month filters
    const hasSpecificYear = year && year !== 'all' && year !== 'all-year';
    const hasSpecificMonth = period && period !== 'all-year' && period !== 'all';

    const yearPattern = hasSpecificYear ? year : '\\d{4}';
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
      let late = 0;

      attendanceDocs.forEach(att => {
        const studentRec = att.records.find(r => r.studentId === st.studentId);
        if (studentRec) {
          sessions++;
          if (studentRec.status === 'P') present++;
          else if (studentRec.status === 'A') absent++;
          else if (studentRec.status === 'L') late++;
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
        late,
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
router.get('/student-logs/:studentId', async (req, res) => {
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
        logs.push({
          date: doc.date,
          period: doc.subject === 'all' ? 'Daily General' : doc.subject,
          status: rec.status,
          statusText: rec.status === 'P' ? 'Present' : rec.status === 'A' ? 'Absent' : 'Late',
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
