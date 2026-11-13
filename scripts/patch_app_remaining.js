// Fix remaining 3 app.js patches using exact strings from debug output
const fs = require('fs');
const path = require('path');
const APP_FILE = path.join(__dirname, '../public/js/app.js');
let app = fs.readFileSync(APP_FILE, 'utf8');

// ── 2a: openSubjectModal — replace renderTeacherClassCheckboxes call
const OLD_2A = "  // Render class checkboxes — public (main) classes only\r\n  renderTeacherClassCheckboxes('add-sub-class-checkboxes', []);\r\n  document.getElementById('modal-add-subject').classList.remove('hidden');";
const NEW_2A = "  // Populate class dropdown — public (main) classes only, one class per entry\r\n  const _addSubSel = document.getElementById('add-sub-class-select');\r\n  if (_addSubSel) {\r\n    _addSubSel.innerHTML = '<option value=\"\">\u2014 No class (optional) \u2014</option>'\r\n      + (classesList || []).filter(function(c) { return !c.isPrivate; })\r\n          .map(function(c) { return '<option value=\"' + escapeHtml(c.name) + '\">' + escapeHtml(c.name) + '</option>'; }).join('');\r\n  }\r\n  document.getElementById('modal-add-subject').classList.remove('hidden');";

if (app.includes(OLD_2A)) {
  app = app.replace(OLD_2A, NEW_2A);
  console.log('✅ APP 2a: openSubjectModal dropdown');
} else {
  console.error('❌ APP 2a still failed');
}

// ── 2c: openEditSubjectModal — replace sibling block
const OLD_2C = "  // Pre-check ALL classes this subject family is currently assigned to.\r\n  // A subject named \"Maths\" may exist as multiple sibling docs (one per class).\r\n  // We collect assignedClasses from ALL sibling docs with the same name.\r\n  const siblingClasses = (subjectsList || [])\r\n    .filter(s => s.name.trim().toLowerCase() === name.trim().toLowerCase() && !s.isPrivate)\r\n    .flatMap(s => s.assignedClasses || []);\r\n  renderTeacherClassCheckboxes('edit-sub-class-checkboxes', siblingClasses);";
const NEW_2C = "  // Find this exact subject doc and pre-select its single assigned class\r\n  const _editSubDoc = (subjectsList || []).find(function(s) { return String(s._id) === String(id); });\r\n  const _editCurClass = (_editSubDoc && _editSubDoc.assignedClasses && _editSubDoc.assignedClasses[0]) || '';\r\n  const _editSubSel = document.getElementById('edit-sub-class-select');\r\n  if (_editSubSel) {\r\n    _editSubSel.innerHTML = '<option value=\"\">\u2014 No class \u2014</option>'\r\n      + (classesList || []).filter(function(c) { return !c.isPrivate; })\r\n          .map(function(c) { return '<option value=\"' + escapeHtml(c.name) + '\"' + (c.name === _editCurClass ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>'; }).join('');\r\n  }";

if (app.includes(OLD_2C)) {
  app = app.replace(OLD_2C, NEW_2C);
  console.log('✅ APP 2c: openEditSubjectModal dropdown');
} else {
  console.error('❌ APP 2c still failed');
  // Try trimming comment lines
  const idx = app.indexOf('siblingClasses');
  if (idx > 0) console.log('Context:', JSON.stringify(app.slice(idx-200, idx+10)));
}

// ── 2e: renderSubjectsList filter — fix duplicate bug
const OLD_2E = "    const classSubs = subjectsList.filter(s => {\r\n      const inAssignedClasses = Array.isArray(s.assignedClasses) && s.assignedClasses.some(ac => isClassEqual(ac, clsName));\r\n      const inClassSubjects = Array.isArray(cls.assignedSubjects) && cls.assignedSubjects.some(as => isClassEqual(as, s.name));\r\n      return inAssignedClasses || inClassSubjects;\r\n    });";
const NEW_2E = "    const classSubs = subjectsList.filter(s =>\r\n      Array.isArray(s.assignedClasses) && s.assignedClasses.some(ac => isClassEqual(ac, clsName))\r\n    );";

if (app.includes(OLD_2E)) {
  app = app.replace(OLD_2E, NEW_2E);
  console.log('✅ APP 2e: renderSubjectsList filter (Condition A only)');
} else {
  console.error('❌ APP 2e still failed');
  const idx3 = app.indexOf('inAssignedClasses');
  if (idx3 > 0) console.log('Context:', JSON.stringify(app.slice(idx3-50, idx3+280)));
}

fs.writeFileSync(APP_FILE, app, 'utf8');
console.log('✅ app.js saved');

// Verify
const final = fs.readFileSync(APP_FILE, 'utf8');
console.log('\n--- Verification ---');
console.log('add-sub-class-select referenced:', final.includes('add-sub-class-select') ? '✅' : '❌');
console.log('edit-sub-class-select referenced:', final.includes('edit-sub-class-select') ? '✅' : '❌');
console.log('siblingClasses still present:', final.includes('siblingClasses') ? '❌ YES' : '✅ REMOVED');
console.log('inAssignedClasses still present:', final.includes('inAssignedClasses') ? '❌ YES' : '✅ REMOVED');
console.log('old checkbox reads removed:', !final.includes("getSelectedTeacherCheckboxes('add-sub-class-checkboxes')") && !final.includes("getSelectedTeacherCheckboxes('edit-sub-class-checkboxes')") ? '✅' : '❌ STILL PRESENT');
