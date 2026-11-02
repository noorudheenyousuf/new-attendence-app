const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const AppSettings = require('../models/AppSettings');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/messages
// @desc    Get all messages (last 100) sorted by newest first
router.get('/', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(100).lean();
    const currentUserId = req.user ? req.user._id.toString() : null;

    // Count how many are unread for current user
    let unreadCount = 0;
    if (currentUserId) {
      unreadCount = messages.filter(m => {
        const readArr = (m.readBy || []).map(id => id.toString());
        return !readArr.includes(currentUserId);
      }).length;
    }

    res.json({
      success: true,
      data: messages.reverse(), // chronological order
      unreadCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/messages
// @desc    Send a message (broadcast to all teachers)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const sender = req.user || {};
    const newMsg = new Message({
      senderId: sender._id,
      senderName: sender.name || 'Anonymous Teacher',
      senderRole: sender.role || 'teacher',
      senderAvatar: sender.avatarUrl || '',
      text: text.trim(),
      readBy: sender._id ? [sender._id] : []
    });

    await newMsg.save();

    res.status(201).json({
      success: true,
      data: newMsg
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/messages/mark-read
// @desc    Mark all messages as read for the logged in user
router.post('/mark-read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    if (userId) {
      await Message.updateMany(
        { readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );
    }
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/messages/:id
// @desc    Edit a message (sender or admin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const currentUserId = req.user ? req.user._id.toString() : '';
    const isAdmin = req.user && req.user.role === 'admin';
    const isSender = message.senderId && message.senderId.toString() === currentUserId;

    if (!isAdmin && !isSender) {
      return res.status(403).json({ success: false, message: 'Permission denied: You can only edit your own messages' });
    }

    message.text = text.trim();
    message.isEdited = true;
    await message.save();

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/messages/:id
// @desc    Delete a message (sender or admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const currentUserId = req.user ? req.user._id.toString() : '';
    const isAdmin = req.user && req.user.role === 'admin';
    const isSender = message.senderId && message.senderId.toString() === currentUserId;

    if (!isAdmin && !isSender) {
      return res.status(403).json({ success: false, message: 'Permission denied: You can only delete your own messages' });
    }

    await Message.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/messages
// @desc    Clear all chat messages (admin or allowed non-admin)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const settings = await AppSettings.findOne();
    const allowNonAdmin = Boolean(settings && settings.allowNonAdminEditDelete);

    if (!isAdmin && !allowNonAdmin) {
      return res.status(403).json({ success: false, message: 'Permission denied: Admin privileges required to clear chat history' });
    }

    await Message.deleteMany({});

    res.json({
      success: true,
      message: 'All chat history cleared'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
