const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    default: undefined
  },
  password: {
    type: String,
    required: false,
    default: ''
  },
  role: {
    type: String,
    enum: ['admin', 'teacher'],
    default: 'teacher'
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  isFirstAccount: {
    type: Boolean,
    default: false
  },
  googleId: {
    type: String,
    default: null
  },
  assignedClasses: [{
    type: String,
    trim: true
  }],
  assignedSubjects: [{
    type: String,
    trim: true
  }],
  phone: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
