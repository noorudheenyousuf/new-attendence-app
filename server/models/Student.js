const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: {
    type: Number,
    required: true,
    unique: true
  },
  photoUrl: {
    type: String,
    default: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face'
  },
  name: {
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
    required: true
  },
  address: {
    fullAddress: { type: String, default: '' },
    place: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' }
  },
  familyDetails: {
    fatherName: { type: String, default: '' },
    motherName: { type: String, default: '' },
    fatherMobile: { type: String, default: '' },
    fatherWhatsapp: { type: String, default: '' }
  },
  academicStatus: {
    admissionStatus: { type: String, default: 'Confirmed' },
    rank: { type: String, default: '' },
    previousCollege: { type: String, default: '' }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Helper static method to get next auto-increment student ID starting at 2000
studentSchema.statics.getNextStudentId = async function() {
  const highest = await this.findOne().sort({ studentId: -1 }).select('studentId');
  if (!highest || highest.studentId < 2000) {
    return 2000;
  }
  return highest.studentId + 1;
};

module.exports = mongoose.model('Student', studentSchema);
