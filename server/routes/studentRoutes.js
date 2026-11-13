const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// @route   GET /api/students
// @desc    Get all students (with class filter, search, and scope: 'all' | 'private' | 'public')
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { class: classFilter, search, scope } = req.query;
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    let query = {};

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
        // Combine scope $or with search conditions
        query = {
          $and: [
            { $or: query.$or },
            { $or: searchConditions }
          ]
        };
        if (classFilter && classFilter !== 'all') {
          query.$and.push({ class: caseInsensitiveRegex(classFilter) });
        }
      } else {
        query.$or = searchConditions;
      }
    }

    const students = await Student.find(query).sort({ class: 1, roll: 1 });
    res.json({ success: true, data: students });
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

// @route   POST /api/students
// @desc    Add new student (auto assigns studentId; allows private workspace student with prefix P-101 & editable ID)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      class: studentClass,
      roll,
      photoUrl,
      address,
      familyDetails,
      academicStatus,
      customFields,
      isPrivate,
      studentId: customStudentId
    } = req.body;

    if (!name || !studentClass || !roll) {
      return res.status(400).json({ success: false, message: 'Name, class, and roll number are required' });
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

      // Strict backend validation: Duplicate Private Student ID check for this user
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
      // Auto-generate institutional studentId starting at 2000
      studentId = await Student.getNextStudentId();
    }

    const newStudent = await Student.create({
      studentId,
      name,
      class: studentClass,
      roll: Number(roll),
      photoUrl: photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face',
      address: address || {},
      familyDetails: familyDetails || {},
      academicStatus: academicStatus || {},
      customFields: customFields || {},
      isPrivate: isPrivateBool,
      ownerEmail: isPrivateBool ? userEmail : '',
      ownerId: isPrivateBool ? req.user._id : null,
      ownerName: isPrivateBool ? userName : ''
    });

    await ActivityLog.create({
      action: `${isPrivateBool ? 'Private Student Enrolled' : 'Student Enrolled'}: ${name} (ID: ${studentId})`,
      details: `Class: ${studentClass} • Roll: #${roll}`,
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

    res.status(201).json({ success: true, data: newStudent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/students/:id
// @desc    Edit student (ALL fields editable, studentId editable for private students without admin restriction)
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
      address,
      familyDetails,
      academicStatus,
      customFields,
      studentId: newStudentId
    } = req.body;

    const updatePayload = {
      name: name || oldStudent.name,
      class: studentClass || oldStudent.class,
      roll: roll !== undefined ? Number(roll) : oldStudent.roll,
      photoUrl: photoUrl || oldStudent.photoUrl,
      address: address !== undefined ? address : oldStudent.address,
      familyDetails: familyDetails !== undefined ? familyDetails : oldStudent.familyDetails,
      academicStatus: academicStatus !== undefined ? academicStatus : oldStudent.academicStatus,
      customFields: customFields !== undefined ? customFields : oldStudent.customFields
    };

    // Private student ID editing logic without requiring admin permission
    if (oldStudent.isPrivate && newStudentId !== undefined) {
      const cleanNewId = String(newStudentId).trim();
      if (!cleanNewId) {
        return res.status(400).json({ success: false, message: 'Private Student ID cannot be empty' });
      }
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

    res.json({ success: true, data: updated });
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
