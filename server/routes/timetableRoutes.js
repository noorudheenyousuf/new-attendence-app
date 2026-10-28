const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/timetable
// @desc    Get timetable slots, optionally filtered by class or day
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { class: className, day } = req.query;
    const filter = {};
    if (className && className !== 'all') {
      filter.class = className;
    }
    if (day && day !== 'all') {
      filter.day = day;
    }

    const slots = await Timetable.find(filter).sort({ day: 1, timeSlot: 1 }).lean();
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
    const { day, timeSlot, class: className, subject, teacher, room } = req.body;
    if (!day || !timeSlot || !className || !subject) {
      return res.status(400).json({ success: false, message: 'Day, time slot, class, and subject are required' });
    }

    const slot = new Timetable({
      day,
      timeSlot: timeSlot.trim(),
      class: className.trim(),
      subject: subject.trim(),
      teacher: (teacher || '').trim(),
      room: (room || '').trim()
    });

    await slot.save();
    res.status(201).json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/timetable/:id
// @desc    Update a timetable slot
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { day, timeSlot, class: className, subject, teacher, room } = req.body;
    const updated = await Timetable.findByIdAndUpdate(
      req.params.id,
      {
        ...(day && { day }),
        ...(timeSlot && { timeSlot: timeSlot.trim() }),
        ...(className && { class: className.trim() }),
        ...(subject && { subject: subject.trim() }),
        ...(teacher !== undefined && { teacher: teacher.trim() }),
        ...(room !== undefined && { room: room.trim() })
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/timetable/:id
// @desc    Delete a timetable slot
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await Timetable.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }
    res.json({ success: true, message: 'Timetable slot deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
