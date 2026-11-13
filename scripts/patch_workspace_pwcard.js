// patch_workspace_pwcard.js - Replace PW class card header with clean SVG style
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'public', 'js', 'workspace.js');
let c = fs.readFileSync(file, 'utf8');

// Find and replace the entire PW class card rendering block
const OLD = `          : pwClassesList.map(cls => {
            const subs = (pwSubjectsList || []).filter(function(s) { return (s.assignedClasses || []).some(function(ac) { return ac === cls.name; }); }).map(function(s) { return s.name; });
            return \`
            <div class="bg-white dark:bg-[#2d1020] rounded-2xl border border-pink-300 dark:border-pink-800 shadow-md overflow-hidden">
              <!-- Dark gradient header -->
              <div class="bg-gradient-to-r from-pink-700 via-rose-600 to-pink-500 p-3 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  \${lockSVG('14')}
                  <div class="min-w-0">
                    <div class="text-sm font-black text-white truncate">\${escapeHtml(cls.name)}</div>
                    <div class="text-[10px] text-pink-100 opacity-90">\u{1F469}\u200D\u{1F3EB} \${escapeHtml(cls.classTeacher || 'No Teacher Assigned')}</div>
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
                <div class="text-[9px] font-black uppercase tracking-widest text-pink-500 dark:text-pink-400">\u{1F4DA} Assigned Subjects</div>
                <div class="flex flex-wrap gap-1.5">
                  \${subs.length > 0
                    ? subs.map(sub => \`<span class="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-700 text-[10px] font-bold shadow-xs">\${escapeHtml(sub)}</span>\`).join('')
                    : \`<span class="text-[10px] text-pink-300 dark:text-pink-600 italic">No subjects assigned yet</span>\`}
                </div>
              </div>
            </div>\`;
          }).join('')}`;

const NEW = `          : pwClassesList.map(cls => {
            const subs = (pwSubjectsList || []).filter(function(s) { return (s.assignedClasses || []).some(function(ac) { return ac === cls.name; }); }).map(function(s) { return s.name; });
            return \`
            <div class="bg-white dark:bg-[#2d1020] rounded-2xl border border-pink-300 dark:border-pink-800 shadow-md overflow-hidden">
              <!-- Clean light header with SVG icon -->
              <div class="bg-white dark:bg-[#2d1020] border-b border-pink-200 dark:border-pink-800 p-3 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center flex-shrink-0 border border-pink-200 dark:border-pink-700">
                    <svg class="w-5 h-5 text-pink-600 dark:text-pink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-black text-pink-800 dark:text-pink-200 truncate">\${escapeHtml(cls.name)}</div>
                    <div class="text-[10px] text-pink-500 dark:text-pink-400 flex items-center gap-1 mt-0.5">
                      <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      <span class="truncate">\${escapeHtml(cls.classTeacher || 'No Teacher Assigned')}</span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button onclick="pwEditClass('\${cls._id}')" class="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-800 flex items-center justify-center active:scale-95 transition" title="Edit">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button onclick="pwDeleteClass('\${cls._id}','\${escapeQuotes(cls.name)}')" class="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center active:scale-95 transition" title="Delete">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
                  </button>
                </div>
              </div>
              <!-- Body: subject pills -->
              <div class="p-3 space-y-2 bg-gradient-to-b from-pink-50 to-white dark:from-pink-950/20 dark:to-[#2d1020]">
                <div class="text-[9px] font-black uppercase tracking-widest text-pink-500 dark:text-pink-400 flex items-center gap-1">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  Assigned Subjects
                </div>
                <div class="flex flex-wrap gap-1.5">
                  \${subs.length > 0
                    ? subs.map(sub => \`<span class="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-700 text-[10px] font-bold shadow-xs">\${escapeHtml(sub)}</span>\`).join('')
                    : \`<span class="text-[10px] text-pink-300 dark:text-pink-600 italic">No subjects assigned yet</span>\`}
                </div>
              </div>
            </div>\`;
          }).join('')}`;

if (!c.includes(OLD)) {
  // Try alternate: file might use different emoji encoding
  // Let's search for unique surrounding text and do a regex replace
  const result = c.replace(
    /(: pwClassesList\.map\(cls => \{[\s\S]*?const subs[\s\S]*?return `)([\s\S]*?)(`;[\s\S]*?\}\)\.join\(''\)\})/,
    (match, pre, middle, post) => {
      return pre + `
            <div class="bg-white dark:bg-[#2d1020] rounded-2xl border border-pink-300 dark:border-pink-800 shadow-md overflow-hidden">
              <!-- Clean light header with SVG icon -->
              <div class="bg-white dark:bg-[#2d1020] border-b border-pink-200 dark:border-pink-800 p-3 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center flex-shrink-0 border border-pink-200 dark:border-pink-700">
                    <svg class="w-5 h-5 text-pink-600 dark:text-pink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-black text-pink-800 dark:text-pink-200 truncate">\${escapeHtml(cls.name)}</div>
                    <div class="text-[10px] text-pink-500 dark:text-pink-400 flex items-center gap-1 mt-0.5">
                      <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      <span class="truncate">\${escapeHtml(cls.classTeacher || 'No Teacher Assigned')}</span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button onclick="pwEditClass('\${cls._id}')" class="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-800 flex items-center justify-center active:scale-95 transition" title="Edit">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button onclick="pwDeleteClass('\${cls._id}','\${escapeQuotes(cls.name)}')" class="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center active:scale-95 transition" title="Delete">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
                  </button>
                </div>
              </div>
              <!-- Body: subject pills -->
              <div class="p-3 space-y-2 bg-gradient-to-b from-pink-50 to-white dark:from-pink-950/20 dark:to-[#2d1020]">
                <div class="text-[9px] font-black uppercase tracking-widest text-pink-500 dark:text-pink-400 flex items-center gap-1">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  Assigned Subjects
                </div>
                <div class="flex flex-wrap gap-1.5">
                  \${subs.length > 0
                    ? subs.map(sub => \`<span class="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-700 text-[10px] font-bold shadow-xs">\${escapeHtml(sub)}</span>\`).join('')
                    : \`<span class="text-[10px] text-pink-300 dark:text-pink-600 italic">No subjects assigned yet</span>\`}
                </div>
              </div>
            </div>` + post;
    }
  );
  if (result === c) {
    console.error('REGEX replace also failed — no match found');
    process.exit(1);
  }
  fs.writeFileSync(file, result, 'utf8');
  console.log('OK: PW class card patched via regex');
} else {
  fs.writeFileSync(file, c.split(OLD).join(NEW), 'utf8');
  console.log('OK: PW class card patched via exact match');
}
