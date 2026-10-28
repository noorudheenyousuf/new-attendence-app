const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  senderName: {
    type: String,
    required: true,
    trim: true
  },
  senderRole: {
    type: String,
    default: 'teacher'
  },
  senderAvatar: {
    type: String,
    default: ''
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);
