const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subjectCode: {
    type: String,
    default: '',
    trim: true
  },
  teacher: {
    type: String,
    default: '',
    trim: true
  },
  assignedClasses: {
    type: [String],
    default: []
  },
  order: {
    type: Number,
    default: 0
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
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ownerName: {
    type: String,
    default: '',
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

subjectSchema.index({ name: 1, ownerEmail: 1, isPrivate: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
