const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema({
  appName: {
    type: String,
    default: 'REGISTERLY',
    trim: true
  },
  schoolName: {
    type: String,
    default: '',
    trim: true
  },
  appLogo: {
    type: String,
    default: '',
    trim: true
  },
  headerActionButton: {
    type: String,
    enum: ['guide', 'theme'],
    default: 'guide'
  },
  allowNonAdminEditDelete: {
    type: Boolean,
    default: false
  },
  showTeachersTabToAll: {
    type: Boolean,
    default: true
  },
  allowStudentDetailsPrint: {
    type: Boolean,
    default: true
  },
  showAnnouncementsOnDashboard: {
    type: Boolean,
    default: true
  },
  showEventsOnDashboard: {
    type: Boolean,
    default: true
  },
  studentFormFields: {
    type: Array,
    default: []
  },
  currentAcademicYear: {
    type: String,
    default: '2026-27',
    trim: true
  },
  lastYearBackupAt: {
    type: Date,
    default: null
  },
  lastYearBackupYear: {
    type: String,
    default: '',
    trim: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AppSettings', appSettingsSchema);

