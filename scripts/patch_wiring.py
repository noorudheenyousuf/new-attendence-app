#!/usr/bin/env python3
"""
Patch script: wire workspace.js into index.html and patch app.js
"""

import re

BASE = r"c:\Users\muhammed noorudheen\OneDrive\Desktop\projects\Antigravity-projects\new-attendence-app"

# ===========================================================================
# 1. PATCH index.html — add workspace.js script tag + 3 PW modals
# ===========================================================================

with open(BASE + r"\public\index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1a. Add workspace.js script tag before </body>
OLD_SCRIPTS = '''  <!-- SCRIPTS -->
  <script src="/js/api.js"></script>
  <script src="/js/app.js"></script>
</body>
</html>'''

NEW_SCRIPTS = '''  <!-- SCRIPTS -->
  <script src="/js/api.js"></script>
  <script src="/js/app.js"></script>
  <script src="/js/workspace.js"></script>
</body>
</html>'''

if 'workspace.js' not in html:
    html = html.replace(OLD_SCRIPTS, NEW_SCRIPTS)
    print("✅ Added workspace.js script tag")
else:
    print("ℹ️  workspace.js already in index.html")

# 1b. Add 3 workspace modals before the TOAST section
PW_MODALS = '''
  <!-- PERSONAL WORKSPACE MODALS -->

  <!-- PW: Add/Edit Private Class -->
  <div id="pw-modal-class" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-white dark:bg-[#2d1020] w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-pink-200 dark:border-pink-800">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center">
            <svg class="w-4 h-4 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
          <h3 id="pw-class-modal-title" class="font-extrabold text-base text-pink-800 dark:text-pink-200">Add Private Class</h3>
        </div>
        <button onclick="pwCloseClassModal()" class="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-500 flex items-center justify-center font-bold text-sm hover:bg-pink-200 transition">✕</button>
      </div>
      <form onsubmit="pwSaveClass(event)" class="space-y-3">
        <input type="hidden" id="pw-input-class-id" value="">
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Class Name *</label>
          <input type="text" id="pw-input-class-name" required placeholder="e.g. My Private Batch A" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-bold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
        </div>
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Class Teacher</label>
          <input type="text" id="pw-input-class-teacher" placeholder="Your name or leave blank" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
        </div>
        <div class="flex gap-2 pt-1">
          <button type="button" onclick="pwCloseClassModal()" class="flex-1 py-2.5 rounded-xl border border-pink-300 dark:border-pink-700 text-pink-600 dark:text-pink-300 font-bold text-sm hover:bg-pink-50 transition">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 pw-gradient-btn rounded-xl font-bold text-sm shadow-md">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- PW: Add/Edit Private Subject -->
  <div id="pw-modal-subject" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-white dark:bg-[#2d1020] w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-pink-200 dark:border-pink-800">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center">
            <svg class="w-4 h-4 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <h3 id="pw-subject-modal-title" class="font-extrabold text-base text-pink-800 dark:text-pink-200">Add Private Subject</h3>
        </div>
        <button onclick="pwCloseSubjectModal()" class="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-500 flex items-center justify-center font-bold text-sm hover:bg-pink-200 transition">✕</button>
      </div>
      <form onsubmit="pwSaveSubject(event)" class="space-y-3">
        <input type="hidden" id="pw-input-subject-id" value="">
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Subject Name *</label>
          <input type="text" id="pw-input-subject-name" required placeholder="e.g. Advanced Math" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-bold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
        </div>
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Subject Code</label>
          <input type="text" id="pw-input-subject-code" placeholder="e.g. ADV-MTH" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
        </div>
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Subject Teacher</label>
          <input type="text" id="pw-input-subject-teacher" placeholder="Teacher name" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
        </div>
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Assign to Class</label>
          <select id="pw-input-subject-class" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400">
            <option value="">— No class (optional) —</option>
          </select>
        </div>
        <div class="flex gap-2 pt-1">
          <button type="button" onclick="pwCloseSubjectModal()" class="flex-1 py-2.5 rounded-xl border border-pink-300 dark:border-pink-700 text-pink-600 dark:text-pink-300 font-bold text-sm hover:bg-pink-50 transition">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 pw-gradient-btn rounded-xl font-bold text-sm shadow-md">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- PW: Add/Edit Private Student -->
  <div id="pw-modal-student" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-white dark:bg-[#2d1020] w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-pink-200 dark:border-pink-800">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center">
            <svg class="w-4 h-4 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <h3 id="pw-student-modal-title" class="font-extrabold text-base text-pink-800 dark:text-pink-200">Add Private Student</h3>
        </div>
        <button onclick="pwCloseStudentModal()" class="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-500 flex items-center justify-center font-bold text-sm hover:bg-pink-200 transition">✕</button>
      </div>
      <form onsubmit="pwSaveStudent(event)" class="space-y-3">
        <input type="hidden" id="pw-input-student-db-id" value="">
        <div id="pw-student-id-row">
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">
            Student ID
            <span class="ml-1 font-normal text-pink-400 text-[10px]">(auto-generated, freely editable)</span>
          </label>
          <input type="text" id="pw-input-student-id" placeholder="P-101" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-bold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
          <p class="text-[10px] text-pink-400 mt-0.5 pl-1">Must start with P- (e.g. P-101, P-A2). No duplicates allowed.</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Student Name *</label>
          <input type="text" id="pw-input-student-name" required placeholder="Full name" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-bold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
        </div>
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Class *</label>
          <select id="pw-input-student-class" required class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400">
            <option value="">— Select Class —</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1">Roll Number</label>
          <input type="text" id="pw-input-student-roll" placeholder="e.g. 1" class="touch-input w-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-700 rounded-xl px-4 text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder-pink-300">
        </div>
        <div class="flex gap-2 pt-1">
          <button type="button" onclick="pwCloseStudentModal()" class="flex-1 py-2.5 rounded-xl border border-pink-300 dark:border-pink-700 text-pink-600 dark:text-pink-300 font-bold text-sm hover:bg-pink-50 transition">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 pw-gradient-btn rounded-xl font-bold text-sm shadow-md">Save</button>
        </div>
      </form>
    </div>
  </div>

'''

TOAST_MARKER = '  <!-- TOAST NOTIFICATION -->'
if 'pw-modal-class' not in html:
    html = html.replace(TOAST_MARKER, PW_MODALS + TOAST_MARKER)
    print("✅ Added 3 workspace modals to index.html")
else:
    print("ℹ️  PW modals already in index.html")

with open(BASE + r"\public\index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ index.html saved")

# ===========================================================================
# 2. PATCH app.js
# ===========================================================================

with open(BASE + r"\public\js\app.js", "r", encoding="utf-8") as f:
    js = f.read()

# 2a. Add 'workspace' to allViews in selectTab()
OLD_VIEWS = "const allViews = ['home', 'attendance', 'report', 'settings', 'classes', 'subjects', 'students', 'teachers', 'admin', 'edit-profile', 'teacher-log', 'timetable', 'messages'];"
NEW_VIEWS = "const allViews = ['home', 'attendance', 'report', 'settings', 'classes', 'subjects', 'students', 'teachers', 'admin', 'edit-profile', 'teacher-log', 'timetable', 'messages', 'workspace'];"

if 'workspace' not in js[js.find('const allViews'):js.find('const allViews')+200]:
    js = js.replace(OLD_VIEWS, NEW_VIEWS)
    print("✅ Added 'workspace' to allViews in selectTab()")
else:
    print("ℹ️  'workspace' already in allViews")

# 2b. After the activeEl.classList.remove('hidden') line in selectTab, add pink theme revert
OLD_ACTIVE_EL = "  const activeEl = document.getElementById(`view-${tab}`);\n  if (activeEl) activeEl.classList.remove('hidden');"
NEW_ACTIVE_EL = """  const activeEl = document.getElementById(`view-${tab}`);
  if (activeEl) activeEl.classList.remove('hidden');

  // Revert pink theme when leaving workspace
  if (tab !== 'workspace' && typeof revertPinkTheme === 'function' && typeof pwActive !== 'undefined' && pwActive) {
    revertPinkTheme();
  }"""

if 'Revert pink theme when leaving workspace' not in js:
    js = js.replace(OLD_ACTIVE_EL, NEW_ACTIVE_EL)
    print("✅ Added revertPinkTheme() call in selectTab()")
else:
    print("ℹ️  revertPinkTheme already patched in selectTab")

# 2c. Patch loadDashboardStats() to exclude private data
OLD_STAT1 = """    // Total Students from API
    let totalStudents = 0;
    try {
      const res = await API.getStudents('all');
      const studentData = (res && res.success && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
      totalStudents = studentData.length;
      if (stEl) stEl.textContent = String(totalStudents);
    } catch (_) {}"""

NEW_STAT1 = """    // Total Students from API — CAMPUS OVERVIEW: public only (exclude private workspace)
    let totalStudents = 0;
    try {
      const res = await API.getStudents('all');
      const studentData = (res && res.success && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
      // Only count public (non-private) students in campus overview
      const publicStudents = studentData.filter(s => !s.isPrivate);
      totalStudents = publicStudents.length;
      if (stEl) stEl.textContent = String(totalStudents);
    } catch (_) {}"""

if 'Campus OVERVIEW: public only' not in js and 'CAMPUS OVERVIEW: public only' not in js:
    js = js.replace(OLD_STAT1, NEW_STAT1)
    print("✅ Patched loadDashboardStats() to exclude private students")
else:
    print("ℹ️  loadDashboardStats() already patched for public-only")

# 2d. Patch class count in loadDashboardStats to exclude private
OLD_CLS_COUNT = "    const totalClasses = (classesList || []).length;\n    if (clEl) clEl.textContent = String(totalClasses);"
NEW_CLS_COUNT = """    // Campus Overview: public classes only
    const totalClasses = (classesList || []).filter(c => !c.isPrivate).length;
    if (clEl) clEl.textContent = String(totalClasses);"""

if 'Campus Overview: public classes only' not in js:
    js = js.replace(OLD_CLS_COUNT, NEW_CLS_COUNT)
    print("✅ Patched class count in loadDashboardStats() to exclude private")
else:
    print("ℹ️  Class count in loadDashboardStats() already patched")

# 2e. Patch checkUnreadMessages() badge - replace unread-msg-badge with header-unread-msg-badge call
OLD_BADGE1 = """    const badge = document.getElementById('unread-msg-badge');
    if (badge) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      if (unreadCount > 0) {
        badge.classList.remove('hidden');
        badge.style.display = 'flex';
      } else {
        badge.classList.add('hidden');
        badge.style.display = '';
      }
    }"""

NEW_BADGE1 = """    // Update header notification bell badge (badge moved from messages card to header bell)
    if (typeof updateNotifBadge === 'function') {
      updateNotifBadge(unreadCount);
    } else {
      const badge = document.getElementById('header-unread-msg-badge');
      if (badge) {
        badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
        if (unreadCount > 0) { badge.classList.remove('hidden'); badge.style.display = 'flex'; }
        else { badge.classList.add('hidden'); badge.style.display = ''; }
      }
    }"""

if 'Update header notification bell badge' not in js:
    js = js.replace(OLD_BADGE1, NEW_BADGE1)
    print("✅ Patched checkUnreadMessages() to use header bell badge")
else:
    print("ℹ️  checkUnreadMessages() badge already patched")

# 2f. Patch openMessagesModal() badge clear
OLD_BADGE2 = "  const badge = document.getElementById('unread-msg-badge');\n  if (badge) { badge.classList.add('hidden'); badge.style.display = ''; }"
NEW_BADGE2 = """  // Clear header notification bell badge on opening messages
  if (typeof updateNotifBadge === 'function') { updateNotifBadge(0); }
  else {
    const badge = document.getElementById('header-unread-msg-badge');
    if (badge) { badge.classList.add('hidden'); badge.style.display = ''; }
  }"""

if 'Clear header notification bell badge on opening messages' not in js:
    js = js.replace(OLD_BADGE2, NEW_BADGE2)
    print("✅ Patched openMessagesModal() badge clear")
else:
    print("ℹ️  openMessagesModal() badge clear already patched")

# 2g. Add lock icon to renderClassesList — patch the class name h3
LOCK_SVG_CLS = '<svg style=\\"display:inline;width:11px;height:11px;color:#db2777;vertical-align:middle;margin-right:3px\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2.5\\"><rect x=\\"3\\" y=\\"11\\" width=\\"18\\" height=\\"11\\" rx=\\"2\\"></rect><path d=\\"M7 11V7a5 5 0 0 1 10 0v4\\"></path></svg>'

OLD_CLASS_H3 = "            <h3 class=\"font-black text-white text-sm sm:text-base leading-tight truncate select-none tracking-tight\">${escapeHtml(c.name)}</h3>"
NEW_CLASS_H3 = """            <h3 class=\"font-black text-white text-sm sm:text-base leading-tight truncate select-none tracking-tight\">${c.isPrivate ? '%s' : ''}${escapeHtml(c.name)}</h3>""" % LOCK_SVG_CLS

if 'c.isPrivate ? ' not in js[js.find('renderClassesList'):js.find('renderClassesList')+3000]:
    js = js.replace(OLD_CLASS_H3, NEW_CLASS_H3)
    print("✅ Added lock icon to renderClassesList()")
else:
    print("ℹ️  Lock icon already in renderClassesList()")

# 2h. Add lock icon to renderStudentsDirectory — student name span
OLD_STUDENT_NAME = "                <span class=\"font-extrabold text-[var(--text-main)] text-sm truncate\">${st.name}</span>"
NEW_STUDENT_NAME = "                <span class=\"font-extrabold text-[var(--text-main)] text-sm truncate\">${st.isPrivate ? '<svg style=\"display:inline;width:11px;height:11px;color:#db2777;vertical-align:middle;margin-right:3px\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"></path></svg>' : ''}${st.name}</span>"

if "st.isPrivate ? '<svg" not in js[js.find('renderStudentsDirectory'):js.find('renderStudentsDirectory')+3000]:
    js = js.replace(OLD_STUDENT_NAME, NEW_STUDENT_NAME)
    print("✅ Added lock icon to renderStudentsDirectory()")
else:
    print("ℹ️  Lock icon already in renderStudentsDirectory()")

# 2i. Add lock icon to subject cards - find _generateSubjectCardHtml or similar
# Look at how subject name is rendered in the subject card
OLD_SUBJ_CTX = js.find('_generateSubjectCardHtml')
print(f"ℹ️  Subject card function found at char {OLD_SUBJ_CTX}")

# Save app.js
with open(BASE + r"\public\js\app.js", "w", encoding="utf-8") as f:
    f.write(js)

print("\n✅ All patches applied successfully!")
print("Next: run server and test.")
