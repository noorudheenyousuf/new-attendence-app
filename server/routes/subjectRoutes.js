const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/subjects
// @desc    Get all subjects sorted by custom order
router.get('/', async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/subjects/reorder
// @desc    Update subjects display order via drag-and-drop
router.put('/reorder', authMiddleware, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ success: false, message: 'orderedIds array required' });
    }
    const updatePromises = orderedIds.map((id, index) =>
      Subject.findByIdAndUpdate(id, { order: index })
    );
    await Promise.all(updatePromises);
    const subjects = await Subject.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/subjects
// @desc    Add subject (name, subject code, teacher optional, assigned classes)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, subjectCode, teacher, assignedClasses } = req.body;
    if (!name || !subjectCode) {
      return res.status(400).json({ success: false, message: 'Subject name and code are required' });
    }

    const classesArray = Array.isArray(assignedClasses)
      ? assignedClasses
      : (assignedClasses ? assignedClasses.split(',').map(s => s.trim()).filter(Boolean) : []);

    const newSubject = await Subject.create({
      name,
      subjectCode,
      teacher: teacher || '',
      assignedClasses: classesArray
    });

    await ActivityLog.create({
      action: `Subject Added: ${name}`,
      details: `Code: ${subjectCode} • Classes: ${classesArray.join(', ')}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'subject',
      entityId: newSubject._id.toString(),
      canUndo: true,
      previousState: null
    });

    res.status(201).json({ success: true, data: newSubject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/subjects/:id
// @desc    Edit subject details
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, subjectCode, teacher, assignedClasses } = req.body;
    const oldSubject = await Subject.findById(req.params.id);
    if (!oldSubject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const classesArray = Array.isArray(assignedClasses)
      ? assignedClasses
      : (assignedClasses ? assignedClasses.split(',').map(s => s.trim()).filter(Boolean) : oldSubject.assignedClasses);

    const updated = await Subject.findByIdAndUpdate(
      req.params.id,
      {
        name: name || oldSubject.name,
        subjectCode: subjectCode || oldSubject.subjectCode,
        teacher: teacher !== undefined ? teacher : oldSubject.teacher,
        assignedClasses: classesArray
      },
      { new: true }
    );

    await ActivityLog.create({
      action: `Subject Updated: ${updated.name}`,
      details: `Code: ${updated.subjectCode} • Classes: ${classesArray.join(', ')}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'subject',
      entityId: updated._id.toString(),
      canUndo: true,
      previousState: {
        name: oldSubject.name,
        subjectCode: oldSubject.subjectCode,
        teacher: oldSubject.teacher,
        assignedClasses: oldSubject.assignedClasses
      }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/subjects/:id
// @desc    Delete subject
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    await Subject.findByIdAndDelete(req.params.id);

    await ActivityLog.create({
      action: `Subject Deleted: ${subject.name}`,
      details: `Code: ${subject.subjectCode}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'subject',
      entityId: req.params.id,
      canUndo: true,
      previousState: {
        name: subject.name,
        subjectCode: subject.subjectCode,
        teacher: subject.teacher,
        assignedClasses: subject.assignedClasses
      }
    });

    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
