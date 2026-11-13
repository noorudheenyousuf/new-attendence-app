const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
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
    yearJoined: { type: String, default: '' },
    admissionStatus: { type: String, default: 'Confirmed' },
    rank: { type: String, default: '' },
    previousCollege: { type: String, default: '' }
  },
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
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

studentSchema.index({ studentId: 1, ownerEmail: 1, isPrivate: 1 });

// Helper static method to get next auto-increment student ID for regular institution students starting at 2000
studentSchema.statics.getNextStudentId = async function() {
  const publicStudents = await this.find({
    isPrivate: { $ne: true },
    studentId: { $type: 'number' }
  }).sort({ studentId: -1 }).limit(1).select('studentId');

  const highest = publicStudents[0];
  if (!highest || !highest.studentId || Number(highest.studentId) < 2000) {
    return 2000;
  }
  return Number(highest.studentId) + 1;
};

// Helper static method to get next auto-increment student ID for private workspace students (starting at P-101)
studentSchema.statics.getNextPrivateStudentId = async function(ownerEmail) {
  const email = (ownerEmail || '').trim().toLowerCase();
  const privateStudents = await this.find({
    isPrivate: true,
    ownerEmail: email
  }).select('studentId');

  let maxNum = 100;
  for (const st of privateStudents) {
    const strId = String(st.studentId || '').trim();
    const match = strId.match(/^P-?(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `P-${maxNum + 1}`;
};

module.exports = mongoose.model('Student', studentSchema);
