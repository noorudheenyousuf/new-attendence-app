const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  performedBy: {
    type: String,
    default: 'Teacher'
  },
  role: {
    type: String,
    enum: ['admin', 'teacher'],
    default: 'teacher'
  },
  counts: {
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    late: { type: Number, default: 0 }
  },
  entityType: {
    type: String,
    enum: ['attendance', 'student', 'subject', 'class', 'backup', 'settings'],
    default: 'attendance'
  },
  entityId: {
    type: String,
    default: ''
  },
  previousState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  canUndo: {
    type: Boolean,
    default: true
  },
  isUndone: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
