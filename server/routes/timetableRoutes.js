const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { caseInsensitiveRegex } = require('../utils/caseHelper');

// @route   GET /api/timetable
// @desc    Get timetable slots, solely filtered by class, day, teacherEmail, or mine
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { class: className, day, teacherEmail, email, mine } = req.query;
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

    const targetEmail = (teacherEmail || email || '').trim().toLowerCase();

    if (mine === 'true') {
      const myEmail = (req.user && req.user.email) ? req.user.email.trim().toLowerCase() : '';
      if (myEmail) {
        andConditions.push({ teacherEmail: myEmail });
      }
    } else if (targetEmail && targetEmail !== 'all') {
      andConditions.push({ teacherEmail: targetEmail });
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
// @desc    Create a timetable slot mapped strictly to user email
router.post('/', authMiddleware, async (req, res) => {
  try {
    let { day, days, timeSlot, class: className, subject, teacherEmail, room } = req.body;
    if (Array.isArray(days) && days.length > 0) {
      if (!day) day = days.join(', ');
    } else if (day && (!days || days.length === 0)) {
      days = day.split(',').map(d => d.trim()).filter(Boolean);
    }
    if (!day || !timeSlot || !className || !subject) {
      return res.status(400).json({ success: false, message: 'Day, time slot, class, and subject are required' });
    }

    // Determine target teacher email solely (no name linking)
    let finalTeacherEmail = (teacherEmail || '').trim().toLowerCase();
    if (!finalTeacherEmail && req.user && req.user.email) {
      finalTeacherEmail = req.user.email.trim().toLowerCase();
    }

    if (!finalTeacherEmail) {
      return res.status(400).json({ success: false, message: 'Teacher email is required to assign a timetable slot' });
    }

    let finalTeacherId = null;
    const foundUser = await User.findOne({ email: finalTeacherEmail }).select('_id email').lean();
    if (foundUser) {
      finalTeacherId = foundUser._id;
    }

    const lastSlot = await Timetable.findOne().sort({ order: -1 }).select('order').lean();
    const nextOrder = lastSlot && typeof lastSlot.order === 'number' ? lastSlot.order + 1 : 0;

    const slot = new Timetable({
      day,
      days: Array.isArray(days) ? days : [day],
      timeSlot: timeSlot.trim(),
      class: className.trim(),
      subject: subject.trim(),
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
// @desc    Update a timetable slot (mapped strictly to user email)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const slot = await Timetable.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }

    // Permission check: Admin can update any slot; non-admin can only update their own (strictly by email)
    const isAdmin = req.user && req.user.role === 'admin';
    const myEmail = (req.user && req.user.email) ? req.user.email.trim().toLowerCase() : '';
    const isOwner = Boolean(myEmail && slot.teacherEmail && slot.teacherEmail.trim().toLowerCase() === myEmail);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this timetable slot' });
    }

    let { day, days, timeSlot, class: className, subject, teacherEmail, room } = req.body;
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

    // Teacher assignment strictly by email
    if (teacherEmail !== undefined) {
      const cleanEmail = (teacherEmail || '').trim().toLowerCase();
      if (cleanEmail) {
        slot.teacherEmail = cleanEmail;
        const found = await User.findOne({ email: cleanEmail }).select('_id email').lean();
        slot.teacherId = found ? found._id : null;
      }
    }

    await slot.save();
    res.json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/timetable/:id
// @desc    Delete a timetable slot (permission checked strictly by email)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const slot = await Timetable.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }

    // Permission check: Admin can delete any slot; non-admin can only delete their own (strictly by email)
    const isAdmin = req.user && req.user.role === 'admin';
    const myEmail = (req.user && req.user.email) ? req.user.email.trim().toLowerCase() : '';
    const isOwner = Boolean(myEmail && slot.teacherEmail && slot.teacherEmail.trim().toLowerCase() === myEmail);

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
