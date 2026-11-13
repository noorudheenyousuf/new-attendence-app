const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['P', 'A', 'L'],
    required: true,
    default: 'P'
  },
  note: {
    type: String,
    default: ''
  }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD
    required: true
  },
  class: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    default: 'all'
  },
  records: [attendanceRecordSchema],
  summary: {
    total: { type: Number, default: 0 },
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    leave: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }
  },
  markedBy: {
    type: String,
    default: 'Admin'
  },
  markedByEmail: {
    type: String,
    default: ''
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  ownerEmail: {
    type: String,
    default: '',
    trim: true,
    lowercase: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index including ownerEmail so private workspace sessions don't collide with main institution sessions
attendanceSchema.index({ date: 1, class: 1, subject: 1, ownerEmail: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
