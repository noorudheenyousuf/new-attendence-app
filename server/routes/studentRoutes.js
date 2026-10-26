const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/students
// @desc    Get all students (with class filter and search)
router.get('/', async (req, res) => {
  try {
    const { class: classFilter, search } = req.query;
    let query = {};

    if (classFilter && classFilter !== 'all') {
      query.class = classFilter;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { class: searchRegex },
        { 'familyDetails.fatherName': searchRegex },
        { 'familyDetails.fatherMobile': searchRegex },
        { 'familyDetails.fatherWhatsapp': searchRegex }
      ];
      const parsedNum = Number(search);
      if (!isNaN(parsedNum)) {
        query.$or.push({ studentId: parsedNum }, { roll: parsedNum });
      }
    }

    const students = await Student.find(query).sort({ class: 1, roll: 1 });
    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/students/next-id
// @desc    Get next auto-increment student ID (starting with 2000)
router.get('/next-id', async (req, res) => {
  try {
    const nextId = await Student.getNextStudentId();
    res.json({ success: true, nextId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/students
// @desc    Add new student (auto assigns studentId >= 2000)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      class: studentClass,
      roll,
      photoUrl,
      address,
      familyDetails,
      academicStatus
    } = req.body;

    if (!name || !studentClass || !roll) {
      return res.status(400).json({ success: false, message: 'Name, class, and roll number are required' });
    }

    // Auto-generate studentId starting at 2000
    const studentId = await Student.getNextStudentId();

    const newStudent = await Student.create({
      studentId,
      name,
      class: studentClass,
      roll: Number(roll),
      photoUrl: photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face',
      address: address || {},
      familyDetails: familyDetails || {},
      academicStatus: academicStatus || {}
    });

    await ActivityLog.create({
      action: `Student Enrolled: ${name} (ID: ${studentId})`,
      details: `Class: ${studentClass} • Roll: #${roll}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'student',
      entityId: newStudent._id.toString(),
      canUndo: true,
      previousState: null
    });

    res.status(201).json({ success: true, data: newStudent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/students/:id
// @desc    Edit student (ALL fields editable, studentId preserved)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const oldStudent = await Student.findById(req.params.id);
    if (!oldStudent) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const {
      name,
      class: studentClass,
      roll,
      photoUrl,
      address,
      familyDetails,
      academicStatus
    } = req.body;

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      {
        name: name || oldStudent.name,
        class: studentClass || oldStudent.class,
        roll: roll !== undefined ? Number(roll) : oldStudent.roll,
        photoUrl: photoUrl || oldStudent.photoUrl,
        address: address !== undefined ? address : oldStudent.address,
        familyDetails: familyDetails !== undefined ? familyDetails : oldStudent.familyDetails,
        academicStatus: academicStatus !== undefined ? academicStatus : oldStudent.academicStatus
      },
      { new: true }
    );

    await ActivityLog.create({
      action: `Student Updated: ${updated.name} (ID: ${updated.studentId})`,
      details: `Class: ${updated.class} • Roll: #${updated.roll}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'student',
      entityId: updated._id.toString(),
      canUndo: true,
      previousState: oldStudent.toObject()
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

    await Student.findByIdAndDelete(req.params.id);

    await ActivityLog.create({
      action: `Student Deleted: ${student.name} (ID: ${student.studentId})`,
      details: `Class: ${student.class} • Roll: #${student.roll}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'student',
      entityId: req.params.id,
      canUndo: true,
      previousState: student.toObject()
    });

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
