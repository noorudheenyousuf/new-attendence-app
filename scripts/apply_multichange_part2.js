/**
 * apply_multichange_part2.js
 * Applies remaining patches:
 * - workspace.js (Change 2 + 3)
 * - ActivityLog.js model (Change 4)
 * - Route files: add performedByEmail to ActivityLog.create calls
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(BASE, relPath), 'utf8');
}

function writeFile(relPath, content) {
  fs.writeFileSync(path.join(BASE, relPath), content, 'utf8');
  console.log('  Written: ' + relPath);
}

function applyChange(content, description, oldStr, newStr) {
  if (!content.includes(oldStr)) {
    console.error('  MISS [' + description + ']: pattern not found!');
    return content;
  }
  const result = content.split(oldStr).join(newStr);
  console.log('  OK   [' + description + ']');
  return result;
}

// ======================================================
// CHANGE 2 + 3 (JS): workspace.js
// ======================================================
console.log('\n=== Patching public/js/workspace.js ===');
let wsjs = readFile('public/js/workspace.js');

// 2b. Fix PW class card - derive subjects from pwSubjectsList dynamically
wsjs = applyChange(wsjs, 'Fix PW class card subjects to derive from pwSubjectsList',
  "            const subs = cls.assignedSubjects || [];",
  "            const subs = (pwSubjectsList || []).filter(function(s) { return (s.assignedClasses || []).some(function(ac) { return ac === cls.name; }); }).map(function(s) { return s.name; });"
);

// 2c. Remove pwRenderClassSubjectCheckboxes call from pwOpenAddClassModal
wsjs = applyChange(wsjs, 'Remove pwRenderClassSubjectCheckboxes from pwOpenAddClassModal',
  "  document.getElementById('pw-input-class-teacher').value = currentUser ? currentUser.name : '';\r\n  pwRenderClassSubjectCheckboxes([]);\r\n  pwEditClassId = null;",
  "  document.getElementById('pw-input-class-teacher').value = currentUser ? currentUser.name : '';\r\n  pwEditClassId = null;"
);

// 2d. Remove pwRenderClassSubjectCheckboxes call from pwEditClass
wsjs = applyChange(wsjs, 'Remove pwRenderClassSubjectCheckboxes from pwEditClass',
  "  document.getElementById('pw-input-class-name').value = cls.name;\r\n  document.getElementById('pw-input-class-teacher').value = cls.classTeacher || '';\r\n  pwRenderClassSubjectCheckboxes(cls.assignedSubjects || []);",
  "  document.getElementById('pw-input-class-name').value = cls.name;\r\n  document.getElementById('pw-input-class-teacher').value = cls.classTeacher || '';"
);

// 2e. Remove assignedSubjects from pwSaveClass
wsjs = applyChange(wsjs, 'Remove assignedSubjects from pwSaveClass',
  "  const name = document.getElementById('pw-input-class-name').value.trim();\r\n  const teacher = document.getElementById('pw-input-class-teacher').value.trim();\r\n  const assignedSubjects = pwGetCheckedSubjects();\r\n  if (!name) return showToast('Class name is required', true);\r\n  try {\r\n    if (pwEditClassId) {\r\n      await API.request(`/classes/${pwEditClassId}`, { method: 'PUT', body: JSON.stringify({ name, classTeacher: teacher, assignedSubjects }) });\r\n      showToast(`Class \"${name}\" updated!`);\r\n    } else {\r\n      await API.addPrivateClass(name, teacher, assignedSubjects);",
  "  const name = document.getElementById('pw-input-class-name').value.trim();\r\n  const teacher = document.getElementById('pw-input-class-teacher').value.trim();\r\n  if (!name) return showToast('Class name is required', true);\r\n  try {\r\n    if (pwEditClassId) {\r\n      await API.request(`/classes/${pwEditClassId}`, { method: 'PUT', body: JSON.stringify({ name, classTeacher: teacher }) });\r\n      showToast(`Class \"${name}\" updated!`);\r\n    } else {\r\n      await API.addPrivateClass(name, teacher, []);"
);

// 3b. Replace pwRenderSubjectClassCheckboxes call in pwOpenAddSubjectModal with dropdown populate
wsjs = applyChange(wsjs, 'Replace pwRenderSubjectClassCheckboxes in pwOpenAddSubjectModal',
  "  document.getElementById('pw-input-subject-teacher').value = currentUser ? currentUser.name : '';\r\n  pwRenderSubjectClassCheckboxes([]);\r\n  pwEditSubjectId = null;",
  "  document.getElementById('pw-input-subject-teacher').value = currentUser ? currentUser.name : '';\r\n  var selAdd = document.getElementById('pw-subject-class-select');\r\n  if (selAdd) {\r\n    selAdd.innerHTML = '<option value=\"\">\u2014 No class (optional) \u2014</option>';\r\n    (pwClassesList || []).forEach(function(c) { var o = document.createElement('option'); o.value = c.name; o.textContent = c.name; selAdd.appendChild(o); });\r\n    selAdd.value = '';\r\n  }\r\n  pwEditSubjectId = null;"
);

// 3c. Replace pwRenderSubjectClassCheckboxes call in pwEditSubject with dropdown populate+select
wsjs = applyChange(wsjs, 'Replace pwRenderSubjectClassCheckboxes in pwEditSubject',
  "  document.getElementById('pw-input-subject-name').value = sub.name;\r\n  document.getElementById('pw-input-subject-code').value = sub.subjectCode || '';\r\n  document.getElementById('pw-input-subject-teacher').value = sub.teacher || '';\r\n  pwRenderSubjectClassCheckboxes(sub.assignedClasses || []);",
  "  document.getElementById('pw-input-subject-name').value = sub.name;\r\n  document.getElementById('pw-input-subject-code').value = sub.subjectCode || '';\r\n  document.getElementById('pw-input-subject-teacher').value = sub.teacher || '';\r\n  var selEdit = document.getElementById('pw-subject-class-select');\r\n  if (selEdit) {\r\n    selEdit.innerHTML = '<option value=\"\">\u2014 No class (optional) \u2014</option>';\r\n    (pwClassesList || []).forEach(function(c) { var o = document.createElement('option'); o.value = c.name; o.textContent = c.name; selEdit.appendChild(o); });\r\n    selEdit.value = (sub.assignedClasses && sub.assignedClasses[0]) || '';\r\n  }"
);

// 3d. Replace pwGetCheckedClasses() in pwSaveSubject with dropdown read
wsjs = applyChange(wsjs, 'Replace pwGetCheckedClasses in pwSaveSubject with dropdown',
  "  const assignedClasses = pwGetCheckedClasses();",
  "  var pwSelVal = (document.getElementById('pw-subject-class-select') || {}).value || '';\r\n  const assignedClasses = pwSelVal ? [pwSelVal] : [];"
);

writeFile('public/js/workspace.js', wsjs);

// ======================================================
// CHANGE 4: ActivityLog model - add performedByEmail
// ======================================================
console.log('\n=== Patching server/models/ActivityLog.js ===');
let logModel = readFile('server/models/ActivityLog.js');

logModel = applyChange(logModel, 'Add performedByEmail to ActivityLog schema',
  "  isPrivate: {\r\n    type: Boolean,\r\n    default: false\r\n  },\r\n  ownerEmail: {",
  "  isPrivate: {\r\n    type: Boolean,\r\n    default: false\r\n  },\r\n  performedByEmail: {\r\n    type: String,\r\n    default: '',\r\n    trim: true,\r\n    lowercase: true\r\n  },\r\n  ownerEmail: {"
);

writeFile('server/models/ActivityLog.js', logModel);

// ======================================================
// CHANGE 4: Add performedByEmail to all ActivityLog.create calls in routes
// ======================================================
const routeFiles = [
  'server/routes/adminRoutes.js',
  'server/routes/attendanceRoutes.js',
  'server/routes/authRoutes.js',
  'server/routes/backupRoutes.js',
  'server/routes/classRoutes.js',
  'server/routes/studentRoutes.js',
  'server/routes/subjectRoutes.js',
  'server/routes/teacherRoutes.js',
];

console.log('\n=== Patching route files for performedByEmail ===');
for (const relPath of routeFiles) {
  let content = readFile(relPath);
  const before = content;

  // Insert performedByEmail after each "performedBy:" line inside ActivityLog.create blocks
  // Using a line-by-line approach for safety
  const lines = content.split('\n');
  const out = [];
  let inCreate = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);

    // Track if we just entered an ActivityLog.create({ block
    if (line.includes('ActivityLog.create(') || line.includes('ActivityLog.create({')) {
      inCreate = true;
      braceDepth = 0;
    }

    if (inCreate) {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      braceDepth += opens - closes;
      if (braceDepth <= 0 && line.trim() !== 'ActivityLog.create({') {
        inCreate = false;
      }
    }

    // If we're inside a create block and this is the performedBy line, insert email after
    if (inCreate && /performedBy\s*:/.test(line) && !line.includes('performedByEmail')) {
      // Check next line isn't already performedByEmail
      const nextLine = lines[i + 1] || '';
      if (!nextLine.includes('performedByEmail')) {
        // Match indentation
        const indent = line.match(/^(\s*)/)[1];
        const emailLine = indent + "performedByEmail: req.user ? (req.user.email || '').toLowerCase() : '',";
        out.push(emailLine);
      }
    }
  }

  content = out.join('\n');

  if (content !== before) {
    writeFile(relPath, content);
  } else {
    console.log('  SKIP (no change): ' + relPath);
  }
}

console.log('\n=== Part 2 patches complete! ===');
