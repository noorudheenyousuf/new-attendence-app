const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  studentId: {
    type: Number,
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index so one class & subject has one record per date
attendanceSchema.index({ date: 1, class: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
