const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// @route   GET /api/subjects
// @desc    Get subjects sorted by custom order (supports ?scope=private, ?scope=public, or default all accessible)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const { scope } = req.query;

    let query = {};
    if (scope === 'private') {
      if (!userEmail) return res.json({ success: true, data: [] });
      query = { isPrivate: true, ownerEmail: userEmail };
    } else if (scope === 'public') {
      query = { isPrivate: { $ne: true } };
    } else {
      query = userEmail
        ? { $or: [{ isPrivate: { $ne: true } }, { isPrivate: true, ownerEmail: userEmail }] }
        : { isPrivate: { $ne: true } };
    }

    const subjects = await Subject.find(query).sort({ order: 1, createdAt: 1 });
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
// @desc    Add subject (name, subject code optional, teacher optional, assigned classes, isPrivate)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, subjectCode, teacher, assignedClasses, isPrivate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Subject name is required' });
    }

    const cleanName = name.trim();
    const isPrivateBool = Boolean(isPrivate);
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const userName = req.user ? req.user.name : 'Teacher';
    const userRole = req.user ? req.user.role : 'teacher';

    const finalCode = (subjectCode && subjectCode.trim())
      ? subjectCode.trim()
      : ((cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SUB') + '101');

    const classesArray = Array.isArray(assignedClasses)
      ? assignedClasses.map(c => String(c).trim()).filter(Boolean)
      : (assignedClasses ? assignedClasses.split(',').map(s => s.trim()).filter(Boolean) : []);

    // Single class or unassigned (dropdown enforces max one class)
    const newSubject = await Subject.create({
      name: cleanName,
      subjectCode: finalCode,
      teacher: teacher ? teacher.trim() : (isPrivateBool ? userName : ''),
      assignedClasses: classesArray,
      isPrivate: isPrivateBool,
      ownerEmail: isPrivateBool ? userEmail : '',
      ownerId: isPrivateBool ? req.user._id : null,
      ownerName: isPrivateBool ? userName : ''
    });

    if (classesArray.length === 1) {
      const classQuery = isPrivateBool
        ? { name: classesArray[0], isPrivate: true, ownerEmail: userEmail }
        : { name: classesArray[0] };
      await Class.updateOne(classQuery, { $addToSet: { assignedSubjects: cleanName } });
    }

    await ActivityLog.create({
      action: `${isPrivateBool ? 'Private Subject Added' : 'Subject Added'}: ${cleanName}`,
      details: `Code: ${finalCode}${classesArray.length ? ` • Classes: ${classesArray.join(', ')}` : ''}`,
      performedBy: userName,
      role: userRole,
      entityType: 'subject',
      entityId: newSubject._id.toString(),
      canUndo: true,
      previousState: null,
      isPrivate: isPrivateBool,
      ownerEmail: isPrivateBool ? userEmail : ''
    });

    res.status(201).json({ success: true, data: newSubject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/subjects/:id
// @desc    Edit subject details — fixes all siblings (same name) atomically
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, subjectCode, teacher, assignedClasses } = req.body;
    const oldSubject = await Subject.findById(req.params.id);
    if (!oldSubject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isAdmin = req.user && req.user.role === 'admin';
    if (oldSubject.isPrivate && !isAdmin && oldSubject.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: 'Access denied to this private subject' });
    }

    const updatedName    = name        ? name.trim()        : oldSubject.name;
    const updatedCode    = subjectCode ? subjectCode.trim()  : oldSubject.subjectCode;
    const updatedTeacher = teacher !== undefined ? teacher.trim() : oldSubject.teacher;

    // Each subject doc represents one subject-class entry independently
    // Dropdown enforces max one class — just update this single doc
    const newClasses = Array.isArray(assignedClasses)
      ? assignedClasses.map(c => String(c).trim()).filter(Boolean).slice(0, 1)
      : (assignedClasses ? [String(assignedClasses).trim()].filter(Boolean) : []);

    const oldClass = (oldSubject.assignedClasses || [])[0] || '';
    const newClass = newClasses[0] || '';

    // Update Class.assignedSubjects: pull from old class, push to new class
    if (oldClass && oldClass !== newClass) {
      const oldClassQ = oldSubject.isPrivate
        ? { name: oldClass, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
        : { name: oldClass };
      await Class.updateOne(oldClassQ, { $pull: { assignedSubjects: oldSubject.name } });
      if (updatedName !== oldSubject.name) {
        await Class.updateOne(oldClassQ, { $pull: { assignedSubjects: updatedName } });
      }
    }
    if (newClass) {
      const newClassQ = oldSubject.isPrivate
        ? { name: newClass, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
        : { name: newClass };
      await Class.updateOne(newClassQ, { $addToSet: { assignedSubjects: updatedName } });
    }
    // If name changed, rename in old class's assignedSubjects
    if (updatedName !== oldSubject.name && oldClass && oldClass === newClass) {
      const classQ = oldSubject.isPrivate
        ? { name: oldClass, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
        : { name: oldClass };
      await Class.updateOne(classQ, { $pull: { assignedSubjects: oldSubject.name } });
      await Class.updateOne(classQ, { $addToSet: { assignedSubjects: updatedName } });
    }

    // Update this single subject doc
    await Subject.findByIdAndUpdate(req.params.id, {
      name: updatedName, subjectCode: updatedCode,
      teacher: updatedTeacher, assignedClasses: newClasses
    });

    const finalDoc = await Subject.findById(req.params.id);

    await ActivityLog.create({
      action: `${oldSubject.isPrivate ? 'Private Subject Updated' : 'Subject Updated'}: ${updatedName}`,
      details: `Code: ${updatedCode}${newClasses.length ? ` • Classes: ${newClasses.join(', ')}` : ' • Unassigned'}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'subject',
      entityId: req.params.id,
      canUndo: true,
      previousState: oldSubject.toObject(),
      isPrivate: Boolean(oldSubject.isPrivate),
      ownerEmail: oldSubject.isPrivate ? oldSubject.ownerEmail : ''
    });

    res.json({ success: true, data: finalDoc });
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

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isAdmin = req.user && req.user.role === 'admin';
    if (subject.isPrivate && !isAdmin && subject.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: 'Access denied to this private subject' });
    }

    await Subject.findByIdAndDelete(req.params.id);

    // If assigned to a class, remove from that class's assignedSubjects only if no duplicate remains
    if (Array.isArray(subject.assignedClasses) && subject.assignedClasses.length > 0) {
      for (const cls of subject.assignedClasses) {
        const query = subject.isPrivate
          ? { name: subject.name, assignedClasses: cls, isPrivate: true, ownerEmail: subject.ownerEmail }
          : { name: subject.name, assignedClasses: cls, isPrivate: { $ne: true } };
        const remainingForClass = await Subject.findOne(query);
        if (!remainingForClass) {
          const classQuery = subject.isPrivate
            ? { name: cls, isPrivate: true, ownerEmail: subject.ownerEmail }
            : { name: cls };
          await Class.updateOne(classQuery, { $pull: { assignedSubjects: subject.name } });
        }
      }
    }

    await ActivityLog.create({
      action: `${subject.isPrivate ? 'Private Subject Deleted' : 'Subject Deleted'}: ${subject.name}`,
      details: `Code: ${subject.subjectCode}${subject.assignedClasses?.length ? ` • Class: ${subject.assignedClasses.join(', ')}` : ''}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'subject',
      entityId: req.params.id,
      canUndo: true,
      previousState: subject.toObject(),
      isPrivate: Boolean(subject.isPrivate),
      ownerEmail: subject.isPrivate ? subject.ownerEmail : ''
    });

    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
