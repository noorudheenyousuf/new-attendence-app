const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema({
  studentRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  name: {
    type: String,
    default: ''
  },
  previousClass: {
    type: String,
    default: ''
  },
  previousRoll: {
    type: Number,
    default: null
  },
  previousLifecycleStatus: {
    type: String,
    default: 'active'
  },
  previousRank: {
    type: String,
    default: ''
  },
  previousExitInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  previousHistoryLength: {
    type: Number,
    default: 0
  },
  action: {
    type: String,
    enum: ['promote', 'retain', 'graduate', 'tc'],
    required: true
  },
  newClass: {
    type: String,
    default: ''
  },
  newRoll: {
    type: Number,
    default: null
  },
  newLifecycleStatus: {
    type: String,
    default: 'active'
  }
}, { _id: false });

const promotionBatchSchema = new mongoose.Schema({
  fromAcademicYear: {
    type: String,
    required: true,
    trim: true
  },
  toAcademicYear: {
    type: String,
    required: true,
    trim: true
  },
  mode: {
    type: String,
    enum: ['class', 'whole-school', 'reorder'],
    default: 'class'
  },
  rollOrderMode: {
    type: String,
    enum: ['rank', 'previous', 'alpha'],
    default: 'rank'
  },
  sourceClasses: [{
    type: String,
    trim: true
  }],
  summary: {
    total: { type: Number, default: 0 },
    promoted: { type: Number, default: 0 },
    retained: { type: Number, default: 0 },
    graduated: { type: Number, default: 0 },
    tc: { type: Number, default: 0 }
  },
  snapshots: [snapshotSchema],
  performedBy: {
    type: String,
    default: 'Admin'
  },
  performedByEmail: {
    type: String,
    default: '',
    trim: true,
    lowercase: true
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
  isUndone: {
    type: Boolean,
    default: false
  },
  undoneAt: {
    type: Date,
    default: null
  },
  undoneBy: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('PromotionBatch', promotionBatchSchema);
