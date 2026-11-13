/**
 * apply_multichange.js
 * Applies 4 changes:
 * 1. Remove "Assign Subjects" from main Add/Edit Class modals (HTML + app.js)
 * 2. Remove "Assign Subjects" from PW Class modal + fix PW card display (HTML + workspace.js)
 * 3. PW Subject modal checkboxes -> single dropdown (HTML + workspace.js)
 * 4. ActivityLog model: add performedByEmail field + all log creates + render + filter
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');

function readFile(relPath) {
  const fullPath = path.join(BASE, relPath);
  const content = fs.readFileSync(fullPath, 'utf8');
  return content;
}

function writeFile(relPath, content) {
  const fullPath = path.join(BASE, relPath);
  fs.writeFileSync(fullPath, content, 'utf8');
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
// CHANGE 1 + 2 (HTML): index.html
// ======================================================
console.log('\n=== Patching public/index.html ===');
let html = readFile('public/index.html');

// 1a. Remove "Assigned Subjects" block from Add Class modal
html = applyChange(html, 'Remove add-class-subjects-container block',
  `        <div>\r\n          <label class="block text-xs font-bold text-[var(--text-main)] mb-1 flex items-center justify-between">\r\n            <span>Assigned Subjects</span>\r\n            <span class="text-[10px] text-[var(--text-sub)] font-normal">Check all that apply</span>\r\n          </label>\r\n          <div id="add-class-subjects-container" class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)]">\r\n            <!-- Populated via renderSubjectCheckboxesForClass() -->\r\n          </div>\r\n        </div>\r\n        <button type="submit"`,
  `        <button type="submit"`
);

// 1b. Remove "Assigned Subjects" block from Edit Class modal
html = applyChange(html, 'Remove edit-class-subjects-container block',
  `        <div>\r\n          <label class="block text-xs font-bold text-[var(--text-main)] mb-1 flex items-center justify-between">\r\n            <span>Assigned Subjects</span>\r\n            <span class="text-[10px] text-[var(--text-sub)] font-normal">Check all that apply</span>\r\n          </label>\r\n          <div id="edit-class-subjects-container" class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)]">\r\n            <!-- Populated via renderSubjectCheckboxesForClass() -->\r\n          </div>\r\n        </div>\r\n        <button type="submit"`,
  `        <button type="submit"`
);

// 2a. Remove "Assign Subjects" block from PW Class modal
html = applyChange(html, 'Remove pw-class-subject-checkboxes block',
  `        <div>\r\n          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Assign Subjects <span class="ml-1 font-normal text-pink-400 text-[10px]">(optional)</span></label>\r\n          <div id="pw-class-subject-checkboxes" class="max-h-32 overflow-y-auto rounded-xl border border-pink-200 dark:border-pink-700 bg-pink-50 dark:bg-pink-950/40 p-2 space-y-1">\r\n            <p class="text-[11px] text-pink-400 italic px-1">No private subjects yet — add subjects first.</p>\r\n          </div>\r\n        </div>\r\n        <div class="flex gap-2 pt-1">`,
  `        <div class="flex gap-2 pt-1">`
);

// 3a. Replace PW Subject modal checkboxes with single dropdown
html = applyChange(html, 'Replace pw-subject-class-checkboxes with dropdown',
  `        <div>\r\n          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Assign to Classes <span class="ml-1 font-normal text-pink-400 text-[10px]">(optional)</span></label>\r\n          <div id="pw-subject-class-checkboxes" class="max-h-32 overflow-y-auto rounded-xl border border-pink-200 dark:border-pink-700 bg-pink-50 dark:bg-pink-950/40 p-2 space-y-1">\r\n            <p class="text-[11px] text-pink-400 italic px-1">No private classes yet — add classes first.</p>\r\n          </div>\r\n        </div>`,
  `        <div>\r\n          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Assign to Class <span class="ml-1 font-normal text-pink-400 text-[10px]">(optional)</span></label>\r\n          <select id="pw-subject-class-select" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400">\r\n            <option value="">\u2014 No class (optional) \u2014</option>\r\n          </select>\r\n        </div>`
);

writeFile('public/index.html', html);

// ======================================================
// CHANGE 1 (JS): app.js
// ======================================================
console.log('\n=== Patching public/js/app.js ===');
let appjs = readFile('public/js/app.js');

// 1c. Remove renderSubjectCheckboxesForClass call in openClassModal (add class)
appjs = applyChange(appjs, 'Remove renderSubjectCheckboxesForClass from openClassModal',
  `  renderSubjectCheckboxesForClass('add-class-subjects-container', []);\r\n  document.getElementById('modal-add-class').classList.remove('hidden');`,
  `  document.getElementById('modal-add-class').classList.remove('hidden');`
);

// 1d. Remove renderSubjectCheckboxesForClass call in openEditClassModal
appjs = applyChange(appjs, 'Remove renderSubjectCheckboxesForClass from openEditClassModal',
  `  await populateTeacherDropdowns('edit-class-teacher', cls.classTeacher || '');\r\n  renderSubjectCheckboxesForClass('edit-class-subjects-container', cls.assignedSubjects || []);\r\n\r\n  const modal = document.getElementById('modal-edit-class');`,
  `  await populateTeacherDropdowns('edit-class-teacher', cls.classTeacher || '');\r\n\r\n  const modal = document.getElementById('modal-edit-class');`
);

// 1e. Remove assignedSubjects from handleUpdateClass
appjs = applyChange(appjs, 'Remove assignedSubjects from handleUpdateClass',
  `  const name = document.getElementById('edit-class-name').value.trim();\r\n  const classTeacher = document.getElementById('edit-class-teacher').value.trim();\r\n  const assignedSubjects = getSelectedSubjectCheckboxesForClass('edit-class-subjects-container');\r\n\r\n  try {\r\n    const res = await API.updateClass(activeEditClassId, name, classTeacher, assignedSubjects);`,
  `  const name = document.getElementById('edit-class-name').value.trim();\r\n  const classTeacher = document.getElementById('edit-class-teacher').value.trim();\r\n\r\n  try {\r\n    const res = await API.updateClass(activeEditClassId, name, classTeacher, []);`
);

// 1f. Remove assignedSubjects from handleSaveClass
appjs = applyChange(appjs, 'Remove assignedSubjects from handleSaveClass',
  `  const name = document.getElementById('input-class-name').value.trim();\r\n  const classTeacher = document.getElementById('input-class-teacher').value.trim();\r\n  const assignedSubjects = getSelectedSubjectCheckboxesForClass('add-class-subjects-container');\r\n  try {\r\n    const res = await API.addClass(name, classTeacher, assignedSubjects);`,
  `  const name = document.getElementById('input-class-name').value.trim();\r\n  const classTeacher = document.getElementById('input-class-teacher').value.trim();\r\n  try {\r\n    const res = await API.addClass(name, classTeacher, []);`
);

// CHANGE 4: Activity log render - replace "by ${escapeHtml(log.performedBy || '')}" with live name lookup
// Use string concat to avoid eval in this Node patch script
const OLD_LOG_LINE = '            <div class="text-[9px] text-[#245b70] dark:text-cyan-400 font-semibold mt-0.5">by ' + '${escapeHtml(log.performedBy || ' + "'')}";
const OLD_LOG_LINE_FULL = OLD_LOG_LINE + '</div>';
const NEW_LOG_BLOCK = [
  '            <div class="text-[9px] text-[#245b70] dark:text-cyan-400 font-semibold mt-0.5">' + '${(' + '() => {',
  '              const logEmail = (log.performedByEmail || \'\').toLowerCase();',
  '              let displayName = log.performedBy || \'\';',
  '              if (logEmail) {',
  '                if (currentUser && (currentUser.email || \'\').toLowerCase() === logEmail) {',
  '                  displayName = currentUser.name || displayName;',
  '                } else if (cachedTeachersList) {',
  '                  const found = cachedTeachersList.find(t => (t.email || \'\').toLowerCase() === logEmail);',
  '                  if (found && found.name) displayName = found.name;',
  '                }',
  '              }',
  '              return \'by \' + escapeHtml(displayName);',
  '            })()' + '}</div>',
].join('\r\n');
appjs = applyChange(appjs, 'Activity log live name in renderActivityLogsList',
  OLD_LOG_LINE_FULL,
  NEW_LOG_BLOCK
);

// CHANGE 4: Activity log "mine" filter - add email fallback
appjs = applyChange(appjs, 'Fix mine filter to use email',
  `  if (currentActivityLogFilter === 'mine' && myName) {\r\n    filteredLogs = logs.filter(log => {\r\n      const performed = (log.performedBy || '').trim().toLowerCase();\r\n      const details = (log.details || '').trim().toLowerCase();\r\n      return performed === myName || performed.includes(myName) || details.includes(myName);\r\n    });\r\n  }`,
  `  const myEmail = (currentUser && currentUser.email) ? currentUser.email.trim().toLowerCase() : '';\r\n  if (currentActivityLogFilter === 'mine' && (myName || myEmail)) {\r\n    filteredLogs = logs.filter(log => {\r\n      const logEmail = (log.performedByEmail || '').trim().toLowerCase();\r\n      const performed = (log.performedBy || '').trim().toLowerCase();\r\n      const details = (log.details || '').trim().toLowerCase();\r\n      // Prefer email match for new logs; fall back to name match for old logs\r\n      if (myEmail && logEmail) return logEmail === myEmail;\r\n      return performed === myName || performed.includes(myName) || details.includes(myName);\r\n    });\r\n  }`
);

writeFile('public/js/app.js', appjs);

// ======================================================
// CHANGE 2 + 3 (JS): workspace.js
// ======================================================
console.log('\n=== Patching public/js/workspace.js ===');
let wsjs = readFile('public/js/workspace.js');

// 2b. Fix PW class card - derive subjects from pwSubjectsList dynamically
wsjs = applyChange(wsjs, 'Fix PW class card subjects to derive from pwSubjectsList',
  `            const subs = cls.assignedSubjects || [];`,
  `            const subs = (pwSubjectsList || []).filter(function(s) { return (s.assignedClasses || []).some(function(ac) { return ac === cls.name; }); }).map(function(s) { return s.name; });`
);

// 2c. Remove pwRenderClassSubjectCheckboxes call from pwOpenAddClassModal
wsjs = applyChange(wsjs, 'Remove pwRenderClassSubjectCheckboxes from pwOpenAddClassModal',
  `  document.getElementById('pw-input-class-teacher').value = currentUser ? currentUser.name : '';\r\n  pwRenderClassSubjectCheckboxes([]);\r\n  pwEditClassId = null;`,
  `  document.getElementById('pw-input-class-teacher').value = currentUser ? currentUser.name : '';\r\n  pwEditClassId = null;`
);

// 2d. Remove pwRenderClassSubjectCheckboxes call from pwEditClass
wsjs = applyChange(wsjs, 'Remove pwRenderClassSubjectCheckboxes from pwEditClass',
  `  document.getElementById('pw-input-class-name').value = cls.name;\r\n  document.getElementById('pw-input-class-teacher').value = cls.classTeacher || '';\r\n  pwRenderClassSubjectCheckboxes(cls.assignedSubjects || []);`,
  `  document.getElementById('pw-input-class-name').value = cls.name;\r\n  document.getElementById('pw-input-class-teacher').value = cls.classTeacher || '';`
);

// 2e. Remove assignedSubjects from pwSaveClass
wsjs = applyChange(wsjs, 'Remove assignedSubjects from pwSaveClass',
  `  const name = document.getElementById('pw-input-class-name').value.trim();\r\n  const teacher = document.getElementById('pw-input-class-teacher').value.trim();\r\n  const assignedSubjects = pwGetCheckedSubjects();\r\n  if (!name) return showToast('Class name is required', true);\r\n  try {\r\n    if (pwEditClassId) {\r\n      await API.request(\`/classes/\${pwEditClassId}\`, { method: 'PUT', body: JSON.stringify({ name, classTeacher: teacher, assignedSubjects }) });\r\n      showToast(\`Class "\${name}" updated!\`);\r\n    } else {\r\n      await API.addPrivateClass(name, teacher, assignedSubjects);`,
  `  const name = document.getElementById('pw-input-class-name').value.trim();\r\n  const teacher = document.getElementById('pw-input-class-teacher').value.trim();\r\n  if (!name) return showToast('Class name is required', true);\r\n  try {\r\n    if (pwEditClassId) {\r\n      await API.request(\`/classes/\${pwEditClassId}\`, { method: 'PUT', body: JSON.stringify({ name, classTeacher: teacher }) });\r\n      showToast(\`Class "\${name}" updated!\`);\r\n    } else {\r\n      await API.addPrivateClass(name, teacher, []);`
);

// 3b. Replace pwRenderSubjectClassCheckboxes call in pwOpenAddSubjectModal with dropdown populate
wsjs = applyChange(wsjs, 'Replace pwRenderSubjectClassCheckboxes in pwOpenAddSubjectModal',
  `  document.getElementById('pw-input-subject-teacher').value = currentUser ? currentUser.name : '';\r\n  pwRenderSubjectClassCheckboxes([]);\r\n  pwEditSubjectId = null;`,
  `  document.getElementById('pw-input-subject-teacher').value = currentUser ? currentUser.name : '';\r\n  var selAdd = document.getElementById('pw-subject-class-select');\r\n  if (selAdd) {\r\n    selAdd.innerHTML = '<option value="">\u2014 No class (optional) \u2014</option>';\r\n    (pwClassesList || []).forEach(function(c) {\r\n      var o = document.createElement('option');\r\n      o.value = c.name; o.textContent = c.name;\r\n      selAdd.appendChild(o);\r\n    });\r\n    selAdd.value = '';\r\n  }\r\n  pwEditSubjectId = null;`
);

// 3c. Replace pwRenderSubjectClassCheckboxes call in pwEditSubject with dropdown populate+select
wsjs = applyChange(wsjs, 'Replace pwRenderSubjectClassCheckboxes in pwEditSubject',
  `  document.getElementById('pw-input-subject-name').value = sub.name;\r\n  document.getElementById('pw-input-subject-code').value = sub.subjectCode || '';\r\n  document.getElementById('pw-input-subject-teacher').value = sub.teacher || '';\r\n  pwRenderSubjectClassCheckboxes(sub.assignedClasses || []);`,
  `  document.getElementById('pw-input-subject-name').value = sub.name;\r\n  document.getElementById('pw-input-subject-code').value = sub.subjectCode || '';\r\n  document.getElementById('pw-input-subject-teacher').value = sub.teacher || '';\r\n  var selEdit = document.getElementById('pw-subject-class-select');\r\n  if (selEdit) {\r\n    selEdit.innerHTML = '<option value="">\u2014 No class (optional) \u2014</option>';\r\n    (pwClassesList || []).forEach(function(c) {\r\n      var o = document.createElement('option');\r\n      o.value = c.name; o.textContent = c.name;\r\n      selEdit.appendChild(o);\r\n    });\r\n    selEdit.value = (sub.assignedClasses && sub.assignedClasses[0]) || '';\r\n  }`
);

// 3d. Replace pwGetCheckedClasses() in pwSaveSubject with dropdown read
wsjs = applyChange(wsjs, 'Replace pwGetCheckedClasses in pwSaveSubject with dropdown',
  `  const assignedClasses = pwGetCheckedClasses();`,
  `  var pwSelVal = (document.getElementById('pw-subject-class-select') || {}).value || '';\r\n  const assignedClasses = pwSelVal ? [pwSelVal] : [];`
);

writeFile('public/js/workspace.js', wsjs);

// ======================================================
// CHANGE 4: ActivityLog model - add performedByEmail
// ======================================================
console.log('\n=== Patching server/models/ActivityLog.js ===');
let logModel = readFile('server/models/ActivityLog.js');

logModel = applyChange(logModel, 'Add performedByEmail to ActivityLog schema',
  `  isPrivate: {\r\n    type: Boolean,\r\n    default: false\r\n  },\r\n  ownerEmail: {`,
  `  isPrivate: {\r\n    type: Boolean,\r\n    default: false\r\n  },\r\n  performedByEmail: {\r\n    type: String,\r\n    default: '',\r\n    trim: true,\r\n    lowercase: true\r\n  },\r\n  ownerEmail: {`
);

writeFile('server/models/ActivityLog.js', logModel);

// ======================================================
// CHANGE 4: Add performedByEmail to all ActivityLog.create calls
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
  // Find all ActivityLog.create({ ... }) blocks and add performedByEmail if not present
  // Strategy: insert performedByEmail right after every "performedBy:" line inside ActivityLog.create blocks
  // We use a regex replacement
  content = content.replace(
    /(await ActivityLog\.create\(\{[\s\S]*?)(performedBy:\s*[^,\n]+)(,?\s*\n)([\s\S]*?\}\))/g,
    function(match, pre, perfBy, comma, post) {
      // Check if performedByEmail already exists in this block
      if (match.includes('performedByEmail:')) return match;
      return pre + perfBy + ',\n      performedByEmail: req.user ? (req.user.email || \'\').toLowerCase() : \'\'' + comma + post;
    }
  );
  if (content !== before) {
    writeFile(relPath, content);
  } else {
    console.log('  SKIP (no change): ' + relPath);
  }
}

console.log('\n=== All patches applied! ===');
console.log('Restart the server for ActivityLog model changes to take effect.');
