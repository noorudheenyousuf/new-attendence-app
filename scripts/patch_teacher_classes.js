// Patch teacher cards and edit/delete fix - using string concatenation to avoid template literal issues
const fs = require('fs');
const path = require('path');
const APP_JS = path.join(__dirname, '../public/js/app.js');

let js = fs.readFileSync(APP_JS, 'utf8');
const hasCRLF = js.includes('\r\n');
function nl(s) { return hasCRLF ? s.replace(/\n/g, '\r\n') : s; }

// ─── PATCH 1b: Add classesPills variable ─────────────────────────────────────
const OLD_SUBJ = nl("      const subjectsPills = (t.assignedSubjects && t.assignedSubjects.length > 0)\n"
  + "        ? t.assignedSubjects.map(s => `<span class=\"px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold text-xs shadow-sm\">${escapeHtml(s)}</span>`).join(' ')\n"
  + "        : `<span class=\"text-xs text-[var(--text-sub)] italic\">None assigned</span>`;");

const NEW_SUBJ = nl("      const subjectsPills = (t.assignedSubjects && t.assignedSubjects.length > 0)\n"
  + "        ? t.assignedSubjects.map(s => `<span class=\"px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold text-xs shadow-sm\">${escapeHtml(s)}</span>`).join(' ')\n"
  + "        : `<span class=\"text-xs text-[var(--text-sub)] italic\">None assigned</span>`;\n"
  + "\n"
  + "      const classesPills = (t.assignedClasses && t.assignedClasses.length > 0)\n"
  + "        ? t.assignedClasses.map(c => `<span class=\"px-2 py-0.5 rounded-lg bg-[#245b70]/10 text-[#245b70] dark:bg-cyan-900/30 dark:text-cyan-300 border border-[#245b70]/20 dark:border-cyan-700/30 font-bold text-xs shadow-sm\">${escapeHtml(c)}</span>`).join(' ')\n"
  + "        : `<span class=\"text-xs text-[var(--text-sub)] italic\">None assigned</span>`;");

if (js.includes(OLD_SUBJ)) {
  js = js.replace(OLD_SUBJ, NEW_SUBJ);
  console.log('✅ PATCH 1b: Added classesPills variable');
} else {
  console.error('❌ PATCH 1b: subjectsPills not found — checking...');
  const idx = js.indexOf('subjectsPills');
  if (idx > 0) console.log('Context:', JSON.stringify(js.slice(idx, idx+300)));
}

// ─── PATCH 1a: Add Classes strip above Subjects strip in teacher cards ───────
const OLD_STRIPS = nl("          <!-- Subjects strip at bottom -->\n"
  + "          <div class=\"border-t border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2 flex items-start gap-2\">\n"
  + "            <span class=\"text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-wide pt-0.5 flex-shrink-0\">Subjects</span>\n"
  + "            <div class=\"flex flex-wrap gap-1 flex-1\">${subjectsPills}</div>\n"
  + "          </div>");

const NEW_STRIPS = nl("          <!-- Classes strip -->\n"
  + "          <div class=\"border-t border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2 flex items-start gap-2\">\n"
  + "            <span class=\"text-[10px] font-bold text-[#245b70] dark:text-cyan-400 uppercase tracking-wide pt-0.5 flex-shrink-0\">Classes</span>\n"
  + "            <div class=\"flex flex-wrap gap-1 flex-1\">${classesPills}</div>\n"
  + "          </div>\n"
  + "          <!-- Subjects strip at bottom -->\n"
  + "          <div class=\"border-t border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2 flex items-start gap-2\">\n"
  + "            <span class=\"text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-wide pt-0.5 flex-shrink-0\">Subjects</span>\n"
  + "            <div class=\"flex flex-wrap gap-1 flex-1\">${subjectsPills}</div>\n"
  + "          </div>");

if (js.includes(OLD_STRIPS)) {
  js = js.replace(OLD_STRIPS, NEW_STRIPS);
  console.log('✅ PATCH 1a: Added Classes strip above Subjects in teacher cards');
} else {
  console.error('❌ PATCH 1a: Subjects strip not found — checking...');
  const idx = js.indexOf('Subjects strip at bottom');
  if (idx > 0) console.log('Context:', JSON.stringify(js.slice(idx-10, idx+400)));
}

// ─── PATCH 2: Re-render lists after settings load ────────────────────────────
const OLD_INIT = nl("      await loadAppSettings();\n"
  + "      await loadClasses();\n"
  + "      await loadSubjects();\n"
  + "      await loadTeachersData();");

const NEW_INIT = nl("      await loadAppSettings();\n"
  + "      await loadClasses();\n"
  + "      await loadSubjects();\n"
  + "      await loadTeachersData();\n"
  + "      // Re-render after settings load so canUserEditDelete() uses correct value\n"
  + "      renderClassesList();\n"
  + "      renderSubjectsList();\n"
  + "      renderStudentsDirectory();\n"
  + "      renderTeachersList();");

if (js.includes(OLD_INIT)) {
  js = js.replace(OLD_INIT, NEW_INIT);
  console.log('✅ PATCH 2: Added re-render calls after settings/data load');
} else {
  console.error('❌ PATCH 2: DOMContentLoaded init block not found');
  const idx = js.indexOf('await loadAppSettings()');
  if (idx > 0) console.log('Context:', JSON.stringify(js.slice(idx, idx+200)));
}

fs.writeFileSync(APP_JS, js, 'utf8');
console.log('\n✅ app.js saved!');
