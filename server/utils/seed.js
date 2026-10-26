const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppSettings = require('../models/AppSettings');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const ActivityLog = require('../models/ActivityLog');

const seedInitialData = async () => {
  try {
    // 1. App Settings
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = await AppSettings.create({
        appName: 'REGISTERLY',
        schoolName: 'St. Xavier Higher Secondary School'
      });
      console.log('[Seed] Default App Settings initialized');
    }

    // 2. Default First User (Admin)
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      await User.create({
        name: 'Sarah Jenkins',
        email: 'sarah.jenkins@stxavier.edu',
        password: hashedPassword,
        role: 'admin',
        isFirstAccount: true,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
      });
      console.log('[Seed] First user created as Admin (sarah.jenkins@stxavier.edu / password123)');
    }

    // 3. Classes
    const classCount = await Class.countDocuments();
    if (classCount === 0) {
      await Class.insertMany([
        { name: 'Class 10', classTeacher: 'Mr. David Miller' },
        { name: 'Class 9', classTeacher: 'Ms. Rachel Green' },
        { name: 'Class 11', classTeacher: 'Dr. Alan Grant' }
      ]);
      console.log('[Seed] Sample classes initialized');
    }

    // 4. Subjects
    const subjectCount = await Subject.countDocuments();
    if (subjectCount === 0) {
      await Subject.insertMany([
        { name: 'Mathematics', subjectCode: 'MATH101', teacher: 'Sarah Jenkins', assignedClasses: ['Class 10', 'Class 9'] },
        { name: 'Physics', subjectCode: 'PHY201', teacher: 'Dr. Alan Grant', assignedClasses: ['Class 10', 'Class 11'] },
        { name: 'English', subjectCode: 'ENG102', teacher: 'Ms. Rachel Green', assignedClasses: ['Class 10', 'Class 9'] }
      ]);
      console.log('[Seed] Sample subjects initialized');
    }

    // 5. Students (IDs starting at 2000)
    const studentCount = await Student.countDocuments();
    if (studentCount === 0) {
      await Student.insertMany([
        {
          studentId: 2000,
          name: 'Aaron Davis',
          class: 'Class 10',
          roll: 101,
          photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face',
          address: { fullAddress: 'Rose Villa, MG Road', place: 'Kochi', district: 'Ernakulam', state: 'Kerala' },
          familyDetails: { fatherName: 'Robert Davis', motherName: 'Mary Davis', fatherMobile: '+91 9847012345', fatherWhatsapp: '+91 9847012345' },
          academicStatus: { yearJoined: '2024', admissionStatus: 'Confirmed', rank: '4', previousCollege: 'St. Pauls High' }
        },
        {
          studentId: 2001,
          name: 'Bella Thorne',
          class: 'Class 10',
          roll: 102,
          photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face',
          address: { fullAddress: 'Green Valley House', place: 'Aluva', district: 'Ernakulam', state: 'Kerala' },
          familyDetails: { fatherName: 'Edward Thorne', motherName: 'Clara Thorne', fatherMobile: '+91 9447123456', fatherWhatsapp: '+91 9447123456' },
          academicStatus: { yearJoined: '2024', admissionStatus: 'Confirmed', rank: '1', previousCollege: 'Model School' }
        },
        {
          studentId: 2002,
          name: 'Charlie Evans',
          class: 'Class 10',
          roll: 103,
          photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
          address: { fullAddress: 'Lake View Apt', place: 'Edappally', district: 'Ernakulam', state: 'Kerala' },
          familyDetails: { fatherName: 'John Evans', motherName: 'Sarah Evans', fatherMobile: '+91 9895001122', fatherWhatsapp: '+91 9895001122' },
          academicStatus: { yearJoined: '2023', admissionStatus: 'Provisional', rank: '9', previousCollege: 'Central School' }
        }
      ]);
      console.log('[Seed] Sample students initialized with IDs starting from 2000');
    }

    // 6. Initial Attendance Session
    const attendanceCount = await Attendance.countDocuments();
    if (attendanceCount === 0) {
      const today = new Date().toISOString().slice(0, 10);
      await Attendance.create({
        date: today,
        class: 'Class 10',
        subject: 'all',
        records: [
          { studentId: 2000, status: 'P', note: '' },
          { studentId: 2001, status: 'P', note: '' },
          { studentId: 2002, status: 'A', note: 'Fever' }
        ],
        summary: { total: 3, present: 2, absent: 1, late: 0, percentage: 66.7 },
        markedBy: 'Sarah Jenkins'
      });

      await ActivityLog.create({
        action: 'Attendance Marked: Class 10',
        details: '2 Present, 1 Absent, 0 Late (66.7%) • Initial Setup',
        performedBy: 'Sarah Jenkins',
        role: 'admin',
        counts: { present: 2, absent: 1, late: 0 },
        entityType: 'attendance',
        canUndo: true
      });
      console.log('[Seed] Initial attendance record created');
    }
  } catch (error) {
    console.error('[Seed Error]', error);
  }
};

module.exports = seedInitialData;
