const fs = require('fs');
const html = fs.readFileSync('public/index.html','utf8');
const js = fs.readFileSync('public/js/app.js','utf8');
const checks = [
  ['Add modal has class checkbox container', html.includes('add-sub-class-checkboxes')],
  ['Edit modal has class checkbox container', html.includes('edit-sub-class-checkboxes')],
  ['openSubjectModal renders checkboxes', js.includes("renderTeacherClassCheckboxes('add-sub-class-checkboxes'")],
  ['handleSaveSubject reads assignedClasses', js.includes("getSelectedTeacherCheckboxes('add-sub-class-checkboxes')")],
  ['openEditSubjectModal renders checkboxes', js.includes("renderTeacherClassCheckboxes('edit-sub-class-checkboxes'")],
  ['handleUpdateSubject reads assignedClasses', js.includes("getSelectedTeacherCheckboxes('edit-sub-class-checkboxes')")],
];
checks.forEach(([k,v]) => console.log((v?'OK':'FAIL') + ' ' + k));
