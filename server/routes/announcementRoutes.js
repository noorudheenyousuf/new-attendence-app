const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const optionalAuth = require('../middleware/optionalAuth');

// @route   GET /api/announcements
// @desc    Get announcements (All users get published ones; admin gets all)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const filter = isAdmin ? {} : { isPublished: true };
    const announcements = await Announcement.find(filter).sort({ publishedAt: -1, createdAt: -1 }).lean();
    res.json({ success: true, data: announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/announcements
// @desc    Create a new announcement (Admin only)
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { title, description, priority, isPublished, publishedAt } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const announcement = new Announcement({
      title: title.trim(),
      description: description.trim(),
      priority: priority === 'important' ? 'important' : 'normal',
      isPublished: isPublished !== false,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      createdBy: req.user ? req.user._id : null,
      createdByName: req.user ? (req.user.name || 'Administration') : 'Administration'
    });

    await announcement.save();
    res.status(201).json({ success: true, data: announcement, message: 'Announcement created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/announcements/:id
// @desc    Update announcement (Admin only)
router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const { title, description, priority, isPublished, publishedAt } = req.body;
    if (title !== undefined) announcement.title = title.trim();
    if (description !== undefined) announcement.description = description.trim();
    if (priority !== undefined) announcement.priority = priority === 'important' ? 'important' : 'normal';
    if (isPublished !== undefined) announcement.isPublished = Boolean(isPublished);
    if (publishedAt !== undefined) announcement.publishedAt = new Date(publishedAt);

    await announcement.save();
    res.json({ success: true, data: announcement, message: 'Announcement updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/announcements/:id
// @desc    Delete announcement (Admin only)
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
