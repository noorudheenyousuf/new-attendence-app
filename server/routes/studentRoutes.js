const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Class = require('../models/Class');
const AppSettings = require('../models/AppSettings');
const Attendance = require('../models/Attendance');
const Subject = require('../models/Subject');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// Helper: Compute next sequential roll number for a class (1..N)
async function getNextRollForClass(className, scopeFilter = { isPrivate: { $ne: true } }) {
  if (!className || !String(className).trim()) return 1;
  const studentsInClass = await Student.find({
    ...scopeFilter,
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

// Helper: Compute attendance % for a list of students or single student from existing Attendance data
async function attachAttendanceStatsToStudents(studentsList) {
  if (!Array.isArray(studentsList) || studentsList.length === 0) return [];
  const allAttendance = await Attendance.find({}, 'records isPrivate ownerEmail').lean();
  return studentsList.map(stDoc => {
    const st = stDoc.toObject ? stDoc.toObject() : { ...stDoc };
    const stIdStr = String(st.studentId);
    let sessions = 0;
    let present = 0;
    let absent = 0;
    let leave = 0;
    for (const att of allAttendance) {
      if (Boolean(att.isPrivate) !== Boolean(st.isPrivate)) continue;
      if (st.isPrivate && (att.ownerEmail || '').toLowerCase() !== (st.ownerEmail || '').toLowerCase()) continue;
      if (Array.isArray(att.records)) {
        const rec = att.records.find(r => String(r.studentId) === stIdStr);
        if (rec) {
          sessions++;
          if (rec.status === 'P') present++;
          else if (rec.status === 'A') absent++;
          else if (rec.status === 'L') leave++;
        }
      }
    }
    const percentage = sessions > 0 ? Number(((present / sessions) * 100).toFixed(1)) : null;
    st.attendancePercentage = percentage;
    st.attendanceSessions = sessions;
    st.attendancePresent = present;
    st.attendanceAbsent = absent;
    st.attendanceLeave = leave;
    return st;
  });
}

// @route   GET /api/students
// @desc    Get all students (with class filter, search, and scope: 'all' | 'private' | 'public')
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { class: classFilter, search, scope, status, lifecycle } = req.query;
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    let query = {};

    if (status === 'pending' || status === 'rejected') {
      query.registrationStatus = status;
    } else if (status !== 'all') {
      query.registrationStatus = { $nin: ['pending', 'rejected'] };
    }

    if (lifecycle === 'alumni' || lifecycle === 'tc') {
      query.lifecycleStatus = lifecycle;
    } else if (lifecycle !== 'all') {
      query.lifecycleStatus = { $nin: ['alumni', 'tc'] };
    }

    if (scope === 'private') {
      if (!userEmail) return res.json({ success: true, data: [] });
      query.isPrivate = true;
      query.ownerEmail = userEmail;
    } else if (scope === 'public') {
      query.isPrivate = { $ne: true };
    } else {
      if (userEmail) {
        query.$or = [{ isPrivate: { $ne: true } }, { isPrivate: true, ownerEmail: userEmail }];
      } else {
        query.isPrivate = { $ne: true };
      }
    }

    if (classFilter && classFilter !== 'all') {
      query.class = caseInsensitiveRegex(classFilter);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const cleanSearch = search.trim();
      const escaped = cleanSearch.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      const searchConditions = [
        { name: searchRegex },
        { class: searchRegex },
        { studentId: searchRegex },
        { 'familyDetails.fatherName': searchRegex },
        { 'familyDetails.fatherMobile': searchRegex },
        { 'familyDetails.fatherWhatsapp': searchRegex }
      ];
      const parsedNum = Number(cleanSearch);
      if (!isNaN(parsedNum)) {
        searchConditions.push({ studentId: parsedNum }, { roll: parsedNum });
      }

      if (query.$or) {
        // Combine scope $or with search conditions while preserving registrationStatus & lifecycleStatus
        const andConditions = [
          { $or: query.$or },
          { $or: searchConditions }
        ];
        if (query.registrationStatus !== undefined) {
          andConditions.push({ registrationStatus: query.registrationStatus });
        }
        if (query.lifecycleStatus !== undefined) {
          andConditions.push({ lifecycleStatus: query.lifecycleStatus });
        }
        if (classFilter && classFilter !== 'all') {
          andConditions.push({ class: caseInsensitiveRegex(classFilter) });
        }
        query = { $and: andConditions };
      } else {
        query.$or = searchConditions;
      }
    }

    const students = await Student.find(query).sort({ class: 1, roll: 1 });
    const enrichedStudents = await attachAttendanceStatsToStudents(students);
    res.json({ success: true, data: enrichedStudents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/students/public-submit-meta
// @desc    Public metadata for standalone student details submission page (classes, school name, auto roll map)
router.get('/public-submit-meta', async (req, res) => {
  try {
    const [settings, classes, activeStudents] = await Promise.all([
      AppSettings.findOne().lean(),
      Class.find({ isPrivate: { $ne: true } }).sort({ order: 1, name: 1 }).select('name order').lean(),
      Student.find({
        isPrivate: { $ne: true },
        registrationStatus: { $ne: 'rejected' },
        lifecycleStatus: { $nin: ['alumni', 'tc'] }
      }, 'class roll').lean()
    ]);

    const nextRollByClass = {};
    for (const c of classes) {
      const clsLower = String(c.name || '').trim().toLowerCase();
      let maxRoll = 0;
      for (const s of activeStudents) {
        if (String(s.class || '').trim().toLowerCase() === clsLower) {
          const r = Number(s.roll);
          if (Number.isFinite(r) && r > maxRoll) maxRoll = r;
        }
      }
      nextRollByClass[c.name] = maxRoll + 1;
    }

    res.json({
      success: true,
      data: {
        appName: (settings && settings.appName) ? settings.appName : 'REGISTERLY',
        schoolName: (settings && settings.schoolName) ? settings.schoolName : '',
        currentAcademicYear: (settings && settings.currentAcademicYear) ? settings.currentAcademicYear : '2026-27',
        classes: classes.map(c => c.name),
        nextRollByClass
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/students/public-next-roll
// @desc    Live next roll number lookup for any selected class (used by public student submit & student app fallback)
router.get('/public-next-roll', async (req, res) => {
  try {
    const className = String(req.query.class || '').trim();
    if (!className) {
      return res.status(400).json({ success: false, message: 'Class is required' });
    }
    const nextRoll = await getNextRollForClass(className, { isPrivate: { $ne: true } });
    res.json({ success: true, class: className, nextRoll });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/students/public-submit
// @desc    Public student self-registration submission (goes to Teachers' Outcomers as pending)
router.post('/public-submit', async (req, res) => {
  try {
    const {
      name,
      class: studentClass,
      photoUrl,
      personalDetails,
      address,
      familyDetails,
      academicStatus
    } = req.body || {};

    if (!name || !String(name).trim() || !studentClass || !String(studentClass).trim()) {
      return res.status(400).json({ success: false, message: 'Full Name and Class are required.' });
    }

    const validation = validateStudentOptionalFields({ personalDetails, address, familyDetails });
    if (!validation.valid) {
      return res.status(400).json({ success: false, field: validation.field, message: validation.message });
    }

    const cleanClass = String(studentClass).trim();
    const autoRoll = await getNextRollForClass(cleanClass, { isPrivate: { $ne: true } });
    const nextId = await Student.getNextStudentId();

    const isGuardianOther = familyDetails && familyDetails.guardian === 'Other';
    const newStudent = await Student.create({
      studentId: nextId,
      name: String(name).trim(),
      class: cleanClass,
      roll: autoRoll,
      photoUrl: photoUrl || '',
      personalDetails: {
        dob: personalDetails?.dob ? String(personalDetails.dob).trim() : '',
        gender: personalDetails?.gender ? String(personalDetails.gender).trim() : '',
        bloodGroup: personalDetails?.bloodGroup ? String(personalDetails.bloodGroup).trim() : '',
        studentEmail: personalDetails?.studentEmail ? String(personalDetails.studentEmail).trim().toLowerCase() : '',
        studentPhone: personalDetails?.studentPhone ? String(personalDetails.studentPhone).replace(/\D/g, '').slice(-10) : ''
      },
      address: {
        fullAddress: address?.fullAddress ? String(address.fullAddress).trim() : '',
        place: address?.place ? String(address.place).trim() : '',
        district: address?.district ? String(address.district).trim() : '',
        state: address?.state ? String(address.state).trim() : '',
        pinCode: address?.pinCode ? String(address.pinCode).trim() : ''
      },
      familyDetails: {
        fatherName: familyDetails?.fatherName ? String(familyDetails.fatherName).trim() : '',
        motherName: familyDetails?.motherName ? String(familyDetails.motherName).trim() : '',
        fatherMobile: familyDetails?.fatherMobile ? String(familyDetails.fatherMobile).trim() : '',
        fatherWhatsapp: familyDetails?.fatherWhatsapp ? String(familyDetails.fatherWhatsapp).trim() : '',
        motherNumber: familyDetails?.motherNumber ? String(familyDetails.motherNumber).trim() : '',
        guardian: familyDetails?.guardian ? String(familyDetails.guardian).trim() : '',
        guardianName: isGuardianOther && familyDetails?.guardianName ? String(familyDetails.guardianName).trim() : '',
        guardianNumber: isGuardianOther && familyDetails?.guardianNumber ? String(familyDetails.guardianNumber).trim() : '',
        guardianRelation: isGuardianOther && familyDetails?.guardianRelation ? String(familyDetails.guardianRelation).trim() : '',
        guardianOccupation: familyDetails?.guardianOccupation ? String(familyDetails.guardianOccupation).trim() : ''
      },
      academicStatus: {
        admissionNo: academicStatus?.admissionNo ? String(academicStatus.admissionNo).trim() : '',
        admissionDate: academicStatus?.admissionDate ? String(academicStatus.admissionDate).trim() : '',
        yearJoined: academicStatus?.yearJoined ? String(academicStatus.yearJoined).trim() : '',
        admissionStatus: 'Pending Verification',
        rank: academicStatus?.rank ? String(academicStatus.rank).trim() : '',
        previousCollege: academicStatus?.previousCollege ? String(academicStatus.previousCollege).trim() : '',
        stream: academicStatus?.stream ? String(academicStatus.stream).trim() : '',
        degreeYear: academicStatus?.degreeYear ? String(academicStatus.degreeYear).trim() : ''
      },
      isPrivate: false,
      registrationStatus: 'pending',
      lifecycleStatus: 'active'
    });

    await ActivityLog.create({
      action: `New Student Submission: ${newStudent.name}`,
      details: `Requested Class: ${cleanClass} • Pending teacher verification`,
      performedBy: newStudent.name,
      role: 'student',
      entityType: 'student',
      entityId: newStudent._id.toString(),
      canUndo: false
    });

    res.status(201).json({
      success: true,
      data: {
        submissionId: newStudent._id,
        status: 'pending',
        name: newStudent.name,
        class: newStudent.class,
        roll: newStudent.roll,
        studentId: newStudent.studentId
      },
      message: 'Submission received. Your details are pending teacher verification.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/students/public-submit-status/:id
// @desc    Public status check for a submitted student registration
router.get('/public-submit-status/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    const student = await Student.findById(id, 'name class roll studentId registrationStatus createdAt').lean();
    if (!student) {
      return res.json({
        success: true,
        data: { status: 'rejected', name: '', class: '', roll: null, studentId: null }
      });
    }
    res.json({
      success: true,
      data: {
        submissionId: student._id,
        status: student.registrationStatus || 'pending',
        name: student.name,
        class: student.class,
        roll: student.roll,
        studentId: student.studentId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/students/outcomers
// @desc    Get all students who self-registered via link and are pending verification
router.get('/outcomers', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { isPrivate: { $ne: true } };
    if (status && status !== 'all') {
      filter.registrationStatus = status;
    } else if (!status) {
      filter.registrationStatus = 'pending';
    }
    const outcomers = await Student.find(filter).sort({ createdAt: -1 }).lean();
    const pendingCount = await Student.countDocuments({ isPrivate: { $ne: true }, registrationStatus: 'pending' });
    res.json({
      success: true,
      data: outcomers,
      pendingCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/students/outcomers/:id/approve
// @desc    Teacher verifies & approves outcomer, assigning/confirming class & roll
router.put('/outcomers/:id/approve', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Outcomer student not found' });
    }

    const { class: assignedClass, roll, studentId } = req.body;
    const isAdmin = req.user && req.user.role === 'admin';
    if (assignedClass) student.class = String(assignedClass).trim();

    if (isAdmin && roll !== undefined && roll !== null && String(roll).trim() !== '') {
      student.roll = Number(roll);
    } else {
      student.roll = await getNextRollForClass(student.class, { isPrivate: { $ne: true } });
    }

    if (isAdmin && studentId) {
      student.studentId = studentId;
    } else if (!student.studentId || isNaN(Number(student.studentId))) {
      student.studentId = await Student.getNextStudentId();
    }

    student.registrationStatus = 'approved';
    student.academicStatus = {
      ...(student.academicStatus || {}),
      admissionStatus: 'Confirmed'
    };
    await student.save();

    // Log teacher verification
    await ActivityLog.create({
      action: `Outcomer Verified & Enrolled: ${student.name} (ID: ${student.studentId})`,
      details: `Class: ${student.class} • Roll: #${student.roll}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'student',
      entityId: student._id.toString()
    });

    res.json({
      success: true,
      data: student,
      message: `Student ${student.name} approved and enrolled in ${student.class} successfully!`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/students/outcomers/:id/reject
// @desc    Teacher rejects an outcomer submission (marks as rejected so student sees status; ?permanent=true deletes permanently)
router.delete('/outcomers/:id/reject', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Outcomer student not found' });
    }

    const studentName = student.name;
    const studentEmail = student.personalDetails?.studentEmail || '';
    const permanent = req.query.permanent === 'true';

    // If user account is linked to this student, reset studentRef
    if (student.userId) {
      await User.findByIdAndUpdate(student.userId, { studentRef: null });
    }

    if (permanent) {
      await Student.findByIdAndDelete(req.params.id);
    } else {
      student.registrationStatus = 'rejected';
      student.academicStatus = {
        ...(student.academicStatus || {}),
        admissionStatus: 'Not Approved'
      };
      await student.save();
    }

    await ActivityLog.create({
      action: permanent ? `Rejected Submission Removed: ${studentName}` : `Outcomer Submission Not Approved: ${studentName}`,
      details: `Email: ${studentEmail}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'student',
      entityId: req.params.id
    });

    res.json({
      success: true,
      message: permanent
        ? `Submission for ${studentName} permanently removed.`
        : `Submission for ${studentName} has been marked as Not Approved.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/students/next-id
// @desc    Get next auto-increment student ID (scope: 'public' -> >=2000, 'private' -> >=P-101)
router.get('/next-id', authMiddleware, async (req, res) => {
  try {
    const { scope } = req.query;
    if (scope === 'private') {
      const nextId = await Student.getNextPrivateStudentId(req.user.email);
      return res.json({ success: true, nextId });
    }
    const nextId = await Student.getNextStudentId();
    res.json({ success: true, nextId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/students/:id
// @desc    Get single student with server-calculated attendance % and remarks sorted newest first
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const paramId = req.params.id;
    let student = null;
    if (/^[0-9a-fA-F]{24}$/.test(paramId)) {
      student = await Student.findById(paramId);
    }
    if (!student) {
      const numId = Number(paramId);
      const idQuery = !isNaN(numId) ? { $in: [paramId, numId] } : paramId;
      student = await Student.findOne({ studentId: idQuery });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const [enriched] = await attachAttendanceStatsToStudents([student]);
    if (Array.isArray(enriched.remarks)) {
      enriched.remarks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/students
// @desc    Add new student (auto assigns studentId; allows private workspace student with prefix P-101 & editable ID)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      class: studentClass,
      roll,
      photoUrl,
      personalDetails,
      address,
      familyDetails,
      academicStatus,
      initialRemark,
      customFields,
      isPrivate,
      studentId: customStudentId
    } = req.body;

    if (!name || !String(name).trim() || !studentClass || !String(studentClass).trim()) {
      return res.status(400).json({ success: false, message: 'Full Name and Class are required' });
    }

    const validation = validateStudentOptionalFields({ personalDetails, address, familyDetails });
    if (!validation.valid) {
      return res.status(400).json({ success: false, field: validation.field, message: validation.message });
    }

    const isPrivateBool = Boolean(isPrivate);
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const userName = req.user ? req.user.name : 'Teacher';
    const userRole = req.user ? req.user.role : 'teacher';

    let studentId;
    if (isPrivateBool) {
      if (customStudentId && String(customStudentId).trim()) {
        studentId = String(customStudentId).trim();
      } else {
        studentId = await Student.getNextPrivateStudentId(userEmail);
      }

      const existing = await Student.findOne({
        studentId: studentId,
        isPrivate: true,
        ownerEmail: userEmail
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Student ID "${studentId}" already exists in your private workspace. Please choose a unique ID.`
        });
      }
    } else {
      if (req.user && req.user.role === 'admin' && customStudentId && String(customStudentId).trim()) {
        const cleanCustom = String(customStudentId).trim();
        const existing = await Student.findOne({
          studentId: cleanCustom,
          isPrivate: { $ne: true }
        });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: `Student ID "${cleanCustom}" already exists for student "${existing.name}". Please choose a unique ID.`
          });
        }
        studentId = cleanCustom;
      } else {
        studentId = await Student.getNextStudentId();
      }
    }

    const whitelistedPersonal = {
      dob: personalDetails?.dob ? String(personalDetails.dob).trim() : '',
      gender: personalDetails?.gender ? String(personalDetails.gender).trim() : '',
      bloodGroup: personalDetails?.bloodGroup ? String(personalDetails.bloodGroup).trim() : '',
      studentEmail: personalDetails?.studentEmail ? String(personalDetails.studentEmail).trim().toLowerCase() : '',
      studentPhone: personalDetails?.studentPhone ? String(personalDetails.studentPhone).replace(/\D/g, '').slice(-10) : ''
    };

    const whitelistedAddress = {
      fullAddress: address?.fullAddress ? String(address.fullAddress).trim() : '',
      place: address?.place ? String(address.place).trim() : '',
      district: address?.district ? String(address.district).trim() : '',
      state: address?.state ? String(address.state).trim() : '',
      pinCode: address?.pinCode ? String(address.pinCode).trim() : ''
    };

    const isGuardianOther = familyDetails?.guardian === 'Other';
    const whitelistedFamily = {
      fatherName: familyDetails?.fatherName ? String(familyDetails.fatherName).trim() : '',
      motherName: familyDetails?.motherName ? String(familyDetails.motherName).trim() : '',
      fatherMobile: familyDetails?.fatherMobile ? String(familyDetails.fatherMobile).trim() : '',
      fatherWhatsapp: familyDetails?.fatherWhatsapp ? String(familyDetails.fatherWhatsapp).trim() : '',
      motherNumber: familyDetails?.motherNumber ? String(familyDetails.motherNumber).trim() : '',
      guardian: familyDetails?.guardian ? String(familyDetails.guardian).trim() : '',
      guardianName: isGuardianOther && familyDetails?.guardianName ? String(familyDetails.guardianName).trim() : '',
      guardianNumber: isGuardianOther && familyDetails?.guardianNumber ? String(familyDetails.guardianNumber).trim() : '',
      guardianRelation: isGuardianOther && familyDetails?.guardianRelation ? String(familyDetails.guardianRelation).trim() : '',
      guardianOccupation: familyDetails?.guardianOccupation ? String(familyDetails.guardianOccupation).trim() : ''
    };

    const whitelistedAcademic = {
      admissionNo: academicStatus?.admissionNo ? String(academicStatus.admissionNo).trim() : '',
      admissionDate: academicStatus?.admissionDate ? String(academicStatus.admissionDate).trim() : '',
      yearJoined: academicStatus?.yearJoined ? String(academicStatus.yearJoined).trim() : '',
      admissionStatus: academicStatus?.admissionStatus || 'Confirmed',
      rank: academicStatus?.rank ? String(academicStatus.rank).trim() : '',
      previousCollege: academicStatus?.previousCollege ? String(academicStatus.previousCollege).trim() : '',
      stream: academicStatus?.stream ? String(academicStatus.stream).trim() : '',
      degreeYear: academicStatus?.degreeYear ? String(academicStatus.degreeYear).trim() : ''
    };

    const remarksArray = [];
    if (initialRemark && String(initialRemark).trim()) {
      let resolvedSub = userRole === 'admin' ? 'Admin' : 'Faculty';
      try {
        const subDoc = await Subject.findOne({
          $or: [
            ...(userEmail ? [{ ownerEmail: userEmail }] : []),
            ...(userName ? [{ teacher: caseInsensitiveRegex(userName) }] : [])
          ]
        }).lean();
        if (subDoc && subDoc.name) resolvedSub = subDoc.name;
      } catch (_) {}

      remarksArray.push({
        teacherId: req.user ? req.user._id : null,
        teacherName: userName,
        teacherEmail: userEmail,
        teacherSubject: resolvedSub,
        teacherAvatar: (req.user && req.user.avatarUrl) ? req.user.avatarUrl : '',
        text: String(initialRemark).trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const canOverrideRoll = isPrivateBool || (req.user && req.user.role === 'admin');
    const rollScopeFilter = isPrivateBool
      ? { isPrivate: true, ownerEmail: userEmail }
      : { isPrivate: { $ne: true } };
    const finalRoll = (canOverrideRoll && roll !== undefined && roll !== null && String(roll).trim() !== '' && !isNaN(Number(roll)))
      ? Number(roll)
      : await getNextRollForClass(String(studentClass).trim(), rollScopeFilter);

    const newStudent = await Student.create({
      studentId,
      name: String(name).trim(),
      class: String(studentClass).trim(),
      roll: finalRoll,
      photoUrl: photoUrl || '',
      personalDetails: whitelistedPersonal,
      address: whitelistedAddress,
      familyDetails: whitelistedFamily,
      academicStatus: whitelistedAcademic,
      remarks: remarksArray,
      customFields: customFields || {},
      isPrivate: isPrivateBool,
      ownerEmail: isPrivateBool ? userEmail : '',
      ownerId: isPrivateBool ? req.user._id : null,
      ownerName: isPrivateBool ? userName : ''
    });

    await ActivityLog.create({
      action: `${isPrivateBool ? 'Private Student Enrolled' : 'Student Enrolled'}: ${name} (ID: ${studentId})`,
      details: `Class: ${studentClass} • Roll: #${finalRoll}`,
      performedBy: userName,
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: userRole,
      entityType: 'student',
      entityId: newStudent._id.toString(),
      canUndo: true,
      previousState: null,
      isPrivate: isPrivateBool,
      ownerEmail: isPrivateBool ? userEmail : ''
    });

    const [enriched] = await attachAttendanceStatsToStudents([newStudent]);
    res.status(201).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/students/:id
// @desc    Edit student (Admin and all teachers can edit main profile; preserves existing old fields untouched)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const oldStudent = await Student.findById(req.params.id);
    if (!oldStudent) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isAdmin = req.user && req.user.role === 'admin';
    if (oldStudent.isPrivate && !isAdmin && oldStudent.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: 'Access denied to this private student' });
    }

    const {
      name,
      class: studentClass,
      roll,
      photoUrl,
      personalDetails,
      address,
      familyDetails,
      academicStatus,
      customFields,
      studentId: newStudentId
    } = req.body;

    const validation = validateStudentOptionalFields({ personalDetails, address, familyDetails });
    if (!validation.valid) {
      return res.status(400).json({ success: false, field: validation.field, message: validation.message });
    }

    const oldPersonal = oldStudent.personalDetails || {};
    const mergedPersonal = personalDetails !== undefined ? {
      dob: personalDetails.dob !== undefined ? String(personalDetails.dob).trim() : (oldPersonal.dob || ''),
      gender: personalDetails.gender !== undefined ? String(personalDetails.gender).trim() : (oldPersonal.gender || ''),
      bloodGroup: personalDetails.bloodGroup !== undefined ? String(personalDetails.bloodGroup).trim() : (oldPersonal.bloodGroup || ''),
      studentEmail: personalDetails.studentEmail !== undefined ? String(personalDetails.studentEmail).trim().toLowerCase() : (oldPersonal.studentEmail || ''),
      studentPhone: personalDetails.studentPhone !== undefined ? String(personalDetails.studentPhone).replace(/\D/g, '').slice(-10) : (oldPersonal.studentPhone || '')
    } : oldPersonal;

    const oldAddress = oldStudent.address || {};
    const mergedAddress = address !== undefined ? {
      fullAddress: address.fullAddress !== undefined ? String(address.fullAddress).trim() : (oldAddress.fullAddress || ''),
      place: address.place !== undefined ? String(address.place).trim() : (oldAddress.place || ''),
      district: address.district !== undefined ? String(address.district).trim() : (oldAddress.district || ''),
      state: address.state !== undefined ? String(address.state).trim() : (oldAddress.state || ''),
      pinCode: address.pinCode !== undefined ? String(address.pinCode).trim() : (oldAddress.pinCode || '')
    } : oldAddress;

    const oldFamily = oldStudent.familyDetails || {};
    const nextGuardian = familyDetails?.guardian !== undefined ? String(familyDetails.guardian).trim() : (oldFamily.guardian || '');
    const isGuardianOther = nextGuardian === 'Other';
    const mergedFamily = familyDetails !== undefined ? {
      fatherName: familyDetails.fatherName !== undefined ? String(familyDetails.fatherName).trim() : (oldFamily.fatherName || ''),
      motherName: familyDetails.motherName !== undefined ? String(familyDetails.motherName).trim() : (oldFamily.motherName || ''),
      fatherMobile: familyDetails.fatherMobile !== undefined ? String(familyDetails.fatherMobile).trim() : (oldFamily.fatherMobile || ''),
      // Strictly keep old fatherWhatsapp untouched unless explicitly sent
      fatherWhatsapp: familyDetails.fatherWhatsapp !== undefined ? String(familyDetails.fatherWhatsapp).trim() : (oldFamily.fatherWhatsapp || ''),
      motherNumber: familyDetails.motherNumber !== undefined ? String(familyDetails.motherNumber).trim() : (oldFamily.motherNumber || ''),
      guardian: nextGuardian,
      guardianName: isGuardianOther ? (familyDetails.guardianName !== undefined ? String(familyDetails.guardianName).trim() : (oldFamily.guardianName || '')) : '',
      guardianNumber: isGuardianOther ? (familyDetails.guardianNumber !== undefined ? String(familyDetails.guardianNumber).trim() : (oldFamily.guardianNumber || '')) : '',
      guardianRelation: isGuardianOther ? (familyDetails.guardianRelation !== undefined ? String(familyDetails.guardianRelation).trim() : (oldFamily.guardianRelation || '')) : '',
      guardianOccupation: familyDetails.guardianOccupation !== undefined ? String(familyDetails.guardianOccupation).trim() : (oldFamily.guardianOccupation || '')
    } : oldFamily;

    const oldAcademic = oldStudent.academicStatus || {};
    const mergedAcademic = academicStatus !== undefined ? {
      admissionNo: academicStatus.admissionNo !== undefined ? String(academicStatus.admissionNo).trim() : (oldAcademic.admissionNo || ''),
      admissionDate: academicStatus.admissionDate !== undefined ? String(academicStatus.admissionDate).trim() : (oldAcademic.admissionDate || ''),
      // Strictly keep old yearJoined untouched unless explicitly sent
      yearJoined: academicStatus.yearJoined !== undefined ? String(academicStatus.yearJoined).trim() : (oldAcademic.yearJoined || ''),
      admissionStatus: academicStatus.admissionStatus !== undefined ? academicStatus.admissionStatus : (oldAcademic.admissionStatus || 'Confirmed'),
      rank: academicStatus.rank !== undefined ? String(academicStatus.rank).trim() : (oldAcademic.rank || ''),
      previousCollege: academicStatus.previousCollege !== undefined ? String(academicStatus.previousCollege).trim() : (oldAcademic.previousCollege || ''),
      stream: academicStatus.stream !== undefined ? String(academicStatus.stream).trim() : (oldAcademic.stream || ''),
      degreeYear: academicStatus.degreeYear !== undefined ? String(academicStatus.degreeYear).trim() : (oldAcademic.degreeYear || '')
    } : oldAcademic;

    const nextClass = studentClass ? String(studentClass).trim() : oldStudent.class;
    const classChanged = nextClass.toLowerCase() !== String(oldStudent.class || '').trim().toLowerCase();
    let finalEditRoll = oldStudent.roll;
    if (isAdmin || oldStudent.isPrivate) {
      if (roll !== undefined && String(roll).trim() !== '' && !isNaN(Number(roll))) {
        finalEditRoll = Number(roll);
      }
    } else if (classChanged) {
      finalEditRoll = await getNextRollForClass(nextClass, { isPrivate: { $ne: true } });
    }

    const updatePayload = {
      name: name ? String(name).trim() : oldStudent.name,
      class: nextClass,
      roll: finalEditRoll,
      photoUrl: photoUrl || oldStudent.photoUrl,
      personalDetails: mergedPersonal,
      address: mergedAddress,
      familyDetails: mergedFamily,
      academicStatus: mergedAcademic,
      customFields: customFields !== undefined ? customFields : oldStudent.customFields
    };

    // Student ID editing logic:
    // - Private student: owner or admin can edit
    // - Public student: admin can edit
    if (newStudentId !== undefined) {
      const cleanNewId = String(newStudentId).trim();
      if (!cleanNewId) {
        return res.status(400).json({ success: false, message: 'Student ID cannot be empty' });
      }
      if (oldStudent.isPrivate) {
        if (String(cleanNewId).toLowerCase() !== String(oldStudent.studentId).toLowerCase()) {
          const duplicate = await Student.findOne({
            _id: { $ne: req.params.id },
            studentId: cleanNewId,
            isPrivate: true,
            ownerEmail: oldStudent.ownerEmail
          });
          if (duplicate) {
            return res.status(400).json({
              success: false,
              message: `Student ID "${cleanNewId}" already exists in your private workspace. Please choose a unique ID.`
            });
          }
        }
        updatePayload.studentId = cleanNewId;
      } else if (req.user && req.user.role === 'admin') {
        if (String(cleanNewId).toLowerCase() !== String(oldStudent.studentId).toLowerCase()) {
          const duplicate = await Student.findOne({
            _id: { $ne: req.params.id },
            studentId: cleanNewId,
            isPrivate: { $ne: true }
          });
          if (duplicate) {
            return res.status(400).json({
              success: false,
              message: `Student ID "${cleanNewId}" already exists for student "${duplicate.name}". Please choose a unique ID.`
            });
          }
        }
        updatePayload.studentId = cleanNewId;
      }
    }

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true }
    );

    await ActivityLog.create({
      action: `${oldStudent.isPrivate ? 'Private Student Updated' : 'Student Updated'}: ${updated.name} (ID: ${updated.studentId})`,
      details: `Class: ${updated.class} • Roll: #${updated.roll}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'student',
      entityId: updated._id.toString(),
      canUndo: true,
      previousState: oldStudent.toObject(),
      isPrivate: Boolean(oldStudent.isPrivate),
      ownerEmail: oldStudent.isPrivate ? oldStudent.ownerEmail : ''
    });

    const [enriched] = await attachAttendanceStatsToStudents([updated]);
    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/students/:id/remarks
// @desc    Add a teacher remark to a student (All authenticated teachers & admin)
router.post('/:id/remarks', authMiddleware, async (req, res) => {
  try {
    const { text, subject } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, message: 'Remark text is required' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const userName = (req.user && req.user.name) ? req.user.name.trim() : 'Teacher';
    const userRole = (req.user && req.user.role) ? req.user.role : 'teacher';

    let resolvedSubject = subject && String(subject).trim() ? String(subject).trim() : '';
    if (!resolvedSubject) {
      try {
        const subDoc = await Subject.findOne({
          $or: [
            ...(userEmail ? [{ ownerEmail: userEmail }] : []),
            ...(userName ? [{ teacher: caseInsensitiveRegex(userName) }] : [])
          ]
        }).lean();
        if (subDoc && subDoc.name) resolvedSubject = subDoc.name;
      } catch (_) {}
      if (!resolvedSubject) {
        resolvedSubject = userRole === 'admin' ? 'Admin' : 'Faculty';
      }
    }

    const remarkObj = {
      teacherId: req.user._id || null,
      teacherName: userName,
      teacherEmail: userEmail,
      teacherSubject: resolvedSubject,
      teacherAvatar: (req.user && req.user.avatarUrl) ? req.user.avatarUrl : '',
      text: String(text).trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!Array.isArray(student.remarks)) {
      student.remarks = [];
    }
    student.remarks.push(remarkObj);
    await student.save();

    const addedRemark = student.remarks[student.remarks.length - 1];

    await ActivityLog.create({
      action: `Student Remark Added: ${student.name}`,
      details: `Teacher: ${userName} • Remark: "${String(text).trim().slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
      performedBy: userName,
      performedByEmail: userEmail,
      role: userRole,
      entityType: 'remark',
      entityId: student._id.toString(),
      canUndo: true,
      previousState: {
        studentId: student._id.toString(),
        remarkId: addedRemark ? addedRemark._id.toString() : null,
        type: 'add'
      },
      isPrivate: Boolean(student.isPrivate),
      ownerEmail: student.isPrivate ? student.ownerEmail : ''
    });

    const [enriched] = await attachAttendanceStatsToStudents([student]);
    if (Array.isArray(enriched.remarks)) {
      enriched.remarks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    res.status(201).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/students/:id/remarks/:remarkId
// @desc    Edit a remark (Teachers can edit only their own; Admin can edit any)
router.put('/:id/remarks/:remarkId', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, message: 'Remark text is required' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const remark = (student.remarks || []).id(req.params.remarkId);
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remark not found' });
    }

    const isAdmin = req.user && req.user.role === 'admin';
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isOwner = (remark.teacherId && req.user._id && String(remark.teacherId) === String(req.user._id)) ||
                    (remark.teacherEmail && userEmail && remark.teacherEmail.toLowerCase().trim() === userEmail);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Permission denied: You can only edit your own remarks' });
    }

    const previousRemarkText = remark.text;
    remark.text = String(text).trim();
    remark.updatedAt = new Date();
    await student.save();

    await ActivityLog.create({
      action: `Student Remark Updated: ${student.name}`,
      details: `Teacher: ${req.user.name || 'Teacher'} • Previous: "${previousRemarkText.slice(0, 40)}"`,
      performedBy: req.user ? req.user.name : 'Teacher',
      performedByEmail: userEmail,
      role: req.user ? req.user.role : 'teacher',
      entityType: 'remark',
      entityId: student._id.toString(),
      canUndo: true,
      previousState: {
        studentId: student._id.toString(),
        remarkId: req.params.remarkId,
        previousText: previousRemarkText,
        type: 'edit'
      },
      isPrivate: Boolean(student.isPrivate),
      ownerEmail: student.isPrivate ? student.ownerEmail : ''
    });

    const [enriched] = await attachAttendanceStatsToStudents([student]);
    if (Array.isArray(enriched.remarks)) {
      enriched.remarks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/students/:id/remarks/:remarkId
// @desc    Delete a remark (Teachers can delete only their own; Admin can delete any)
router.delete('/:id/remarks/:remarkId', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const remark = (student.remarks || []).id(req.params.remarkId);
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remark not found' });
    }

    const isAdmin = req.user && req.user.role === 'admin';
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isOwner = (remark.teacherId && req.user._id && String(remark.teacherId) === String(req.user._id)) ||
                    (remark.teacherEmail && userEmail && remark.teacherEmail.toLowerCase().trim() === userEmail);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Permission denied: You can only delete your own remarks' });
    }

    const deletedRemarkSnapshot = remark.toObject ? remark.toObject() : { ...remark };
    student.remarks.pull({ _id: req.params.remarkId });
    await student.save();

    await ActivityLog.create({
      action: `Student Remark Deleted: ${student.name}`,
      details: `Teacher: ${req.user.name || 'Teacher'} • Deleted: "${(deletedRemarkSnapshot.text || '').slice(0, 40)}"`,
      performedBy: req.user ? req.user.name : 'Teacher',
      performedByEmail: userEmail,
      role: req.user ? req.user.role : 'teacher',
      entityType: 'remark',
      entityId: student._id.toString(),
      canUndo: true,
      previousState: {
        studentId: student._id.toString(),
        remark: deletedRemarkSnapshot,
        type: 'delete'
      },
      isPrivate: Boolean(student.isPrivate),
      ownerEmail: student.isPrivate ? student.ownerEmail : ''
    });

    const [enriched] = await attachAttendanceStatsToStudents([student]);
    if (Array.isArray(enriched.remarks)) {
      enriched.remarks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/students/:id
// @desc    Delete student
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isAdmin = req.user && req.user.role === 'admin';
    if (student.isPrivate && !isAdmin && student.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: 'Access denied to this private student' });
    }

    await Student.findByIdAndDelete(req.params.id);

    await ActivityLog.create({
      action: `${student.isPrivate ? 'Private Student Deleted' : 'Student Deleted'}: ${student.name} (ID: ${student.studentId})`,
      details: `Class: ${student.class} • Roll: #${student.roll}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'student',
      entityId: req.params.id,
      canUndo: true,
      previousState: student.toObject(),
      isPrivate: Boolean(student.isPrivate),
      ownerEmail: student.isPrivate ? student.ownerEmail : ''
    });

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
