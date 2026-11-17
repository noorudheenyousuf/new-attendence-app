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

// @route   POST /api/student-portal/submit-details
// @desc    Self-register student details (creates Student record and links to User)
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

    // Check if student already exists for this email or user
    let student = await findLinkedStudent(req.user);

    const mergedPersonal = {
      dob: personalDetails?.dob ? String(personalDetails.dob).trim() : (student?.personalDetails?.dob || ''),
      gender: personalDetails?.gender ? String(personalDetails.gender).trim() : (student?.personalDetails?.gender || ''),
      bloodGroup: personalDetails?.bloodGroup ? String(personalDetails.bloodGroup).trim() : (student?.personalDetails?.bloodGroup || ''),
      studentEmail: userEmail || (personalDetails?.studentEmail ? String(personalDetails.studentEmail).trim().toLowerCase() : '')
    };

    const mergedAddress = {
      fullAddress: address?.fullAddress ? String(address.fullAddress).trim() : (student?.address?.fullAddress || ''),
      place: address?.place ? String(address.place).trim() : (student?.address?.place || ''),
      district: address?.district ? String(address.district).trim() : (student?.address?.district || ''),
      state: address?.state ? String(address.state).trim() : (student?.address?.state || ''),
      pinCode: address?.pinCode ? String(address.pinCode).trim() : (student?.address?.pinCode || '')
    };

    const nextGuardian = familyDetails?.guardian ? String(familyDetails.guardian).trim() : (student?.familyDetails?.guardian || '');
    const isGuardianOther = nextGuardian === 'Other';
    const mergedFamily = {
      fatherName: familyDetails?.fatherName ? String(familyDetails.fatherName).trim() : (student?.familyDetails?.fatherName || ''),
      motherName: familyDetails?.motherName ? String(familyDetails.motherName).trim() : (student?.familyDetails?.motherName || ''),
      fatherMobile: familyDetails?.fatherMobile ? String(familyDetails.fatherMobile).trim() : (student?.familyDetails?.fatherMobile || ''),
      fatherWhatsapp: familyDetails?.fatherWhatsapp ? String(familyDetails.fatherWhatsapp).trim() : (student?.familyDetails?.fatherWhatsapp || ''),
      motherNumber: familyDetails?.motherNumber ? String(familyDetails.motherNumber).trim() : (student?.familyDetails?.motherNumber || ''),
      guardian: nextGuardian,
      guardianName: isGuardianOther ? (familyDetails?.guardianName ? String(familyDetails.guardianName).trim() : (student?.familyDetails?.guardianName || '')) : '',
      guardianNumber: isGuardianOther ? (familyDetails?.guardianNumber ? String(familyDetails.guardianNumber).trim() : (student?.familyDetails?.guardianNumber || '')) : '',
      guardianRelation: isGuardianOther ? (familyDetails?.guardianRelation ? String(familyDetails.guardianRelation).trim() : (student?.familyDetails?.guardianRelation || '')) : '',
      guardianOccupation: familyDetails?.guardianOccupation ? String(familyDetails.guardianOccupation).trim() : (student?.familyDetails?.guardianOccupation || '')
    };

    const mergedAcademic = {
      admissionNo: academicStatus?.admissionNo ? String(academicStatus.admissionNo).trim() : (student?.academicStatus?.admissionNo || ''),
      admissionDate: academicStatus?.admissionDate ? String(academicStatus.admissionDate).trim() : (student?.academicStatus?.admissionDate || new Date().toISOString().split('T')[0]),
      yearJoined: academicStatus?.yearJoined ? String(academicStatus.yearJoined).trim() : (student?.academicStatus?.yearJoined || String(new Date().getFullYear())),
      admissionStatus: academicStatus?.admissionStatus || 'Confirmed',
      rank: academicStatus?.rank ? String(academicStatus.rank).trim() : (student?.academicStatus?.rank || ''),
      previousCollege: academicStatus?.previousCollege ? String(academicStatus.previousCollege).trim() : (student?.academicStatus?.previousCollege || ''),
      stream: academicStatus?.stream ? String(academicStatus.stream).trim() : (student?.academicStatus?.stream || ''),
      degreeYear: academicStatus?.degreeYear ? String(academicStatus.degreeYear).trim() : (student?.academicStatus?.degreeYear || '')
    };

    const rollNum = roll !== undefined && roll !== null && String(roll).trim() !== '' ? Number(roll) : (student?.roll || 1);

    if (student) {
      // Update existing record
      student.name = String(name).trim();
      student.class = String(studentClass).trim();
      student.roll = rollNum;
      if (photoUrl) student.photoUrl = photoUrl;
      student.personalDetails = mergedPersonal;
      student.address = mergedAddress;
      student.familyDetails = mergedFamily;
      student.academicStatus = mergedAcademic;
      student.userId = req.user._id;
      await student.save();
    } else {
      // Assign auto studentId
      const studentId = await Student.getNextStudentId();
      student = await Student.create({
        studentId,
        name: String(name).trim(),
        class: String(studentClass).trim(),
        roll: rollNum,
        photoUrl: photoUrl || req.user.avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face',
        personalDetails: mergedPersonal,
        address: mergedAddress,
        familyDetails: mergedFamily,
        academicStatus: mergedAcademic,
        userId: req.user._id,
        isPrivate: false
      });
    }

    // Link User to student
    req.user.studentRef = student._id;
    if (name) req.user.name = String(name).trim();
    if (photoUrl) req.user.avatarUrl = photoUrl;
    await req.user.save();

    // Log Activity
    await ActivityLog.create({
      action: `Student Self-Registered: ${name} (ID: ${student.studentId})`,
      details: `Class: ${studentClass} • Roll: #${rollNum} • Email: ${userEmail}`,
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
      message: 'Student details saved successfully!'
    });
  } catch (error) {
    console.error('[StudentPortal Submit Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/student-portal/update-details
// @desc    Update editable student fields (phone, photo, address, family contacts)
router.post('/update-details', authMiddleware, async (req, res) => {
  // Alias to POST for easy client calling
  return handleUpdateStudentDetails(req, res);
});
router.put('/update-details', authMiddleware, async (req, res) => {
  return handleUpdateStudentDetails(req, res);
});

async function handleUpdateStudentDetails(req, res) {
  try {
    const student = await findLinkedStudent(req.user);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found. Please submit your registration first.' });
    }

    const {
      name,
      photoUrl,
      personalDetails,
      address,
      familyDetails
    } = req.body;

    const validation = validateStudentOptionalFields({ personalDetails, address, familyDetails });
    if (!validation.valid) {
      return res.status(400).json({ success: false, field: validation.field, message: validation.message });
    }

    if (name && String(name).trim()) {
      student.name = String(name).trim();
      req.user.name = String(name).trim();
    }

    if (photoUrl) {
      student.photoUrl = photoUrl;
      req.user.avatarUrl = photoUrl;
    }

    if (personalDetails) {
      student.personalDetails = {
        ...(student.personalDetails || {}),
        dob: personalDetails.dob !== undefined ? String(personalDetails.dob).trim() : (student.personalDetails?.dob || ''),
        gender: personalDetails.gender !== undefined ? String(personalDetails.gender).trim() : (student.personalDetails?.gender || ''),
        bloodGroup: personalDetails.bloodGroup !== undefined ? String(personalDetails.bloodGroup).trim() : (student.personalDetails?.bloodGroup || '')
      };
    }

    if (address) {
      student.address = {
        ...(student.address || {}),
        fullAddress: address.fullAddress !== undefined ? String(address.fullAddress).trim() : (student.address?.fullAddress || ''),
        place: address.place !== undefined ? String(address.place).trim() : (student.address?.place || ''),
        district: address.district !== undefined ? String(address.district).trim() : (student.address?.district || ''),
        state: address.state !== undefined ? String(address.state).trim() : (student.address?.state || ''),
        pinCode: address.pinCode !== undefined ? String(address.pinCode).trim() : (student.address?.pinCode || '')
      };
    }

    if (familyDetails) {
      const nextGuardian = familyDetails.guardian !== undefined ? String(familyDetails.guardian).trim() : (student.familyDetails?.guardian || '');
      const isGuardianOther = nextGuardian === 'Other';
      student.familyDetails = {
        ...(student.familyDetails || {}),
        fatherName: familyDetails.fatherName !== undefined ? String(familyDetails.fatherName).trim() : (student.familyDetails?.fatherName || ''),
        motherName: familyDetails.motherName !== undefined ? String(familyDetails.motherName).trim() : (student.familyDetails?.motherName || ''),
        fatherMobile: familyDetails.fatherMobile !== undefined ? String(familyDetails.fatherMobile).trim() : (student.familyDetails?.fatherMobile || ''),
        fatherWhatsapp: familyDetails.fatherWhatsapp !== undefined ? String(familyDetails.fatherWhatsapp).trim() : (student.familyDetails?.fatherWhatsapp || ''),
        motherNumber: familyDetails.motherNumber !== undefined ? String(familyDetails.motherNumber).trim() : (student.familyDetails?.motherNumber || ''),
        guardian: nextGuardian,
        guardianName: isGuardianOther ? (familyDetails.guardianName !== undefined ? String(familyDetails.guardianName).trim() : (student.familyDetails?.guardianName || '')) : '',
        guardianNumber: isGuardianOther ? (familyDetails.guardianNumber !== undefined ? String(familyDetails.guardianNumber).trim() : (student.familyDetails?.guardianNumber || '')) : '',
        guardianRelation: isGuardianOther ? (familyDetails.guardianRelation !== undefined ? String(familyDetails.guardianRelation).trim() : (student.familyDetails?.guardianRelation || '')) : '',
        guardianOccupation: familyDetails.guardianOccupation !== undefined ? String(familyDetails.guardianOccupation).trim() : (student.familyDetails?.guardianOccupation || '')
      };
    }

    student.userId = req.user._id;
    await student.save();
    await req.user.save();

    const { stats } = await getStudentAttendanceData(student);
    const resultObj = student.toObject();
    resultObj.attendanceStats = stats;

    res.json({
      success: true,
      data: resultObj,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('[StudentPortal Update Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

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
      andConditions.push({
        $or: [
          { day: day },
          { day: 'All Days' },
          { day: { $regex: new RegExp('\\b' + day + '\\b', 'i') } },
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

module.exports = router;
