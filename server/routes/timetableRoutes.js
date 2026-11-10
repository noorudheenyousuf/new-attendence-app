const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// @route   GET /api/timetable
// @desc    Get timetable slots, optionally filtered by class, day, teacher, teacherEmail, or mine
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { class: className, day, teacher, teacherEmail, teacherId, mine } = req.query;
    const andConditions = [];

    if (className && className !== 'all') {
      andConditions.push({ class: caseInsensitiveRegex(className) });
    }

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

    if (mine === 'true') {
      const myEmail = (req.user && req.user.email) ? req.user.email.trim() : '';
      const myName = (req.user && req.user.name) ? req.user.name.trim() : '';
      const myId = req.user ? req.user._id : null;
      const orClauses = [];
      if (myEmail) orClauses.push({ teacherEmail: caseInsensitiveRegex(myEmail) });
      if (myId) orClauses.push({ teacherId: myId });
      if (myName) orClauses.push({ teacher: caseInsensitiveRegex(myName) });
      if (orClauses.length > 0) {
        andConditions.push({ $or: orClauses });
      }
    } else if (teacherEmail && teacherEmail !== 'all') {
      andConditions.push({ teacherEmail: caseInsensitiveRegex(teacherEmail.trim()) });
    } else if (teacherId) {
      andConditions.push({ teacherId });
    } else if (teacher && teacher !== 'all') {
      andConditions.push({ teacher: caseInsensitiveRegex(teacher.trim()) });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};
    const slots = await Timetable.find(filter).sort({ order: 1, createdAt: 1 }).lean();
    res.json({
      success: true,
      data: slots
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/timetable
// @desc    Create a timetable slot
router.post('/', authMiddleware, async (req, res) => {
  try {
    let { day, days, timeSlot, class: className, subject, teacher, teacherEmail, teacherId, room } = req.body;
    if (Array.isArray(days) && days.length > 0) {
      if (!day) day = days.join(', ');
    } else if (day && (!days || days.length === 0)) {
      days = day.split(',').map(d => d.trim()).filter(Boolean);
    }
    if (!day || !timeSlot || !className || !subject) {
      return res.status(400).json({ success: false, message: 'Day, time slot, class, and subject are required' });
    }

    // Determine teacher, teacherEmail, and teacherId
    let finalTeacher = (teacher || '').trim();
    let finalTeacherEmail = (teacherEmail || '').trim().toLowerCase();
    let finalTeacherId = teacherId || null;

    if (!finalTeacher) {
      finalTeacher = (req.user && req.user.name) ? req.user.name.trim() : '';
      finalTeacherEmail = (req.user && req.user.email) ? req.user.email.trim().toLowerCase() : '';
      finalTeacherId = req.user ? req.user._id : null;
    } else if (!finalTeacherEmail || !finalTeacherId) {
      // Find matching user by email first, or id, or name
      let foundUser = null;
      if (finalTeacherEmail) {
        foundUser = await User.findOne({ email: caseInsensitiveRegex(finalTeacherEmail) }).select('_id name email').lean();
      } else if (finalTeacherId) {
        foundUser = await User.findById(finalTeacherId).select('_id name email').lean();
      } else if (req.user && req.user.name && req.user.name.trim().toLowerCase() === finalTeacher.toLowerCase()) {
        foundUser = req.user;
      } else {
        foundUser = await User.findOne({ name: caseInsensitiveRegex(finalTeacher) }).select('_id name email').lean();
      }

      if (foundUser) {
        finalTeacherId = foundUser._id;
        finalTeacher = foundUser.name;
        if (foundUser.email) finalTeacherEmail = foundUser.email.toLowerCase();
      }
    }

    const lastSlot = await Timetable.findOne().sort({ order: -1 }).select('order').lean();
    const nextOrder = lastSlot && typeof lastSlot.order === 'number' ? lastSlot.order + 1 : 0;

    const slot = new Timetable({
      day,
      days: Array.isArray(days) ? days : [day],
      timeSlot: timeSlot.trim(),
      class: className.trim(),
      subject: subject.trim(),
      teacher: finalTeacher,
      teacherEmail: finalTeacherEmail,
      teacherId: finalTeacherId,
      createdBy: req.user ? req.user._id : null,
      room: (room || '').trim(),
      order: nextOrder
    });

    await slot.save();
    res.status(201).json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/timetable/reorder
// @desc    Reorder timetable slots based on array of IDs
router.put('/reorder', authMiddleware, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (Array.isArray(orderedIds) && orderedIds.length > 0) {
      const ops = orderedIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order: index } }
        }
      }));
      await Timetable.bulkWrite(ops);
    }
    res.json({ success: true, message: 'Timetable order updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/timetable/:id
// @desc    Update a timetable slot
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const slot = await Timetable.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }

    // Permission check: Admin can update any slot; non-admin can only update their own
    const isAdmin = req.user && req.user.role === 'admin';
    const myEmail = (req.user && req.user.email) ? req.user.email.trim().toLowerCase() : '';
    const myName = (req.user && req.user.name) ? req.user.name.trim().toLowerCase() : '';
    const myId = req.user ? String(req.user._id) : '';
    const isOwner = (myEmail && slot.teacherEmail && slot.teacherEmail.trim().toLowerCase() === myEmail) ||
                    (myId && slot.teacherId && String(slot.teacherId) === myId) ||
                    (myName && slot.teacher && slot.teacher.trim().toLowerCase() === myName);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this timetable slot' });
    }

    let { day, days, timeSlot, class: className, subject, teacher, teacherEmail, teacherId, room } = req.body;
    if (Array.isArray(days) && days.length > 0) {
      if (!day) day = days.join(', ');
    } else if (day && (!days || days.length === 0)) {
      days = day.split(',').map(d => d.trim()).filter(Boolean);
    }

    if (day) slot.day = day;
    if (Array.isArray(days)) slot.days = days;
    if (timeSlot) slot.timeSlot = timeSlot.trim();
    if (className) slot.class = className.trim();
    if (subject) slot.subject = subject.trim();
    if (room !== undefined) slot.room = room.trim();

    // Teacher assignment
    if (teacher !== undefined) {
      slot.teacher = teacher.trim();
      let emailVal = (teacherEmail || '').trim().toLowerCase();
      let tId = teacherId || null;

      let foundUser = null;
      if (emailVal) {
        foundUser = await User.findOne({ email: caseInsensitiveRegex(emailVal) }).select('_id name email').lean();
      } else if (tId) {
        foundUser = await User.findById(tId).select('_id name email').lean();
      } else if (slot.teacher) {
        foundUser = await User.findOne({ name: caseInsensitiveRegex(slot.teacher) }).select('_id name email').lean();
      }

      if (foundUser) {
        slot.teacherId = foundUser._id;
        slot.teacher = foundUser.name;
        slot.teacherEmail = (foundUser.email || '').toLowerCase().trim();
      } else {
        if (teacherId) slot.teacherId = teacherId;
        if (teacherEmail) slot.teacherEmail = teacherEmail.trim().toLowerCase();
      }
    } else if (teacherEmail !== undefined) {
      slot.teacherEmail = teacherEmail.trim().toLowerCase();
    }

    await slot.save();
    res.json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/timetable/:id
// @desc    Delete a timetable slot
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const slot = await Timetable.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }

    // Permission check: Admin can delete any slot; non-admin can only delete their own
    const isAdmin = req.user && req.user.role === 'admin';
    const myEmail = (req.user && req.user.email) ? req.user.email.trim().toLowerCase() : '';
    const myName = (req.user && req.user.name) ? req.user.name.trim().toLowerCase() : '';
    const myId = req.user ? String(req.user._id) : '';
    const isOwner = (myEmail && slot.teacherEmail && slot.teacherEmail.trim().toLowerCase() === myEmail) ||
                    (myId && slot.teacherId && String(slot.teacherId) === myId) ||
                    (myName && slot.teacher && slot.teacher.trim().toLowerCase() === myName);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this timetable slot' });
    }

    await Timetable.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Timetable slot deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
