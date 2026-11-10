const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const { caseInsensitiveRegex, escapeRegex } = require('../utils/caseHelper');

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
// @desc    Add a class (name, optional class teacher, and assigned subjects)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, classTeacher, assignedSubjects } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Class name is required' });
    }

    const cleanName = name.trim();
    const existing = await Class.findOne({ name: caseInsensitiveRegex(cleanName) });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Class with this name already exists' });
    }

    const subjectsArray = Array.isArray(assignedSubjects)
      ? assignedSubjects.map(s => String(s).trim()).filter(Boolean)
      : [];

    const newClass = await Class.create({
      name: cleanName,
      classTeacher: classTeacher || 'Not Assigned',
      assignedSubjects: subjectsArray
    });

    // Log action
    await ActivityLog.create({
      action: `Class Added: ${cleanName}`,
      details: `Teacher: ${classTeacher || 'None'} | Subjects: ${subjectsArray.join(', ') || 'All'}`,
      performedBy: req.user ? req.user.name : 'Admin',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase().trim() : '',
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
// @desc    Update class & cascade name changes across Students, Attendance, Timetable, Subjects, and Teachers
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, classTeacher, assignedSubjects } = req.body;
    const oldClass = await Class.findById(req.params.id);
    if (!oldClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const cleanName = name ? name.trim() : oldClass.name;
    const oldName = oldClass.name;

    // Check if another class exists with this new name (case-insensitive)
    if (name && cleanName.toLowerCase() !== oldName.toLowerCase()) {
      const duplicate = await Class.findOne({
        _id: { $ne: req.params.id },
        name: caseInsensitiveRegex(cleanName)
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Class with name "${cleanName}" already exists` });
      }
    }

    const updatePayload = {
      name: cleanName,
      classTeacher: classTeacher !== undefined ? (classTeacher || 'Not Assigned') : oldClass.classTeacher
    };

    if (assignedSubjects !== undefined) {
      updatePayload.assignedSubjects = Array.isArray(assignedSubjects)
        ? assignedSubjects.map(s => String(s).trim()).filter(Boolean)
        : [];
    }

    const updated = await Class.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true }
    );

    // CASCADE CLASS NAME RENAME / CASE CHANGE
    // If the name changed in any way (casing or spelling), migrate all references!
    if (cleanName !== oldName) {
      const oldClassRegex = caseInsensitiveRegex(oldName);

      // 1. Cascade to Student models
      await Student.updateMany(
        { class: oldClassRegex },
        { $set: { class: cleanName } }
      );

      // 2. Cascade to Attendance documents
      await Attendance.updateMany(
        { class: oldClassRegex },
        { $set: { class: cleanName } }
      );

      // 3. Cascade to Timetable slots
      await Timetable.updateMany(
        { class: oldClassRegex },
        { $set: { class: cleanName } }
      );

      // 4. Cascade to Subject assignedClasses
      const subjectsWithClass = await Subject.find({ assignedClasses: oldClassRegex });
      for (const sub of subjectsWithClass) {
        let changed = false;
        sub.assignedClasses = sub.assignedClasses.map(c => {
          if (c && c.toLowerCase() === oldName.toLowerCase()) {
            changed = true;
            return cleanName;
          }
          return c;
        });
        if (changed) await sub.save();
      }

      // 5. Cascade to User assignedClasses
      const teachersWithClass = await User.find({ assignedClasses: oldClassRegex });
      for (const t of teachersWithClass) {
        let changed = false;
        t.assignedClasses = t.assignedClasses.map(c => {
          if (c && c.toLowerCase() === oldName.toLowerCase()) {
            changed = true;
            return cleanName;
          }
          return c;
        });
        if (changed) await t.save();
      }
    }

    await ActivityLog.create({
      action: `Class Updated: ${cleanName}`,
      details: `Teacher: ${classTeacher || oldClass.classTeacher}`,
      performedBy: req.user ? req.user.name : 'Admin',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase().trim() : '',
      role: req.user ? req.user.role : 'admin',
      entityType: 'class',
      entityId: updated._id.toString(),
      canUndo: true,
      previousState: { name: oldClass.name, classTeacher: oldClass.classTeacher, assignedSubjects: oldClass.assignedSubjects }
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
      performedByEmail: req.user ? (req.user.email || '').toLowerCase().trim() : '',
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
