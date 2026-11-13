const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  classTeacher: {
    type: String,
    default: 'Not Assigned',
    trim: true
  },
  assignedSubjects: [{
    type: String,
    trim: true
  }],
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

classSchema.index({ name: 1, ownerEmail: 1, isPrivate: 1 });

module.exports = mongoose.model('Class', classSchema);
