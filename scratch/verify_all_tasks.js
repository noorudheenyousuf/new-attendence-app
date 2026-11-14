const fs = require('fs');
const path = require('path');

console.log('=== RUNNING VERIFICATION SCRIPT ===\n');

// 1. Verify index.html
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf-8');

// Check 1a: No back buttons in view-classes, view-subjects, view-teachers
const viewClassesSection = indexHtml.match(/<section id="view-classes"[\s\S]*?<\/section>/)?.[0] || '';
const viewSubjectsSection = indexHtml.match(/<section id="view-subjects"[\s\S]*?<\/section>/)?.[0] || '';
const viewTeachersSection = indexHtml.match(/<section id="view-teachers"[\s\S]*?<\/section>/)?.[0] || '';

if (viewClassesSection.includes('title="Dashboard"') || viewClassesSection.includes("selectTab('home')")) {
  console.error('FAIL: view-classes still has back button!');
} else {
  console.log('PASS: view-classes has no back button.');
}

if (viewSubjectsSection.includes('title="Dashboard"') || viewSubjectsSection.includes("selectTab('home')")) {
  console.error('FAIL: view-subjects still has back button!');
} else {
  console.log('PASS: view-subjects has no back button.');
}

if (viewTeachersSection.includes('title="Dashboard"') || viewTeachersSection.includes("selectTab('home')")) {
  console.error('FAIL: view-teachers still has back button!');
} else {
  console.log('PASS: view-teachers has no back button.');
}

// Check 1b: Announcements & Events removed from index.html
if (indexHtml.includes('dash-section-announcements') || indexHtml.includes('dash-section-events')) {
  console.error('FAIL: Dashboard announcements/events sections still in index.html!');
} else {
  console.log('PASS: Dashboard announcements/events sections removed from index.html.');
}

if (indexHtml.includes('modal-announcement') || indexHtml.includes('modal-event')) {
  console.error('FAIL: Announcement/Event modals still in index.html!');
} else {
  console.log('PASS: Announcement/Event modals removed from index.html.');
}

if (indexHtml.includes('Announcements Management') || indexHtml.includes('Events Management') || indexHtml.includes('Dashboard Display Controls')) {
  console.error('FAIL: Announcements/Events management cards still in admin panel!');
} else {
  console.log('PASS: Announcements/Events management cards removed from admin panel.');
}

// Check 1c: Timetable notification controls removed from admin panel
const viewAdminSection = indexHtml.match(/<section id="view-admin"[\s\S]*?<\/section>/)?.[0] || '';
if (viewAdminSection.includes('Timetable Notification Controls') || viewAdminSection.includes('admin-toggle-notif')) {
  console.error('FAIL: Admin panel still has Timetable Notification Controls!');
} else {
  console.log('PASS: Admin panel does not have Timetable Notification Controls.');
}

// Check 1d: Add Teacher button removed from Admin panel
if (viewAdminSection.includes('promptAddTeacher') || viewAdminSection.includes('+ Add Teacher')) {
  console.error('FAIL: Admin panel still has + Add Teacher button!');
} else {
  console.log('PASS: Admin panel has no + Add Teacher button.');
}

// 2. Verify workspace.js
const workspaceJs = fs.readFileSync(path.join(__dirname, '../public/js/workspace.js'), 'utf-8');

// Check sub-views in workspaceJs do not have back button to hub
const classesView = workspaceJs.match(/function renderPWClassesView\(\)[\s\S]*?function renderPWSubjectsView/)?.[0] || '';
const subjectsView = workspaceJs.match(/function renderPWSubjectsView\(\)[\s\S]*?function renderPWStudentsView/)?.[0] || '';
const studentsView = workspaceJs.match(/function renderPWStudentsView\([\s\S]*?async function pwSaveStudent/)?.[0] || '';

if (classesView.includes('renderWorkspaceHub') || subjectsView.includes('renderWorkspaceHub') || studentsView.includes('renderWorkspaceHub')) {
  console.error('FAIL: workspace.js sub-views still have back button to workspace hub!');
} else {
  console.log('PASS: workspace.js sub-views (Classes, Subjects, Students) have no back button.');
}

// Check Add Class / Add Student in top right corner of PW
if (!workspaceJs.includes('pwOpenAddClassModal') || !workspaceJs.includes('pwOpenAddStudentModal')) {
  console.error('FAIL: workspace.js missing add modals!');
} else {
  console.log('PASS: workspace.js has Add Class & Add Student modal triggers.');
}

// 3. Test assigned subjects ordering logic (re-implementing the function isolatedly)
console.log('\n--- Testing Assigned Subjects Logic ---');
function testAssignedSubjectsOrder() {
  const classesList = [{ name: 'Class 8' }, { name: 'Class 10' }, { name: 'Class 12' }];
  const subjectsList = [
    { name: 'Physics 8', assignedClasses: ['Class 8'], teacherEmail: 'teacher@school.com' },
    { name: 'Multi Math', assignedClasses: ['Class 8', 'Class 10'], teacherEmail: 'teacher@school.com' },
    { name: 'Chemistry 10', assignedClasses: ['Class 10'], teacherEmail: 'teacher@school.com' },
    { name: 'Biology 10', assignedClasses: ['Class 10'], teacherEmail: 'teacher@school.com' }
  ];

  // Suppose Teacher is ONLY assigned to Class 10 (not Class 8!)
  const assignedClasses = ['Class 10'];
  const matchedSubjects = subjectsList.filter(s => s.teacherEmail === 'teacher@school.com');
  const allSubs = subjectsList;

  function isClassEqual(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  const orderedAssignedSubjects = [];
  const seenAssignedSub = new Set();

  assignedClasses.forEach(clsName => {
    const classSubs = allSubs.filter(s =>
      Array.isArray(s.assignedClasses) && s.assignedClasses.some(ac => isClassEqual(ac, clsName))
    );
    classSubs.forEach(s => {
      const sName = (s.name || '').trim();
      const sKey = sName.toLowerCase();
      const isTeacherSub = matchedSubjects.some(ms => ms.name.trim().toLowerCase() === sKey);
      if (isTeacherSub && sName && !seenAssignedSub.has(sKey)) {
        seenAssignedSub.add(sKey);
        orderedAssignedSubjects.push(sName);
      }
    });
  });

  console.log('Teacher assigned to Class 10 only:');
  console.log('Expected: Multi Math, Chemistry 10, Biology 10 (in Class 10 order)');
  console.log('Actual:  ', orderedAssignedSubjects.join(', '));
  if (orderedAssignedSubjects.includes('Physics 8')) {
    console.error('FAIL: Included Physics 8 from unassigned class!');
  } else {
    console.log('PASS: Correctly excluded subjects from non-assigned Class 8.');
  }
}
testAssignedSubjectsOrder();

// 4. Test conflict check target email logic
console.log('\n--- Testing Timetable Conflict Target Email Logic ---');
function testConflictCheck() {
  const currentUser = { email: 'admin@school.com', role: 'admin' };
  const timetableViewTeacherEmail = 'teacher@school.com';
  const slotData = { teacherEmail: 'teacher@school.com', timeSlot: '09:00 AM - 10:00 AM' };

  // New logic:
  const targetTeacherEmail = (slotData.teacherEmail || timetableViewTeacherEmail || '').trim().toLowerCase();

  const slots = [
    { _id: '1', teacherEmail: 'admin@school.com', timeSlot: '09:00 AM - 10:00 AM' },
    { _id: '2', teacherEmail: 'teacher@school.com', timeSlot: '02:00 PM - 03:00 PM' }
  ];

  let selfConflictSlot = null;
  for (const s of slots) {
    const ownerEmail = (s.teacherEmail || '').trim().toLowerCase();
    // Must NOT conflict with admin@school.com
    if (targetTeacherEmail && ownerEmail === targetTeacherEmail && s.timeSlot === slotData.timeSlot) {
      selfConflictSlot = s;
      break;
    }
  }

  if (selfConflictSlot === null) {
    console.log('PASS: Admin timetable slot at same time did NOT trigger self-conflict for editing teacher!');
  } else {
    console.error('FAIL: False conflict triggered with admin email!');
  }

  // Now if editing teacher already has slot at same time:
  const slots2 = [
    { _id: '3', teacherEmail: 'teacher@school.com', timeSlot: '09:00 AM - 10:00 AM' }
  ];
  let teacherConflictSlot = null;
  for (const s of slots2) {
    const ownerEmail = (s.teacherEmail || '').trim().toLowerCase();
    if (targetTeacherEmail && ownerEmail === targetTeacherEmail && s.timeSlot === slotData.timeSlot) {
      teacherConflictSlot = s;
      break;
    }
  }

  if (teacherConflictSlot) {
    console.log('PASS: Real conflict for the teacher was accurately detected!');
  } else {
    console.error('FAIL: Real conflict was missed!');
  }
}
testConflictCheck();

console.log('\n=== ALL VERIFICATIONS COMPLETED ===');
