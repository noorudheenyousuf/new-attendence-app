const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/classes
// @desc    Get all classes sorted by custom order
router.get('/', async (req, res) => {
  try {
    const classes = await Class.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/classes/reorder
// @desc    Update classes display order via drag-and-drop
router.put('/reorder', authMiddleware, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ success: false, message: 'orderedIds array required' });
    }
    const updatePromises = orderedIds.map((id, index) =>
      Class.findByIdAndUpdate(id, { order: index })
    );
    await Promise.all(updatePromises);
    const classes = await Class.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/classes
// @desc    Add a class (only asks name and class teacher)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, classTeacher } = req.body;
    if (!name || !classTeacher) {
      return res.status(400).json({ success: false, message: 'Class name and class teacher are required' });
    }

    const existing = await Class.findOne({ name });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Class with this name already exists' });
    }

    const newClass = await Class.create({
      name,
      classTeacher
    });

    // Log action
    await ActivityLog.create({
      action: `Class Added: ${name}`,
      details: `Teacher: ${classTeacher}`,
      performedBy: req.user ? req.user.name : 'Admin',
      role: req.user ? req.user.role : 'admin',
      entityType: 'class',
      entityId: newClass._id.toString(),
      canUndo: true,
      previousState: null
    });

    res.status(201).json({ success: true, data: newClass });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/classes/:id
// @desc    Update class
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, classTeacher } = req.body;
    const oldClass = await Class.findById(req.params.id);
    if (!oldClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const updated = await Class.findByIdAndUpdate(
      req.params.id,
      { name, classTeacher },
      { new: true }
    );

    await ActivityLog.create({
      action: `Class Updated: ${name}`,
      details: `Teacher: ${classTeacher}`,
      performedBy: req.user ? req.user.name : 'Admin',
      role: req.user ? req.user.role : 'admin',
      entityType: 'class',
      entityId: updated._id.toString(),
      canUndo: true,
      previousState: { name: oldClass.name, classTeacher: oldClass.classTeacher }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/classes/:id
// @desc    Delete class
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    await Class.findByIdAndDelete(req.params.id);

    await ActivityLog.create({
      action: `Class Deleted: ${cls.name}`,
      details: `Teacher: ${cls.classTeacher}`,
      performedBy: req.user ? req.user.name : 'Admin',
      role: req.user ? req.user.role : 'admin',
      entityType: 'class',
      entityId: req.params.id,
      canUndo: true,
      previousState: { name: cls.name, classTeacher: cls.classTeacher }
    });

    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
