const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  studentRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  class: {
    type: String,
    required: true,
    trim: true
  },
  roll: {
    type: Number,
    default: 1
  },
  fromDate: {
    type: String, // YYYY-MM-DD
    required: true
  },
  toDate: {
    type: String, // YYYY-MM-DD
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  teacherRemarks: {
    type: String,
    default: '',
    trim: true
  },
  reviewedBy: {
    type: String,
    default: ''
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

leaveRequestSchema.index({ studentId: 1, class: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
