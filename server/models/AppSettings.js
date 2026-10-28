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
  allowNonAdminEditDelete: {
    type: Boolean,
    default: false
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AppSettings', appSettingsSchema);

