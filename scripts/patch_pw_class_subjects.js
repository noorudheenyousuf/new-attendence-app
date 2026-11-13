// Patch script: PW Class modal subject checkboxes + redesign cards + PW Subject modal checkboxes
// CRLF-aware version
const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, '../public/index.html');
const WS_FILE  = path.join(__dirname, '../public/js/workspace.js');

function nl(s) { return s.replace(/\n/g, '\r\n'); }

// ─── 1. HTML PATCHES ───────────────────────────────────────────────────────

let html = fs.readFileSync(HTML_FILE, 'utf8');
let htmlChanged = false;

// 1a. Add "Assign Subjects" checkbox section in pw-modal-class (before the button row)
// Target: the closing of the teacher input div + the flex gap-2 pt-1 button row opener
const HTML_TARGET_1A = nl(`        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Class Teacher</label>
          <input type="text" id="pw-input-class-teacher" placeholder="Your name or leave blank" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
        </div>
        <div class="flex gap-2 pt-1">`);

const HTML_REPLACE_1A = nl(`        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Class Teacher</label>
          <input type="text" id="pw-input-class-teacher" placeholder="Your name or leave blank" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
        </div>
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Assign Subjects <span class="ml-1 font-normal text-pink-400 text-[10px]">(optional)</span></label>
          <div id="pw-class-subject-checkboxes" class="max-h-32 overflow-y-auto rounded-xl border border-pink-200 dark:border-pink-700 bg-pink-50 dark:bg-pink-950/40 p-2 space-y-1">
            <p class="text-[11px] text-pink-400 italic px-1">No private subjects yet — add subjects first.</p>
          </div>
        </div>
        <div class="flex gap-2 pt-1">`);

if (html.includes(HTML_TARGET_1A)) {
  html = html.replace(HTML_TARGET_1A, HTML_REPLACE_1A);
  htmlChanged = true;
  console.log('✅ HTML 1a: Added pw-class-subject-checkboxes div in pw-modal-class');
} else {
  console.error('❌ HTML 1a: Could not find target — dumping nearby chars:');
  const idx = html.indexOf('pw-input-class-teacher');
  if (idx > 0) console.log('Found pw-input-class-teacher at', idx, ':', JSON.stringify(html.slice(idx, idx+300)));
}

// 1b. Replace PW Subject modal <select> with checkbox grid
const HTML_TARGET_1B = nl(`        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Assign to Class</label>
          <select id="pw-input-subject-class" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400">
            <option value="">— No class (optional) —</option>
          </select>
        </div>`);

const HTML_REPLACE_1B = nl(`        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Assign to Classes <span class="ml-1 font-normal text-pink-400 text-[10px]">(optional)</span></label>
          <div id="pw-subject-class-checkboxes" class="max-h-32 overflow-y-auto rounded-xl border border-pink-200 dark:border-pink-700 bg-pink-50 dark:bg-pink-950/40 p-2 space-y-1">
            <p class="text-[11px] text-pink-400 italic px-1">No private classes yet — add classes first.</p>
          </div>
        </div>`);

if (html.includes(HTML_TARGET_1B)) {
  html = html.replace(HTML_TARGET_1B, HTML_REPLACE_1B);
  htmlChanged = true;
  console.log('✅ HTML 1b: Replaced PW subject class <select> with checkbox div');
} else {
  console.log('⚠️  HTML 1b: PW subject <select> not found — checking if already converted...');
  if (html.includes('pw-subject-class-checkboxes')) {
    console.log('   ✅ pw-subject-class-checkboxes already exists in HTML');
  } else {
    console.error('   ❌ pw-subject-class-checkboxes also missing from HTML');
  }
}

fs.writeFileSync(HTML_FILE, html, 'utf8');
console.log('✅ HTML file saved\n');

// ─── 2. WORKSPACE.JS PATCHES ───────────────────────────────────────────────

let ws = fs.readFileSync(WS_FILE, 'utf8');

// 2a. Redesign class cards
// Find the class cards map section precisely
const OLD_CARDS_START = nl(`          : pwClassesList.map(cls => \`
            <div class="bg-white/80 dark:bg-pink-950/30 rounded-2xl p-3.5 border border-pink-200 dark:border-pink-800 shadow-sm flex items-center justify-between gap-2">`);

if (ws.includes(OLD_CARDS_START)) {
  // Find the full block to replace (from map start to .join(''))
  const mapStart = ws.indexOf(OLD_CARDS_START);
  const joinEnd = ws.indexOf(`.join('')}`, mapStart) + `.join('')}`.length;
  const oldBlock = ws.slice(mapStart, joinEnd);
  
  const NEW_CARDS = nl(`          : pwClassesList.map(cls => {
            const subs = cls.assignedSubjects || [];
            return \`
            <div class="bg-white dark:bg-[#2d1020] rounded-2xl border border-pink-300 dark:border-pink-800 shadow-md overflow-hidden">
              <!-- Dark gradient header -->
              <div class="bg-gradient-to-r from-pink-700 via-rose-600 to-pink-500 p-3 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  \${lockSVG('14')}
                  <div class="min-w-0">
                    <div class="text-sm font-black text-white truncate">\${escapeHtml(cls.name)}</div>
                    <div class="text-[10px] text-pink-100 opacity-90">👩‍🏫 \${escapeHtml(cls.classTeacher || 'No Teacher Assigned')}</div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button onclick="pwEditClass('\${cls._id}')" class="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center active:scale-95 transition" title="Edit">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button onclick="pwDeleteClass('\${cls._id}','\${escapeQuotes(cls.name)}')" class="w-7 h-7 rounded-lg bg-white/20 hover:bg-red-400/40 text-white flex items-center justify-center active:scale-95 transition" title="Delete">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
                  </button>
                </div>
              </div>
              <!-- Body: subject pills -->
              <div class="p-3 space-y-2 bg-gradient-to-b from-pink-50 to-white dark:from-pink-950/20 dark:to-[#2d1020]">
                <div class="text-[9px] font-black uppercase tracking-widest text-pink-500 dark:text-pink-400">📚 Assigned Subjects</div>
                <div class="flex flex-wrap gap-1.5">
                  \${subs.length > 0
                    ? subs.map(sub => \`<span class="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-700 text-[10px] font-bold shadow-xs">\${escapeHtml(sub)}</span>\`).join('')
                    : \`<span class="text-[10px] text-pink-300 dark:text-pink-600 italic">No subjects assigned yet</span>\`}
                </div>
              </div>
            </div>\`;
          }).join('')}`);

  ws = ws.slice(0, mapStart) + NEW_CARDS + ws.slice(joinEnd);
  console.log('✅ WS 2a: Redesigned PW class cards with dark header + subject badges');
} else {
  console.error('❌ WS 2a: Could not find old class card map start');
  const idx = ws.indexOf('pwClassesList.map');
  if (idx > 0) console.log('Found pwClassesList.map at', idx, ':', JSON.stringify(ws.slice(idx, idx+100)));
}

// 2b. Add PW CLASS SUBJECT helpers before CLASS CRUD section
const CLASS_CRUD_MARKER = nl(`// ================================================================\r\n// CLASS CRUD\r\n// ================================================================`);

// Try a simpler approach: search for the line
const classCrudIdx = ws.indexOf('// CLASS CRUD');
if (classCrudIdx < 0) {
  console.error('❌ WS 2b: // CLASS CRUD not found in workspace.js');
} else {
  // Find the full comment block: go back to find the ======== line
  const blockStart = ws.lastIndexOf('//', classCrudIdx - 5);
  // Actually find the start of the ===... line before // CLASS CRUD
  const lineBeforeIdx = ws.lastIndexOf('\r\n', classCrudIdx) + 2;
  const eqLineStart = ws.lastIndexOf('\r\n', lineBeforeIdx - 2) + 2;
  
  // Find end of the comment block (3rd line ending after CLASS CRUD)
  let endSearch = classCrudIdx;
  for (let i = 0; i < 2; i++) {
    endSearch = ws.indexOf('\r\n', endSearch) + 2;
  }
  
  const markerBlock = ws.slice(eqLineStart, endSearch);
  console.log('Marker block found:', JSON.stringify(markerBlock));
  
  const NEW_HELPERS_BLOCK = nl(`// ================================================================
// PW CLASS SUBJECT CHECKBOX HELPERS
// ================================================================
function pwRenderClassSubjectCheckboxes(selectedSubjects) {
  selectedSubjects = selectedSubjects || [];
  const container = document.getElementById('pw-class-subject-checkboxes');
  if (!container) return;
  if (!pwSubjectsList || pwSubjectsList.length === 0) {
    container.innerHTML = '<p class="text-[11px] text-pink-400 italic px-1">No private subjects yet — add subjects first.</p>';
    return;
  }
  const unique = [];
  const seen = new Set();
  pwSubjectsList.forEach(function(s) {
    var n = s.name.trim().toLowerCase();
    if (!seen.has(n)) { seen.add(n); unique.push(s); }
  });
  container.innerHTML = unique.map(function(s) {
    var checked = selectedSubjects.some(function(x) { return x.toLowerCase() === s.name.toLowerCase(); }) ? 'checked' : '';
    var uid = 'pw-sub-chk-' + s._id;
    return '<label for="' + uid + '" class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-pink-100 dark:hover:bg-pink-900/30 transition select-none">'
      + '<input type="checkbox" id="' + uid + '" name="pw-sub-chk" value="' + escapeHtml(s.name) + '" ' + checked + ' class="w-4 h-4 rounded accent-pink-500 cursor-pointer flex-shrink-0">'
      + '<span class="text-xs font-bold text-pink-800 dark:text-pink-200 truncate">' + escapeHtml(s.name) + '</span>'
      + '</label>';
  }).join('');
}

function pwGetCheckedSubjects() {
  var checked = document.querySelectorAll('#pw-class-subject-checkboxes input[name="pw-sub-chk"]:checked');
  return Array.from(checked).map(function(el) { return el.value; });
}

`) + markerBlock;

  ws = ws.slice(0, eqLineStart) + NEW_HELPERS_BLOCK + ws.slice(endSearch);
  console.log('✅ WS 2b: Inserted pwRenderClassSubjectCheckboxes + pwGetCheckedSubjects');
}

// Re-read after modifications for further patches
// 2c. Update pwOpenAddClassModal
const OLD_OPEN_ADD = `function pwOpenAddClassModal() {\r\n  document.getElementById('pw-modal-class').classList.remove('hidden');\r\n  document.getElementById('pw-class-modal-title').textContent = 'Add Private Class';\r\n  document.getElementById('pw-input-class-name').value = '';\r\n  document.getElementById('pw-input-class-teacher').value = currentUser ? currentUser.name : '';\r\n  pwEditClassId = null;\r\n}`;

const NEW_OPEN_ADD = `function pwOpenAddClassModal() {\r\n  document.getElementById('pw-modal-class').classList.remove('hidden');\r\n  document.getElementById('pw-class-modal-title').textContent = 'Add Private Class';\r\n  document.getElementById('pw-input-class-name').value = '';\r\n  document.getElementById('pw-input-class-teacher').value = currentUser ? currentUser.name : '';\r\n  pwRenderClassSubjectCheckboxes([]);\r\n  pwEditClassId = null;\r\n}`;

if (ws.includes(OLD_OPEN_ADD)) {
  ws = ws.replace(OLD_OPEN_ADD, NEW_OPEN_ADD);
  console.log('✅ WS 2c: Updated pwOpenAddClassModal');
} else {
  console.error('❌ WS 2c: pwOpenAddClassModal not found');
  const idx = ws.indexOf('pwOpenAddClassModal() {');
  if (idx > 0) console.log('Context:', JSON.stringify(ws.slice(idx, idx+300)));
}

// 2d. Update pwEditClass
const OLD_EDIT_CLS = `function pwEditClass(id) {\r\n  const cls = pwClassesList.find(c => c._id === id);\r\n  if (!cls) return;\r\n  pwEditClassId = id;\r\n  document.getElementById('pw-modal-class').classList.remove('hidden');\r\n  document.getElementById('pw-class-modal-title').textContent = 'Edit Private Class';\r\n  document.getElementById('pw-input-class-name').value = cls.name;\r\n  document.getElementById('pw-input-class-teacher').value = cls.classTeacher || '';\r\n}`;

const NEW_EDIT_CLS = `function pwEditClass(id) {\r\n  const cls = pwClassesList.find(c => c._id === id);\r\n  if (!cls) return;\r\n  pwEditClassId = id;\r\n  document.getElementById('pw-modal-class').classList.remove('hidden');\r\n  document.getElementById('pw-class-modal-title').textContent = 'Edit Private Class';\r\n  document.getElementById('pw-input-class-name').value = cls.name;\r\n  document.getElementById('pw-input-class-teacher').value = cls.classTeacher || '';\r\n  pwRenderClassSubjectCheckboxes(cls.assignedSubjects || []);\r\n}`;

if (ws.includes(OLD_EDIT_CLS)) {
  ws = ws.replace(OLD_EDIT_CLS, NEW_EDIT_CLS);
  console.log('✅ WS 2d: Updated pwEditClass');
} else {
  console.error('❌ WS 2d: pwEditClass not found');
}

// 2e. Update pwSaveClass
const OLD_SAVE_CLS = `  const teacher = document.getElementById('pw-input-class-teacher').value.trim();\r\n  if (!name) return showToast('Class name is required', true);`;
const NEW_SAVE_CLS = `  const teacher = document.getElementById('pw-input-class-teacher').value.trim();\r\n  const assignedSubjects = pwGetCheckedSubjects();\r\n  if (!name) return showToast('Class name is required', true);`;

if (ws.includes(OLD_SAVE_CLS)) {
  ws = ws.replace(OLD_SAVE_CLS, NEW_SAVE_CLS);
  console.log('✅ WS 2e-1: Added assignedSubjects read in pwSaveClass');
} else {
  console.error('❌ WS 2e-1: teacher + if(!name) block not found in pwSaveClass');
}

// Also update the PUT and POST calls to include assignedSubjects
const OLD_PUT_CLASS = `JSON.stringify({ name, classTeacher: teacher })`;
const NEW_PUT_CLASS = `JSON.stringify({ name, classTeacher: teacher, assignedSubjects })`;

if (ws.includes(OLD_PUT_CLASS)) {
  ws = ws.replace(OLD_PUT_CLASS, NEW_PUT_CLASS);
  console.log('✅ WS 2e-2: Updated PUT call in pwSaveClass');
} else {
  console.error('❌ WS 2e-2: PUT JSON.stringify not found');
}

const OLD_ADD_PRIVATE = `await API.addPrivateClass(name, teacher);`;
const NEW_ADD_PRIVATE = `await API.addPrivateClass(name, teacher, assignedSubjects);`;

if (ws.includes(OLD_ADD_PRIVATE)) {
  ws = ws.replace(OLD_ADD_PRIVATE, NEW_ADD_PRIVATE);
  console.log('✅ WS 2e-3: Updated addPrivateClass call with assignedSubjects');
} else {
  console.error('❌ WS 2e-3: API.addPrivateClass call not found');
}

// 2i. Add PW SUBJECT CLASS helpers before SUBJECT CRUD section
const subjectCrudIdx = ws.indexOf('// SUBJECT CRUD');
if (subjectCrudIdx < 0) {
  console.error('❌ WS 2i: // SUBJECT CRUD not found');
} else {
  const eqLineStart2 = ws.lastIndexOf('\r\n', ws.lastIndexOf('\r\n', subjectCrudIdx) - 1) + 2;
  let endSearch2 = subjectCrudIdx;
  for (let i = 0; i < 2; i++) {
    endSearch2 = ws.indexOf('\r\n', endSearch2) + 2;
  }
  const markerBlock2 = ws.slice(eqLineStart2, endSearch2);
  
  const PW_SUBJ_CLASS_HELPERS = nl(`// ================================================================
// PW SUBJECT CLASS CHECKBOX HELPERS
// ================================================================
function pwRenderSubjectClassCheckboxes(selectedClasses) {
  selectedClasses = selectedClasses || [];
  const container = document.getElementById('pw-subject-class-checkboxes');
  if (!container) return;
  if (!pwClassesList || pwClassesList.length === 0) {
    container.innerHTML = '<p class="text-[11px] text-pink-400 italic px-1">No private classes yet — add classes first.</p>';
    return;
  }
  container.innerHTML = pwClassesList.map(function(c) {
    var checked = selectedClasses.some(function(x) { return x === c.name; }) ? 'checked' : '';
    var uid = 'pw-cls-chk-' + c._id;
    return '<label for="' + uid + '" class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-pink-100 dark:hover:bg-pink-900/30 transition select-none">'
      + '<input type="checkbox" id="' + uid + '" name="pw-cls-chk" value="' + escapeHtml(c.name) + '" ' + checked + ' class="w-4 h-4 rounded accent-pink-500 cursor-pointer flex-shrink-0">'
      + '<span class="text-xs font-bold text-pink-800 dark:text-pink-200 truncate">' + escapeHtml(c.name) + '</span>'
      + '</label>';
  }).join('');
}

function pwGetCheckedClasses() {
  var checked = document.querySelectorAll('#pw-subject-class-checkboxes input[name="pw-cls-chk"]:checked');
  return Array.from(checked).map(function(el) { return el.value; });
}

`) + markerBlock2;

  ws = ws.slice(0, eqLineStart2) + PW_SUBJ_CLASS_HELPERS + ws.slice(endSearch2);
  console.log('✅ WS 2i: Inserted pwRenderSubjectClassCheckboxes + pwGetCheckedClasses');
}

// 2f. Update pwOpenAddSubjectModal to use checkboxes
const OLD_OPEN_SUB = `  // Populate class dropdown\r\n  const sel = document.getElementById('pw-input-subject-class');\r\n  sel.innerHTML = \`<option value="">— No class —</option>\` + pwClassesList.map(c => \`<option value="\${escapeHtml(c.name)}">\${escapeHtml(c.name)}</option>\`).join('');\r\n  pwEditSubjectId = null;`;

const NEW_OPEN_SUB = `  pwRenderSubjectClassCheckboxes([]);\r\n  pwEditSubjectId = null;`;

if (ws.includes(OLD_OPEN_SUB)) {
  ws = ws.replace(OLD_OPEN_SUB, NEW_OPEN_SUB);
  console.log('✅ WS 2f: Updated pwOpenAddSubjectModal to use checkboxes');
} else {
  console.error('❌ WS 2f: pwOpenAddSubjectModal class dropdown block not found');
  const idx = ws.indexOf('Populate class dropdown');
  if (idx > 0) console.log('Context:', JSON.stringify(ws.slice(idx-5, idx+300)));
}

// 2g. Update pwEditSubject to use checkboxes
const OLD_EDIT_SUB_SEL = `  const sel = document.getElementById('pw-input-subject-class');\r\n  sel.innerHTML = \`<option value="">— No class —</option>\` + pwClassesList.map(c => \`<option value="\${escapeHtml(c.name)}" \${(sub.assignedClasses||[]).includes(c.name) ? 'selected' : ''}>\${escapeHtml(c.name)}</option>\`).join('');\r\n}`;

const NEW_EDIT_SUB_CHK = `  pwRenderSubjectClassCheckboxes(sub.assignedClasses || []);\r\n}`;

if (ws.includes(OLD_EDIT_SUB_SEL)) {
  ws = ws.replace(OLD_EDIT_SUB_SEL, NEW_EDIT_SUB_CHK);
  console.log('✅ WS 2g: Updated pwEditSubject to use checkboxes');
} else {
  console.error('❌ WS 2g: pwEditSubject select block not found');
  const idx = ws.indexOf('pwEditSubject(id)');
  if (idx > 0) console.log('Context:', JSON.stringify(ws.slice(idx, idx+400)));
}

// 2h. Update pwSaveSubject to read from checkboxes
const OLD_SAVE_SUB = `  const cls = document.getElementById('pw-input-subject-class').value;\r\n  if (!name) return showToast('Subject name is required', true);\r\n  const data = { name, subjectCode: code, teacher, assignedClasses: cls ? [cls] : [] };`;

const NEW_SAVE_SUB = `  const assignedClasses = pwGetCheckedClasses();\r\n  if (!name) return showToast('Subject name is required', true);\r\n  const data = { name, subjectCode: code, teacher, assignedClasses };`;

if (ws.includes(OLD_SAVE_SUB)) {
  ws = ws.replace(OLD_SAVE_SUB, NEW_SAVE_SUB);
  console.log('✅ WS 2h: Updated pwSaveSubject to read from checkboxes');
} else {
  console.error('❌ WS 2h: pwSaveSubject class reading not found');
  const idx = ws.indexOf('pwSaveSubject');
  if (idx > 0) console.log('Context:', JSON.stringify(ws.slice(idx, idx+400)));
}

fs.writeFileSync(WS_FILE, ws, 'utf8');
console.log('\n✅ workspace.js saved!');
console.log('\n🎉 All patches done!');
