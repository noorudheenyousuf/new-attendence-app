const fs = require('fs');
const html = fs.readFileSync('public/index.html','utf8');
const checks = [
  ['workspace.js script tag', html.includes('workspace.js')],
  ['view-workspace section', html.includes('view-workspace')],
  ['pw-modal-class modal', html.includes('pw-modal-class')],
  ['pw-modal-subject modal', html.includes('pw-modal-subject')],
  ['pw-modal-student modal', html.includes('pw-modal-student')],
  ['header-unread-msg-badge', html.includes('header-unread-msg-badge')],
  ['Personal Workspace button', html.includes('Personal Workspace')],
];
checks.forEach(([k,v]) => console.log((v?'OK':'FAIL') + ' ' + k));

const js = fs.readFileSync('public/js/app.js','utf8');
const jsChecks = [
  ['workspace in allViews', js.includes("'workspace'")],
  ['revertPinkTheme call', js.includes('revertPinkTheme')],
  ['public-only student count', js.includes('publicStudents')],
  ['public classes only', js.includes('public classes only')],
  ['header bell badge in checkUnread', js.includes('Update header notification bell badge')],
  ['openMessagesModal badge clear', js.includes('Clear header notification bell badge on opening')],
  ['lock icon in renderClassesList', js.includes('c.isPrivate ? ')],
  ['lock icon in renderStudentsDirectory', js.includes('st.isPrivate')],
  ['lock icon in _generateSubjectCardHtml', js.includes('s.isPrivate')],
];
jsChecks.forEach(([k,v]) => console.log((v?'OK':'FAIL') + ' ' + k));
console.log('Done.');
