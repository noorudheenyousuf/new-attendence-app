const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  studentRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  academicYear: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  className: {
    type: String,
    required: true,
    trim: true
  },
  roll: {
    type: Number,
    required: true
  },
  previousRoll: {
    type: Number,
    default: null
  },
  previousRank: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    enum: ['promoted', 'retained', 'new_admission'],
    default: 'promoted'
  },
  promotionBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromotionBatch',
    default: null,
    index: true
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
  }
}, { timestamps: true });

enrollmentSchema.index({ academicYear: 1, className: 1, isPrivate: 1, ownerEmail: 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
