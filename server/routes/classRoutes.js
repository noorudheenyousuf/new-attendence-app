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
const optionalAuth = require('../middleware/optionalAuth');
const { caseInsensitiveRegex, escapeRegex } = require('../utils/caseHelper');

// @route   GET /api/classes
// @desc    Get classes (supports ?scope=private, ?scope=public, or default all accessible)
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

    const classes = await Class.find(query).sort({ order: 1, createdAt: 1 });
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
// @desc    Add a class (name, optional class teacher, and assigned subjects; supports isPrivate)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, classTeacher, classTeacherEmail, assignedSubjects, isPrivate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Class name is required' });
    }

    const cleanName = name.trim();
    const isPrivateBool = Boolean(isPrivate);
    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const userName = req.user ? req.user.name : 'Teacher';
    const userRole = req.user ? req.user.role : 'teacher';

    if (isPrivateBool) {
      const existing = await Class.findOne({
        name: caseInsensitiveRegex(cleanName),
        isPrivate: true,
        ownerEmail: userEmail
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `Private class "${cleanName}" already exists in your workspace` });
      }
    } else {
      const existing = await Class.findOne({
        name: caseInsensitiveRegex(cleanName),
        isPrivate: { $ne: true }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Class with this name already exists' });
      }
    }

    const subjectsArray = Array.isArray(assignedSubjects)
      ? assignedSubjects.map(s => String(s).trim()).filter(Boolean)
      : [];

    let resolvedClassTeacher = classTeacher || (isPrivateBool ? userName : 'Not Assigned');
    let resolvedClassTeacherEmail = (classTeacherEmail || '').toLowerCase().trim();

    let teacherUser = null;
    if (resolvedClassTeacherEmail) {
      teacherUser = await User.findOne({ email: resolvedClassTeacherEmail });
    } else if (resolvedClassTeacher && resolvedClassTeacher !== 'Not Assigned') {
      teacherUser = await User.findOne({ name: caseInsensitiveRegex(resolvedClassTeacher) });
    }

    if (teacherUser) {
      resolvedClassTeacher = teacherUser.name;
      resolvedClassTeacherEmail = (teacherUser.email || '').toLowerCase().trim();
      await User.updateMany({ _id: { $ne: teacherUser._id }, classTeacherOf: caseInsensitiveRegex(cleanName) }, { $set: { classTeacherOf: '' } });
      if (teacherUser.classTeacherOf && teacherUser.classTeacherOf.toLowerCase() !== cleanName.toLowerCase()) {
        await Class.updateMany({ name: caseInsensitiveRegex(teacherUser.classTeacherOf), classTeacher: teacherUser.name }, { $set: { classTeacher: 'Not Assigned', classTeacherEmail: '' } });
      }
      teacherUser.classTeacherOf = cleanName;
      await teacherUser.save();
    } else if (!resolvedClassTeacher || resolvedClassTeacher === 'Not Assigned') {
      await User.updateMany({ classTeacherOf: caseInsensitiveRegex(cleanName) }, { $set: { classTeacherOf: '' } });
      resolvedClassTeacherEmail = '';
    }

    const newClass = await Class.create({
      name: cleanName,
      classTeacher: resolvedClassTeacher,
      classTeacherEmail: resolvedClassTeacherEmail,
      assignedSubjects: subjectsArray,
      isPrivate: isPrivateBool,
      ownerEmail: isPrivateBool ? userEmail : '',
      ownerId: isPrivateBool ? req.user._id : null,
      ownerName: isPrivateBool ? userName : ''
    });

    // Ensure this class has its own dedicated Subject document for each assigned subject
    for (const subName of subjectsArray) {
      const existing = await Subject.findOne({
        name: caseInsensitiveRegex(subName),
        assignedClasses: cleanName,
        ...(isPrivateBool ? { isPrivate: true, ownerEmail: userEmail } : { isPrivate: { $ne: true } })
      });
      if (!existing) {
        const template = await Subject.findOne({
          name: caseInsensitiveRegex(subName),
          ...(isPrivateBool ? { ownerEmail: userEmail } : {})
        });
        await Subject.create({
          name: subName,
          subjectCode: template ? template.subjectCode : '',
          teacher: template ? template.teacher : (isPrivateBool ? userName : ''),
          assignedClasses: [cleanName],
          isPrivate: isPrivateBool,
          ownerEmail: isPrivateBool ? userEmail : '',
          ownerId: isPrivateBool ? req.user._id : null,
          ownerName: isPrivateBool ? userName : ''
        });
      }
    }

    // Log action
    await ActivityLog.create({
      action: `${isPrivateBool ? 'Private Class Added' : 'Class Added'}: ${cleanName}`,
      details: `Teacher: ${classTeacher || (isPrivateBool ? userName : 'None')} | Subjects: ${subjectsArray.join(', ') || 'All'}`,
      performedBy: userName,
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: userRole,
      entityType: 'class',
      entityId: newClass._id.toString(),
      canUndo: true,
      previousState: null,
      isPrivate: isPrivateBool,
      ownerEmail: isPrivateBool ? userEmail : ''
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
    const { name, classTeacher, classTeacherEmail, assignedSubjects } = req.body;
    const oldClass = await Class.findById(req.params.id);
    if (!oldClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isAdmin = req.user && req.user.role === 'admin';
    if (oldClass.isPrivate && !isAdmin && oldClass.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: 'Access denied to this private class' });
    }

    const cleanName = name ? name.trim() : oldClass.name;
    const oldName = oldClass.name;

    // Check if another class exists with this new name (case-insensitive)
    if (name && cleanName.toLowerCase() !== oldName.toLowerCase()) {
      const duplicateQuery = oldClass.isPrivate
        ? { _id: { $ne: req.params.id }, name: caseInsensitiveRegex(cleanName), isPrivate: true, ownerEmail: oldClass.ownerEmail }
        : { _id: { $ne: req.params.id }, name: caseInsensitiveRegex(cleanName), isPrivate: { $ne: true } };
      const duplicate = await Class.findOne(duplicateQuery);
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Class with name "${cleanName}" already exists` });
      }
    }

    let resolvedClassTeacher = classTeacher !== undefined ? (classTeacher || 'Not Assigned') : oldClass.classTeacher;
    let resolvedClassTeacherEmail = (classTeacherEmail !== undefined ? (classTeacherEmail || '') : (oldClass.classTeacherEmail || '')).toLowerCase().trim();

    if (classTeacher !== undefined || classTeacherEmail !== undefined) {
      let teacherUser = null;
      if (resolvedClassTeacherEmail) {
        teacherUser = await User.findOne({ email: resolvedClassTeacherEmail });
      } else if (resolvedClassTeacher && resolvedClassTeacher !== 'Not Assigned') {
        teacherUser = await User.findOne({ name: caseInsensitiveRegex(resolvedClassTeacher) });
      }

      if (teacherUser) {
        resolvedClassTeacher = teacherUser.name;
        resolvedClassTeacherEmail = (teacherUser.email || '').toLowerCase().trim();
        await User.updateMany({ _id: { $ne: teacherUser._id }, classTeacherOf: caseInsensitiveRegex(cleanName) }, { $set: { classTeacherOf: '' } });
        if (teacherUser.classTeacherOf && teacherUser.classTeacherOf.toLowerCase() !== cleanName.toLowerCase()) {
          await Class.updateMany({ name: caseInsensitiveRegex(teacherUser.classTeacherOf), classTeacher: teacherUser.name }, { $set: { classTeacher: 'Not Assigned', classTeacherEmail: '' } });
        }
        teacherUser.classTeacherOf = cleanName;
        await teacherUser.save();
      } else if (!resolvedClassTeacher || resolvedClassTeacher === 'Not Assigned') {
        await User.updateMany({ classTeacherOf: caseInsensitiveRegex(cleanName) }, { $set: { classTeacherOf: '' } });
        resolvedClassTeacherEmail = '';
      }
    }

    const updatePayload = {
      name: cleanName,
      classTeacher: resolvedClassTeacher,
      classTeacherEmail: resolvedClassTeacherEmail
    };

    if (assignedSubjects !== undefined) {
      const oldSubjects = Array.isArray(oldClass.assignedSubjects) ? oldClass.assignedSubjects : [];
      const newSubjects = Array.isArray(assignedSubjects)
        ? assignedSubjects.map(s => String(s).trim()).filter(Boolean)
        : [];
      updatePayload.assignedSubjects = newSubjects;

      // 1. Ensure this class has its own dedicated Subject document for each assigned subject
      for (const subName of newSubjects) {
        const existing = await Subject.findOne({
          name: caseInsensitiveRegex(subName),
          assignedClasses: cleanName,
          ...(oldClass.isPrivate ? { isPrivate: true, ownerEmail: oldClass.ownerEmail } : { isPrivate: { $ne: true } })
        });
        if (!existing) {
          const template = await Subject.findOne({
            name: caseInsensitiveRegex(subName),
            ...(oldClass.isPrivate ? { ownerEmail: oldClass.ownerEmail } : {})
          });
          await Subject.create({
            name: subName,
            subjectCode: template ? template.subjectCode : '',
            teacher: template ? template.teacher : '',
            assignedClasses: [cleanName],
            isPrivate: Boolean(oldClass.isPrivate),
            ownerEmail: oldClass.isPrivate ? oldClass.ownerEmail : '',
            ownerId: oldClass.isPrivate ? oldClass.ownerId : null,
            ownerName: oldClass.isPrivate ? oldClass.ownerName : ''
          });
        }
      }

      // 2. For removed subjects, unbind from this class
      const removedSubjects = oldSubjects.filter(os => !newSubjects.some(ns => ns.toLowerCase() === os.toLowerCase()));
      for (const remSub of removedSubjects) {
        const subDoc = await Subject.findOne({
          name: caseInsensitiveRegex(remSub),
          assignedClasses: oldName,
          ...(oldClass.isPrivate ? { isPrivate: true, ownerEmail: oldClass.ownerEmail } : { isPrivate: { $ne: true } })
        });
        if (subDoc) {
          if (subDoc.assignedClasses.length <= 1) {
            await Subject.findByIdAndDelete(subDoc._id);
          } else {
            subDoc.assignedClasses = subDoc.assignedClasses.filter(c => c !== oldName && c !== cleanName);
            await subDoc.save();
          }
        }
      }
    }

    const updated = await Class.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true }
    );

    // CASCADE CLASS NAME RENAME / CASE CHANGE
    if (cleanName !== oldName) {
      const oldClassRegex = caseInsensitiveRegex(oldName);
      const studentQuery = oldClass.isPrivate
        ? { class: oldClassRegex, isPrivate: true, ownerEmail: oldClass.ownerEmail }
        : { class: oldClassRegex, isPrivate: { $ne: true } };

      await Student.updateMany(studentQuery, { $set: { class: cleanName } });

      const attendanceQuery = oldClass.isPrivate
        ? { class: oldClassRegex, isPrivate: true, ownerEmail: oldClass.ownerEmail }
        : { class: oldClassRegex, isPrivate: { $ne: true } };
      await Attendance.updateMany(attendanceQuery, { $set: { class: cleanName } });

      if (!oldClass.isPrivate) {
        await Timetable.updateMany({ class: oldClassRegex }, { $set: { class: cleanName } });
        await User.updateMany({ classTeacherOf: oldClassRegex }, { $set: { classTeacherOf: cleanName } });
      }

      const subjectQuery = oldClass.isPrivate
        ? { assignedClasses: oldClassRegex, isPrivate: true, ownerEmail: oldClass.ownerEmail }
        : { assignedClasses: oldClassRegex, isPrivate: { $ne: true } };
      const subjectsWithClass = await Subject.find(subjectQuery);
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

      if (!oldClass.isPrivate) {
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
    }

    await ActivityLog.create({
      action: `${oldClass.isPrivate ? 'Private Class Updated' : 'Class Updated'}: ${cleanName}`,
      details: `Teacher: ${classTeacher || oldClass.classTeacher}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'class',
      entityId: updated._id.toString(),
      canUndo: true,
      previousState: { name: oldClass.name, classTeacher: oldClass.classTeacher, assignedSubjects: oldClass.assignedSubjects },
      isPrivate: Boolean(oldClass.isPrivate),
      ownerEmail: oldClass.isPrivate ? oldClass.ownerEmail : ''
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

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isAdmin = req.user && req.user.role === 'admin';
    if (cls.isPrivate && !isAdmin && cls.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: 'Access denied to this private class' });
    }

    await Class.findByIdAndDelete(req.params.id);

    // Clean up subjects that belonged exclusively to this class
    const subQuery = cls.isPrivate
      ? { assignedClasses: cls.name, isPrivate: true, ownerEmail: cls.ownerEmail }
      : { assignedClasses: cls.name, isPrivate: { $ne: true } };
    const classSubjects = await Subject.find(subQuery);
    for (const sub of classSubjects) {
      if (sub.assignedClasses.length <= 1) {
        await Subject.findByIdAndDelete(sub._id);
      } else {
        sub.assignedClasses = sub.assignedClasses.filter(c => c !== cls.name);
        await sub.save();
      }
    }

    await ActivityLog.create({
      action: `${cls.isPrivate ? 'Private Class Deleted' : 'Class Deleted'}: ${cls.name}`,
      details: `Teacher: ${cls.classTeacher}`,
      performedBy: req.user ? req.user.name : 'Teacher',
      performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',
      role: req.user ? req.user.role : 'teacher',
      entityType: 'class',
      entityId: req.params.id,
      canUndo: true,
      previousState: cls.toObject(),
      isPrivate: Boolean(cls.isPrivate),
      ownerEmail: cls.isPrivate ? cls.ownerEmail : ''
    });

    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
