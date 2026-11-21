const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const Timetable = require('../models/Timetable');
const Announcement = require('../models/Announcement');
const Event = require('../models/Event');
const ActivityLog = require('../models/ActivityLog');
const Subject = require('../models/Subject');
const LeaveRequest = require('../models/LeaveRequest');
const AppSettings = require('../models/AppSettings');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// Helper: Validate optional fields only when filled
function validateStudentOptionalFields({ personalDetails, address, familyDetails }) {
  if (personalDetails && personalDetails.studentEmail) {
    const email = String(personalDetails.studentEmail).trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { valid: false, field: 'studentEmail', message: 'Invalid student email format' };
    }
  }
  if (personalDetails && personalDetails.studentPhone) {
    const sp = String(personalDetails.studentPhone).trim();
    if (sp && !/^\d{10}$/.test(sp)) {
      return { valid: false, field: 'studentPhone', message: 'Student phone number must be 10 digits' };
    }
  }
  if (address && address.pinCode) {
    const pin = String(address.pinCode).trim();
    if (pin && !/^\d{6}$/.test(pin)) {
      return { valid: false, field: 'pinCode', message: 'PIN Code must be 6 digits' };
    }
  }
  if (familyDetails) {
    if (familyDetails.fatherMobile) {
      const mob = String(familyDetails.fatherMobile).trim();
      if (mob && !/^\d{10}$/.test(mob)) {
        return { valid: false, field: 'fatherMobile', message: 'Mobile number must be 10 digits' };
      }
    }
    if (familyDetails.motherNumber) {
      const mMob = String(familyDetails.motherNumber).trim();
      if (mMob && !/^\d{10}$/.test(mMob)) {
        return { valid: false, field: 'motherNumber', message: "Mother's number must be 10 digits" };
      }
    }
    if (familyDetails.guardian === 'Other' && familyDetails.guardianNumber) {
      const gMob = String(familyDetails.guardianNumber).trim();
      if (gMob && !/^\d{10}$/.test(gMob)) {
        return { valid: false, field: 'guardianNumber', message: 'Guardian number must be 10 digits' };
      }
    }
  }
  return { valid: true };
}

// Helper: Calculate attendance stats for a single student
async function getStudentAttendanceData(studentDoc) {
  if (!studentDoc) return { stats: null, sessions: [] };
  const stIdStr = String(studentDoc.studentId);
  const attendances = await Attendance.find({
    isPrivate: { $ne: true },
    'records.studentId': { $in: [studentDoc.studentId, stIdStr, Number(stIdStr)].filter(v => v !== undefined && !isNaN(v) ? true : typeof v === 'string') }
  }).sort({ date: -1 }).lean();

  let totalSessions = 0;
  let presentCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  const sessions = [];

  for (const att of attendances) {
    if (!Array.isArray(att.records)) continue;
    const rec = att.records.find(r => String(r.studentId) === stIdStr);
    if (rec) {
      totalSessions++;
      if (rec.status === 'P') presentCount++;
      else if (rec.status === 'A') absentCount++;
      else if (rec.status === 'L') leaveCount++;

      sessions.push({
        date: att.date,
        class: att.class,
        subject: att.subject || '',
        period: att.period || '',
        status: rec.status,
        note: rec.note || '',
        markedBy: att.markedBy || ''
      });
    }
  }

  const percentage = totalSessions > 0 ? Number(((presentCount / totalSessions) * 100).toFixed(1)) : null;

  return {
    stats: {
      percentage,
      totalSessions,
      present: presentCount,
      absent: absentCount,
      leave: leaveCount
    },
    sessions
  };
}

// Find student linked to user (either by userId or studentEmail or studentRef)
async function findLinkedStudent(user) {
  if (!user) return null;
  const userEmail = (user.email || '').toLowerCase().trim();
  let student = null;

  if (user.studentRef) {
    student = await Student.findById(user.studentRef);
  }
  if (!student && user._id) {
    student = await Student.findOne({ userId: user._id });
  }
  if (!student && userEmail) {
    student = await Student.findOne({
      'personalDetails.studentEmail': userEmail,
      isPrivate: { $ne: true }
    });
  }
  return student;
}

// @route   GET /api/student-portal/me
// @desc    Get current student's linked profile and attendance
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const student = await findLinkedStudent(req.user);
    if (!student) {
      return res.json({
        success: true,
        registered: false,
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          avatarUrl: req.user.avatarUrl
        }
      });
    }

    const { stats, sessions } = await getStudentAttendanceData(student);
    const studentObj = student.toObject();
    studentObj.attendanceStats = stats;

    res.json({
      success: true,
      registered: true,
      data: studentObj,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        avatarUrl: req.user.avatarUrl
      }
    });
  } catch (error) {
    console.error('[StudentPortal Me Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper: Compute next sequential roll number for a class (includes approved + pending active students)
async function getNextRollNumberForClass(className) {
  if (!className || !String(className).trim()) return 1;
  const studentsInClass = await Student.find({
    isPrivate: { $ne: true },
    class: caseInsensitiveRegex(className),
    registrationStatus: { $ne: 'rejected' },
    lifecycleStatus: { $nin: ['alumni', 'tc'] }
  }).select('roll').lean();

  let maxRoll = 0;
  for (const s of studentsInClass) {
    const r = Number(s.roll);
    if (Number.isFinite(r) && r > maxRoll) maxRoll = r;
  }
  return maxRoll + 1;
}

// @route   GET /api/student-portal/next-roll
// @desc    Get next automatic roll number for a selected class
router.get('/next-roll', authMiddleware, async (req, res) => {
  try {
    const className = String(req.query.class || '').trim();
    if (!className) {
      return res.status(400).json({ success: false, message: 'Class is required' });
    }
    const nextRoll = await getNextRollNumberForClass(className);
    res.json({ success: true, class: className, nextRoll });
  } catch (error) {
    console.error('[StudentPortal NextRoll Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/student-portal/submit-details
// @desc    First-time self-registration of student details (strictly one-time; never editable by student after submission)
router.post('/submit-details', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      class: studentClass,
      roll,
      photoUrl,
      personalDetails,
      address,
      familyDetails,
      academicStatus
    } = req.body;

    if (!name || !String(name).trim() || !studentClass || !String(studentClass).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full Name and Class are required'
      });
    }

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';

    // Validate optional phone & pin fields
    const validation = validateStudentOptionalFields({ personalDetails, address, familyDetails });
    if (!validation.valid) {
      return res.status(400).json({ success: false, field: validation.field, message: validation.message });
    }

    // Check if student already exists for this email or user — block editing!
    let student = await findLinkedStudent(req.user);
    if (student) {
      return res.status(403).json({
        success: false,
        message: 'Your student details are already submitted and locked. Please contact your teacher to make any changes.'
      });
    }

    const mergedPersonal = {
      dob: personalDetails?.dob ? String(personalDetails.dob).trim() : '',
      gender: personalDetails?.gender ? String(personalDetails.gender).trim() : '',
      bloodGroup: personalDetails?.bloodGroup ? String(personalDetails.bloodGroup).trim() : '',
      studentEmail: (personalDetails?.studentEmail ? String(personalDetails.studentEmail).trim().toLowerCase() : '') || userEmail,
      studentPhone: personalDetails?.studentPhone ? String(personalDetails.studentPhone).replace(/\D/g, '').slice(-10) : ''
    };

    const mergedAddress = {
      fullAddress: address?.fullAddress ? String(address.fullAddress).trim() : '',
      place: address?.place ? String(address.place).trim() : '',
      district: address?.district ? String(address.district).trim() : '',
      state: address?.state ? String(address.state).trim() : '',
      pinCode: address?.pinCode ? String(address.pinCode).trim() : ''
    };

    const nextGuardian = familyDetails?.guardian ? String(familyDetails.guardian).trim() : '';
    const isGuardianOther = nextGuardian === 'Other';
    const mergedFamily = {
      fatherName: familyDetails?.fatherName ? String(familyDetails.fatherName).trim() : '',
      motherName: familyDetails?.motherName ? String(familyDetails.motherName).trim() : '',
      fatherMobile: familyDetails?.fatherMobile ? String(familyDetails.fatherMobile).replace(/\D/g, '').slice(-10) : '',
      fatherWhatsapp: familyDetails?.fatherWhatsapp ? String(familyDetails.fatherWhatsapp).replace(/\D/g, '').slice(-10) : '',
      motherNumber: familyDetails?.motherNumber ? String(familyDetails.motherNumber).replace(/\D/g, '').slice(-10) : '',
      guardian: nextGuardian,
      guardianName: isGuardianOther ? (familyDetails?.guardianName ? String(familyDetails.guardianName).trim() : '') : '',
      guardianNumber: isGuardianOther ? (familyDetails?.guardianNumber ? String(familyDetails.guardianNumber).replace(/\D/g, '').slice(-10) : '') : '',
      guardianRelation: isGuardianOther ? (familyDetails?.guardianRelation ? String(familyDetails.guardianRelation).trim() : '') : '',
      guardianOccupation: familyDetails?.guardianOccupation ? String(familyDetails.guardianOccupation).trim() : ''
    };

    const mergedAcademic = {
      admissionNo: academicStatus?.admissionNo ? String(academicStatus.admissionNo).trim() : '',
      admissionDate: academicStatus?.admissionDate ? String(academicStatus.admissionDate).trim() : new Date().toISOString().split('T')[0],
      yearJoined: academicStatus?.yearJoined ? String(academicStatus.yearJoined).trim() : String(new Date().getFullYear()),
      admissionStatus: academicStatus?.admissionStatus || 'Confirmed',
      rank: academicStatus?.rank ? String(academicStatus.rank).trim() : '',
      previousCollege: academicStatus?.previousCollege ? String(academicStatus.previousCollege).trim() : '',
      stream: academicStatus?.stream ? String(academicStatus.stream).trim() : '',
      degreeYear: academicStatus?.degreeYear ? String(academicStatus.degreeYear).trim() : ''
    };

    // Always auto-assign next sequential roll number for the chosen class
    const autoNextRoll = await getNextRollNumberForClass(studentClass);
    const parsedRoll = roll !== undefined && roll !== null && String(roll).trim() !== '' ? Number(roll) : NaN;
    const rollNum = Number.isFinite(parsedRoll) && parsedRoll >= autoNextRoll ? parsedRoll : autoNextRoll;

    // Assign auto studentId
    const studentId = await Student.getNextStudentId();
    student = await Student.create({
      studentId,
      name: String(name).trim(),
      class: String(studentClass).trim(),
      roll: rollNum,
      photoUrl: (photoUrl && String(photoUrl).trim()) ? String(photoUrl).trim() : 'default_avatar.jpg',
      personalDetails: mergedPersonal,
      address: mergedAddress,
      familyDetails: mergedFamily,
      academicStatus: mergedAcademic,
      userId: req.user._id,
      registrationStatus: 'pending',
      isPrivate: false
    });

    // Link User to student & sync primary phone for OTP password recovery
    req.user.studentRef = student._id;
    if (name) req.user.name = String(name).trim();
    if (photoUrl && String(photoUrl).trim()) req.user.avatarUrl = String(photoUrl).trim();
    const primaryPhone = mergedFamily.fatherMobile || mergedPersonal.studentPhone || mergedFamily.motherNumber || mergedFamily.guardianNumber;
    if (primaryPhone && !req.user.phone) {
      req.user.phone = primaryPhone;
    }
    await req.user.save();

    // Log Activity
    await ActivityLog.create({
      action: `Student Self-Registered: ${name} (ID: ${student.studentId})`,
      details: `Class: ${studentClass} • Roll: #${rollNum} • Email/User: ${userEmail || req.user.username || '-'}`,
      performedBy: name,
      performedByEmail: userEmail,
      role: 'student',
      entityType: 'student',
      entityId: student._id.toString()
    });

    const { stats } = await getStudentAttendanceData(student);
    const resultObj = student.toObject();
    resultObj.attendanceStats = stats;

    res.status(201).json({
      success: true,
      data: resultObj,
      message: 'Student details submitted successfully!'
    });
  } catch (error) {
    console.error('[StudentPortal Submit Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT/POST /api/student-portal/update-details
// @desc    Disabled: Students are not allowed to edit their details
router.post('/update-details', authMiddleware, (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Students cannot edit their details. Please contact your teacher or administrator.'
  });
});
router.put('/update-details', authMiddleware, (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Students cannot edit their details. Please contact your teacher or administrator.'
  });
});

// @route   GET /api/student-portal/timetable
// @desc    Get timetable slots for current student's class
router.get('/timetable', authMiddleware, async (req, res) => {
  try {
    const student = await findLinkedStudent(req.user);
    if (!student || !student.class) {
      return res.json({ success: true, data: [], message: 'Student is not assigned to a class yet' });
    }

    const { day } = req.query;
    const andConditions = [{ class: caseInsensitiveRegex(student.class) }];

    if (day && day !== 'all') {
      const escapedDay = String(day).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({
        $or: [
          { day: day },
          { day: 'All Days' },
          { day: { $regex: new RegExp('\\b' + escapedDay + '\\b', 'i') } },
          { days: day },
          { days: 'All Days' }
        ]
      });
    }

    const slots = await Timetable.find({ $and: andConditions }).sort({ order: 1, createdAt: 1 }).lean();

    // Fetch teacher names for slots
    const teacherEmails = [...new Set(slots.map(s => (s.teacherEmail || '').toLowerCase()).filter(Boolean))];
    const teachers = await User.find({ email: { $in: teacherEmails } }).select('email name avatarUrl').lean();
    const teacherMap = {};
    teachers.forEach(t => { teacherMap[t.email.toLowerCase()] = t; });

    const enrichedSlots = slots.map(s => {
      const teacher = teacherMap[(s.teacherEmail || '').toLowerCase()];
      return {
        ...s,
        teacherName: teacher ? teacher.name : (s.teacherEmail || 'Teacher'),
        teacherAvatar: teacher ? teacher.avatarUrl : ''
      };
    });

    res.json({
      success: true,
      class: student.class,
      data: enrichedSlots
    });
  } catch (error) {
    console.error('[StudentPortal Timetable Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/student-portal/announcements
// @desc    Get announcements and school notices
router.get('/announcements', authMiddleware, async (req, res) => {
  try {
    const announcements = await Announcement.find({ isPublished: true })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(50)
      .lean();

    const events = await Event.find({ status: { $ne: 'cancelled' } })
      .sort({ date: 1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      announcements,
      events
    });
  } catch (error) {
    console.error('[StudentPortal Announcements Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/student-portal/attendance
// @desc    Get student's detailed attendance history and sessions
router.get('/attendance', authMiddleware, async (req, res) => {
  try {
    const student = await findLinkedStudent(req.user);
    if (!student) {
      return res.json({ success: true, stats: null, sessions: [] });
    }

    const { stats, sessions } = await getStudentAttendanceData(student);
    res.json({
      success: true,
      studentId: student.studentId,
      name: student.name,
      class: student.class,
      roll: student.roll,
      stats,
      sessions
    });
  } catch (error) {
    console.error('[StudentPortal Attendance Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/student-portal/dashboard
// @desc    Get complete student home dashboard overview
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const student = await findLinkedStudent(req.user);
    const settings = await AppSettings.findOne().lean();

    if (!student) {
      return res.json({
        success: true,
        registered: false,
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          avatarUrl: req.user.avatarUrl
        },
        institution: {
          appName: settings?.appName || 'REGISTERLY',
          schoolName: settings?.schoolName || '',
          appLogo: settings?.appLogo || ''
        }
      });
    }

    const { stats } = await getStudentAttendanceData(student);
    const studentObj = student.toObject();
    studentObj.attendanceStats = stats;

    // Subjects count
    const totalSubjects = await Subject.countDocuments({
      isPrivate: { $ne: true },
      assignedClasses: caseInsensitiveRegex(student.class)
    });

    // Today's schedule slots
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const slots = await Timetable.find({
      class: caseInsensitiveRegex(student.class),
      $or: [
        { day: todayName },
        { day: 'All Days' },
        { day: { $regex: new RegExp('\\b' + todayName + '\\b', 'i') } },
        { days: todayName },
        { days: 'All Days' }
      ]
    }).sort({ order: 1, createdAt: 1 }).lean();

    // Teacher names for slots
    const teacherEmails = [...new Set(slots.map(s => (s.teacherEmail || '').toLowerCase()).filter(Boolean))];
    const teachers = await User.find({ email: { $in: teacherEmails } }).select('email name avatarUrl').lean();
    const teacherMap = {};
    teachers.forEach(t => { teacherMap[t.email.toLowerCase()] = t; });

    const enrichedSlots = slots.map(s => {
      const teacher = teacherMap[(s.teacherEmail || '').toLowerCase()];
      return {
        ...s,
        teacherName: teacher ? teacher.name : (s.teacherEmail || 'Teacher'),
        teacherAvatar: teacher ? teacher.avatarUrl : ''
      };
    });

    // Recent announcements
    const recentAnnouncements = await Announcement.find({ isPublished: true })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(4)
      .lean();

    const upcomingEvents = await Event.find({ status: { $ne: 'cancelled' } })
      .sort({ date: 1 })
      .limit(3)
      .lean();

    res.json({
      success: true,
      registered: true,
      student: studentObj,
      stats,
      totalSubjects,
      pendingAssignments: 0,
      upcomingExams: upcomingEvents.length,
      todaySchedule: enrichedSlots,
      recentAnnouncements,
      upcomingEvents,
      institution: {
        appName: settings?.appName || 'REGISTERLY',
        schoolName: settings?.schoolName || '',
        appLogo: settings?.appLogo || ''
      }
    });
  } catch (error) {
    console.error('[StudentPortal Dashboard Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/student-portal/subjects
// @desc    Get subjects for current student's class with teacher info and attendance %
router.get('/subjects', authMiddleware, async (req, res) => {
  try {
    const student = await findLinkedStudent(req.user);
    if (!student || !student.class) {
      return res.json({ success: true, subjects: [] });
    }

    const subjects = await Subject.find({
      isPrivate: { $ne: true },
      assignedClasses: caseInsensitiveRegex(student.class)
    }).sort({ order: 1, name: 1 }).lean();

    const stIdStr = String(student.studentId);

    // Enrich with teacher and subject-specific attendance
    const enriched = await Promise.all(subjects.map(async (subj) => {
      let teacherInfo = null;
      if (subj.teacherEmail) {
        teacherInfo = await User.findOne({ email: subj.teacherEmail.toLowerCase() }).select('name email avatarUrl').lean();
      }

      // Query attendance for this class and subject
      const subjectAttendances = await Attendance.find({
        isPrivate: { $ne: true },
        class: caseInsensitiveRegex(student.class),
        subject: caseInsensitiveRegex(subj.name),
        'records.studentId': { $in: [student.studentId, stIdStr, Number(stIdStr)].filter(v => v !== undefined && !isNaN(v) ? true : typeof v === 'string') }
      }).lean();

      let total = 0;
      let present = 0;
      let absent = 0;
      let leave = 0;

      for (const att of subjectAttendances) {
        if (!Array.isArray(att.records)) continue;
        const rec = att.records.find(r => String(r.studentId) === stIdStr);
        if (rec) {
          total++;
          if (rec.status === 'P') present++;
          else if (rec.status === 'A') absent++;
          else if (rec.status === 'L') leave++;
        }
      }

      const percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : null;

      return {
        _id: subj._id,
        name: subj.name,
        subjectCode: subj.subjectCode || '',
        teacher: teacherInfo ? teacherInfo.name : (subj.teacher || 'Not Assigned'),
        teacherEmail: subj.teacherEmail || '',
        teacherAvatar: teacherInfo ? teacherInfo.avatarUrl : '',
        attendance: {
          totalSessions: total,
          present,
          absent,
          leave,
          percentage
        }
      };
    }));

    res.json({
      success: true,
      class: student.class,
      subjects: enriched
    });
  } catch (error) {
    console.error('[StudentPortal Subjects Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/student-portal/attendance-calendar
// @desc    Get day-wise attendance calendar for a month
router.get('/attendance-calendar', authMiddleware, async (req, res) => {
  try {
    const student = await findLinkedStudent(req.user);
    if (!student) {
      return res.json({ success: true, days: {}, monthlyStats: null });
    }

    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1); // 1-12
    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    const stIdStr = String(student.studentId);
    const attendances = await Attendance.find({
      isPrivate: { $ne: true },
      date: { $regex: `^${prefix}` },
      'records.studentId': { $in: [student.studentId, stIdStr, Number(stIdStr)].filter(v => v !== undefined && !isNaN(v) ? true : typeof v === 'string') }
    }).sort({ date: 1 }).lean();

    const daysMap = {};
    let mTotal = 0;
    let mPresent = 0;
    let mAbsent = 0;
    let mLeave = 0;

    for (const att of attendances) {
      if (!Array.isArray(att.records)) continue;
      const rec = att.records.find(r => String(r.studentId) === stIdStr);
      if (rec) {
        mTotal++;
        if (rec.status === 'P') mPresent++;
        else if (rec.status === 'A') mAbsent++;
        else if (rec.status === 'L') mLeave++;

        const dayNum = parseInt(att.date.split('-')[2], 10);
        if (!daysMap[dayNum]) {
          daysMap[dayNum] = {
            date: att.date,
            status: rec.status,
            sessions: []
          };
        } else {
          if (rec.status === 'A') daysMap[dayNum].status = 'A';
          else if (rec.status === 'L' && daysMap[dayNum].status !== 'A') daysMap[dayNum].status = 'L';
        }

        daysMap[dayNum].sessions.push({
          subject: att.subject || 'General Attendance',
          period: att.period || '',
          class: att.class,
          status: rec.status,
          note: rec.note || '',
          markedBy: att.markedBy || ''
        });
      }
    }

    const mPercentage = mTotal > 0 ? Number(((mPresent / mTotal) * 100).toFixed(1)) : null;

    res.json({
      success: true,
      year,
      month,
      days: daysMap,
      monthlyStats: {
        totalSessions: mTotal,
        present: mPresent,
        absent: mAbsent,
        leave: mLeave,
        percentage: mPercentage
      }
    });
  } catch (error) {
    console.error('[StudentPortal Calendar Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/student-portal/leave-requests
// @desc    Get student's leave requests
router.get('/leave-requests', authMiddleware, async (req, res) => {
  try {
    const student = await findLinkedStudent(req.user);
    if (!student) {
      return res.json({ success: true, requests: [] });
    }

    const requests = await LeaveRequest.find({
      studentId: student.studentId
    }).sort({ createdAt: -1 }).limit(50).lean();

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('[StudentPortal LeaveRequests Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/student-portal/leave-requests
// @desc    Submit a leave request
router.post('/leave-requests', authMiddleware, async (req, res) => {
  try {
    const student = await findLinkedStudent(req.user);
    if (!student) {
      return res.status(400).json({ success: false, message: 'Student profile not found. Please register first.' });
    }

    const { fromDate, toDate, reason } = req.body;
    if (!fromDate || !toDate || !reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'From Date, To Date, and Reason are required' });
    }

    const leave = await LeaveRequest.create({
      studentId: student.studentId,
      studentRef: student._id,
      userId: req.user._id,
      studentName: student.name,
      class: student.class,
      roll: student.roll || 1,
      fromDate: String(fromDate).trim(),
      toDate: String(toDate).trim(),
      reason: String(reason).trim(),
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully. It will be reviewed by your teacher.',
      data: leave
    });
  } catch (error) {
    console.error('[StudentPortal Submit Leave Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/student-portal/materials
// @desc    Get study materials (with clean empty state)
router.get('/materials', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      materials: [],
      message: 'No study materials published yet for your class.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/student-portal/exam-results
// @desc    Get examination results (with clean empty state)
router.get('/exam-results', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      exams: [],
      message: 'No examination results published yet for your class.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/student-portal/change-password
// @desc    Change password for student user account
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.password && currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('[StudentPortal Change Password Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
