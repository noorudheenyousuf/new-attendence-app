const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// Helper to ensure subjects assigned to multiple classes are split into individual records
async function ensureSubjectsPerClass() {
  try {
    const multiSubjects = await Subject.find({
      $expr: { $gt: [{ $size: { $ifNull: ["$assignedClasses", []] } }, 1] }
    });

    for (const sub of multiSubjects) {
      const classes = sub.assignedClasses || [];
      if (classes.length <= 1) continue;

      const firstClass = classes[0];
      const otherClasses = classes.slice(1);

      // Keep original document for the first class
      sub.assignedClasses = [firstClass];
      await sub.save();

      // Create a separate document with its own unique _id for each other class
      for (const cls of otherClasses) {
        const existing = await Subject.findOne({
          name: sub.name,
          assignedClasses: cls
        });
        if (!existing) {
          await Subject.create({
            name: sub.name,
            subjectCode: sub.subjectCode,
            teacher: sub.teacher,
            assignedClasses: [cls],
            order: sub.order || 0
          });
        }
      }
    }
  } catch (err) {
    console.error('[Subject Split Error]:', err);
  }
}

// @route   GET /api/subjects
// @desc    Get all subjects sorted by custom order
router.get('/', async (req, res) => {
  try {
    await ensureSubjectsPerClass();
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
// @desc    Add subject (name, subject code optional, teacher optional, assigned classes)
// When assigned to multiple classes, splits into distinct records per class
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, subjectCode, teacher, assignedClasses } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Subject name is required' });
    }

    const cleanName = name.trim();
    const finalCode = (subjectCode && subjectCode.trim())
      ? subjectCode.trim()
      : ((cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SUB') + '101');

    const classesArray = Array.isArray(assignedClasses)
      ? assignedClasses.map(c => String(c).trim()).filter(Boolean)
      : (assignedClasses ? assignedClasses.split(',').map(s => s.trim()).filter(Boolean) : []);

    if (classesArray.length > 1) {
      // USER DIRECTIVE:
      // When we assign a subject for two classes, split that subject into two separate subject records
      // with their own IDs so they do not conflict or delete each other!
      const createdSubjects = [];
      for (const cls of classesArray) {
        const s = await Subject.create({
          name: cleanName,
          subjectCode: finalCode,
          teacher: teacher ? teacher.trim() : '',
          assignedClasses: [cls]
        });
        createdSubjects.push(s);
        await Class.updateOne({ name: cls }, { $addToSet: { assignedSubjects: cleanName } });
      }

      await ActivityLog.create({
        action: `Subject Added: ${cleanName}`,
        details: `Code: ${finalCode} • Split across ${classesArray.length} classes: ${classesArray.join(', ')}`,
        performedBy: req.user ? req.user.name : 'Teacher',
        role: req.user ? req.user.role : 'teacher',
        entityType: 'subject',
        entityId: createdSubjects[0]._id.toString(),
        canUndo: true,
        previousState: null
      });

      return res.status(201).json({ success: true, data: createdSubjects[0], created: createdSubjects });
    }

    // Single class or unassigned
    const newSubject = await Subject.create({
      name: cleanName,
      subjectCode: finalCode,
      teacher: teacher ? teacher.trim() : '',
      assignedClasses: classesArray
    });

    if (classesArray.length === 1) {
      await Class.updateOne({ name: classesArray[0] }, { $addToSet: { assignedSubjects: cleanName } });
    }

    await ActivityLog.create({
      action: `Subject Added: ${cleanName}`,
      details: `Code: ${finalCode}${classesArray.length ? ` • Classes: ${classesArray.join(', ')}` : ''}`,
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
      ? assignedClasses.map(c => String(c).trim()).filter(Boolean)
      : (assignedClasses ? assignedClasses.split(',').map(s => s.trim()).filter(Boolean) : oldSubject.assignedClasses);

    const updatedName = name ? name.trim() : oldSubject.name;
    const updatedCode = subjectCode ? subjectCode.trim() : oldSubject.subjectCode;
    const updatedTeacher = teacher !== undefined ? teacher.trim() : oldSubject.teacher;

    if (classesArray.length > 1) {
      const firstClass = classesArray[0];
      const otherClasses = classesArray.slice(1);

      const updated = await Subject.findByIdAndUpdate(
        req.params.id,
        {
          name: updatedName,
          subjectCode: updatedCode,
          teacher: updatedTeacher,
          assignedClasses: [firstClass]
        },
        { new: true }
      );
      await Class.updateOne({ name: firstClass }, { $addToSet: { assignedSubjects: updatedName } });

      for (const cls of otherClasses) {
        const existing = await Subject.findOne({ name: updatedName, assignedClasses: cls });
        if (!existing) {
          await Subject.create({
            name: updatedName,
            subjectCode: updatedCode,
            teacher: updatedTeacher,
            assignedClasses: [cls]
          });
        }
        await Class.updateOne({ name: cls }, { $addToSet: { assignedSubjects: updatedName } });
      }

      await ActivityLog.create({
        action: `Subject Updated: ${updated.name}`,
        details: `Code: ${updated.subjectCode} • Classes: ${classesArray.join(', ')}`,
        performedBy: req.user ? req.user.name : 'Teacher',
        role: req.user ? req.user.role : 'teacher',
        entityType: 'subject',
        entityId: updated._id.toString(),
        canUndo: true,
        previousState: oldSubject.toObject()
      });

      return res.json({ success: true, data: updated });
    }

    const updated = await Subject.findByIdAndUpdate(
      req.params.id,
      {
        name: updatedName,
        subjectCode: updatedCode,
        teacher: updatedTeacher,
        assignedClasses: classesArray
      },
      { new: true }
    );

    if (classesArray.length === 1) {
      await Class.updateOne({ name: classesArray[0] }, { $addToSet: { assignedSubjects: updatedName } });
    }

    await ActivityLog.create({
      action: `Subject Updated: ${updated.name}`,
      details: `Code: ${updated.subjectCode}${classesArray.length ? ` • Classes: ${classesArray.join(', ')}` : ''}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'subject',
      entityId: updated._id.toString(),
      canUndo: true,
      previousState: oldSubject.toObject()
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/subjects/:id
// @desc    Delete subject (only deletes this specific subject record, preserving other classes)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    await Subject.findByIdAndDelete(req.params.id);

    // If assigned to a class, remove from that class's assignedSubjects only if no duplicate remains
    if (Array.isArray(subject.assignedClasses) && subject.assignedClasses.length > 0) {
      for (const cls of subject.assignedClasses) {
        const remainingForClass = await Subject.findOne({
          name: subject.name,
          assignedClasses: cls
        });
        if (!remainingForClass) {
          await Class.updateOne({ name: cls }, { $pull: { assignedSubjects: subject.name } });
        }
      }
    }

    await ActivityLog.create({
      action: `Subject Deleted: ${subject.name}`,
      details: `Code: ${subject.subjectCode}${subject.assignedClasses?.length ? ` • Class: ${subject.assignedClasses.join(', ')}` : ''}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'subject',
      entityId: req.params.id,
      canUndo: true,
      previousState: subject.toObject()
    });

    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
module.exports.ensureSubjectsPerClass = ensureSubjectsPerClass;
