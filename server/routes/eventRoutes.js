const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const optionalAuth = require('../middleware/optionalAuth');

// @route   GET /api/events
// @desc    Get school events (optionally only upcoming)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { upcoming } = req.query;
    const filter = {};
    if (upcoming === 'true') {
      filter.status = 'upcoming';
    }
    const events = await Event.find(filter).sort({ date: 1, time: 1, createdAt: -1 }).lean();
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/events
// @desc    Create a new event (Admin only)
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { name, description, date, time, location, status } = req.body;
    if (!name || !date) {
      return res.status(400).json({ success: false, message: 'Event name and date are required' });
    }

    const event = new Event({
      name: name.trim(),
      description: (description || '').trim(),
      date: date.trim(),
      time: (time || '').trim(),
      location: (location || '').trim(),
      status: ['upcoming', 'completed', 'cancelled'].includes(status) ? status : 'upcoming',
      createdBy: req.user ? req.user._id : null
    });

    await event.save();
    res.status(201).json({ success: true, data: event, message: 'Event created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/events/:id
// @desc    Update event (Admin only)
router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const { name, description, date, time, location, status } = req.body;
    if (name !== undefined) event.name = name.trim();
    if (description !== undefined) event.description = description.trim();
    if (date !== undefined) event.date = date.trim();
    if (time !== undefined) event.time = time.trim();
    if (location !== undefined) event.location = location.trim();
    if (status !== undefined && ['upcoming', 'completed', 'cancelled'].includes(status)) {
      event.status = status;
    }

    await event.save();
    res.json({ success: true, data: event, message: 'Event updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete event (Admin only)
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
