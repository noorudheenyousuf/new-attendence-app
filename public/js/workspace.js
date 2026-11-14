// ============================================================
// PERSONAL WORKSPACE (Private Corner) — Full Feature Module
// ============================================================

// ---- State ----
let pwActive = false;
let pwClassesList = [];
let pwSubjectsList = [];
let pwStudentsList = [];
let pwCurrentSubView = 'hub'; // 'hub' | 'classes' | 'subjects' | 'students'
let pwEditClassId = null;
let pwEditSubjectId = null;
let pwEditStudentObjId = null;

// ---- Theme helpers ----
const PINK_THEME_COLOR = '#be185d';
const TEAL_THEME_COLOR = '#245b70';
let _originalThemeColor = null;

function applyPinkTheme() {
  document.documentElement.classList.add('workspace-pink-mode');
  // Update status bar meta theme-color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    _originalThemeColor = metaTheme.content;
    metaTheme.content = PINK_THEME_COLOR;
  }
  // Header
  const header = document.querySelector('header');
  if (header) {
    header.classList.remove('custom-gradient-header');
    header.style.background = 'linear-gradient(135deg, #be185d, #e879a0)';
  }
  // Footer
  const footer = document.querySelector('footer');
  if (footer) {
    footer.style.borderTopColor = '#fbcfe8';
  }
  // Safe area top/bottom color (CSS env-based, via body background)
  document.body.style.backgroundColor = PINK_THEME_COLOR;
  pwActive = true;
}

function revertPinkTheme() {
  document.documentElement.classList.remove('workspace-pink-mode');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = _originalThemeColor || TEAL_THEME_COLOR;
  const header = document.querySelector('header');
  if (header) {
    header.classList.add('custom-gradient-header');
    header.style.background = '';
  }
  const footer = document.querySelector('footer');
  if (footer) footer.style.borderTopColor = '';
  document.body.style.backgroundColor = '';
  pwActive = false;
}

// ---- Lock SVG ----
function lockSVG(size = '14') {
  return `<svg class="private-lock-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-label="Private"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
}

// ---- Open / Close workspace ----
async function openPersonalWorkspace() {
  triggerNavHaptic('medium');
  if (currentActiveTab !== 'workspace') {
    previousAppTab = currentActiveTab;
  }
  currentActiveTab = 'workspace';
  applyPinkTheme();
  // Hide all other views
  const allViews = ['home','attendance','report','settings','classes','subjects','students','teachers','admin','edit-profile','teacher-log','timetable','messages'];
  allViews.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });
  const wsView = document.getElementById('view-workspace');
  if (wsView) wsView.classList.remove('hidden');

  // Reset bottom nav active state
  ['home','attendance','report','settings'].forEach(t => {
    const btn = document.getElementById(`bottom-tab-${t}`);
    if (btn) btn.className = "flex-1 flex flex-col items-center justify-center py-1 text-[var(--text-sub)] hover:text-[#245b70] font-medium tab-transition";
  });

  pwCurrentSubView = 'hub';
  await loadPrivateData();
  renderWorkspaceHub();
  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;
}

function closePersonalWorkspace() {
  triggerNavHaptic('medium');
  revertPinkTheme();
  const wsView = document.getElementById('view-workspace');
  if (wsView) wsView.classList.add('hidden');
  selectTab(previousAppTab || 'home');
}

// ---- Load all private data ----
async function loadPrivateData() {
  try {
    const [clRes, subRes, stRes] = await Promise.all([
      API.getPrivateClasses(),
      API.getPrivateSubjects(),
      API.getPrivateStudents()
    ]);
    pwClassesList = (clRes && clRes.success) ? clRes.data : [];
    pwSubjectsList = (subRes && subRes.success) ? subRes.data : [];
    pwStudentsList = (stRes && stRes.success) ? stRes.data : [];
  } catch (e) {
    pwClassesList = [];
    pwSubjectsList = [];
    pwStudentsList = [];
  }
}

// ---- Render Hub (main workspace screen) ----
function renderWorkspaceHub() {
  pwCurrentSubView = 'hub';
  const container = document.getElementById('view-workspace');
  if (!container) return;

  const userName = currentUser ? currentUser.name.split(' ')[0] : 'Teacher';
  container.innerHTML = `
    <div class="pw-animate-enter flex flex-col min-h-full" style="background:linear-gradient(180deg,#fdf2f8 0%,#fce7f3 100%);min-height:calc(100dvh - 120px)">

      <!-- Pink Header -->
      <div class="px-4 pt-4 pb-3">
        <div class="flex items-center gap-2 mb-0.5">
          <svg class="w-4 h-4 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span class="text-[10px] font-black uppercase tracking-widest text-pink-500">Personal Workspace</span>
        </div>
        <h2 class="text-lg font-black text-pink-800 dark:text-pink-200 leading-tight">Add your own classes,<br>subjects, students</h2>
        <p class="text-[11px] text-pink-500 dark:text-pink-400 mt-0.5">Your private corner — only visible to you</p>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-3 gap-2 px-4 mb-3">
        <div class="bg-white/70 dark:bg-pink-950/40 rounded-2xl p-2.5 border border-pink-200 dark:border-pink-800 text-center">
          <div class="text-xl font-black text-pink-700 dark:text-pink-300">${pwClassesList.length}</div>
          <div class="text-[10px] font-bold text-pink-500">Classes</div>
        </div>
        <div class="bg-white/70 dark:bg-pink-950/40 rounded-2xl p-2.5 border border-pink-200 dark:border-pink-800 text-center">
          <div class="text-xl font-black text-pink-700 dark:text-pink-300">${pwSubjectsList.length}</div>
          <div class="text-[10px] font-bold text-pink-500">Subjects</div>
        </div>
        <div class="bg-white/70 dark:bg-pink-950/40 rounded-2xl p-2.5 border border-pink-200 dark:border-pink-800 text-center">
          <div class="text-xl font-black text-pink-700 dark:text-pink-300">${pwStudentsList.length}</div>
          <div class="text-[10px] font-bold text-pink-500">Students</div>
        </div>
      </div>

      <!-- Action Buttons: Class + Subject (50/50 row), Students (full row) -->
      <div class="px-4 space-y-2.5">
        <!-- Row 1: Class + Subject -->
        <div class="grid grid-cols-2 gap-2.5">
          <!-- Class Button -->
          <button type="button" onclick="pwOpenClasses()" class="touch-btn flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-white/80 dark:bg-pink-950/30 border-2 border-pink-200 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-950/60 active:scale-95 transition group shadow-sm">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center group-hover:scale-105 transition shadow-md">
              <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            </div>
            <div>
              <div class="text-sm font-black text-pink-800 dark:text-pink-200">Class</div>
              <div class="text-[10px] text-pink-500">${pwClassesList.length} added</div>
            </div>
          </button>

          <!-- Subject Button -->
          <button type="button" onclick="pwOpenSubjects()" class="touch-btn flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-white/80 dark:bg-pink-950/30 border-2 border-pink-200 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-950/60 active:scale-95 transition group shadow-sm">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center group-hover:scale-105 transition shadow-md">
              <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </div>
            <div>
              <div class="text-sm font-black text-pink-800 dark:text-pink-200">Subject</div>
              <div class="text-[10px] text-pink-500">${pwSubjectsList.length} added</div>
            </div>
          </button>
        </div>

        <!-- Row 2: Students (full width) -->
        <button type="button" onclick="pwOpenStudents()" class="touch-btn w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-white/80 dark:bg-pink-950/30 border-2 border-pink-200 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-950/60 active:scale-98 transition group shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center group-hover:scale-105 transition shadow-md flex-shrink-0">
              <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <div class="text-left">
              <div class="text-sm font-black text-pink-800 dark:text-pink-200">Students</div>
              <div class="text-[10px] text-pink-500">${pwStudentsList.length} private students enrolled</div>
            </div>
          </div>
          <svg class="w-5 h-5 text-pink-400 group-hover:translate-x-0.5 transition flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>

      <!-- Illustration / Greeting -->
      <div class="flex-1 flex flex-col items-center justify-center px-6 py-6 text-center gap-3 mt-2">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="40" cy="40" r="40" fill="#fce7f3"/>
          <rect x="20" y="30" width="40" height="28" rx="5" fill="#f9a8d4" stroke="#be185d" stroke-width="1.5"/>
          <path d="M28 30V26a12 12 0 0 1 24 0v4" stroke="#be185d" stroke-width="2" stroke-linecap="round"/>
          <circle cx="40" cy="40" r="4" fill="#be185d"/>
          <line x1="40" y1="44" x2="40" y2="50" stroke="#be185d" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div>
          <p class="text-sm font-black text-pink-700 dark:text-pink-300">Hey ${escapeHtml(userName)}! 👋</p>
          <p class="text-[11px] text-pink-500 dark:text-pink-400 mt-1 leading-relaxed">This is your private corner.<br>Your data stays safe, always.</p>
        </div>
      </div>

      <!-- Exit Button (100% width) -->
      <div class="px-4 pb-4">
        <button type="button" onclick="closePersonalWorkspace()" class="touch-btn w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-pink-300 dark:border-pink-700 bg-white/60 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300 font-bold text-sm hover:bg-pink-50 active:scale-98 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Exit Personal Workspace
        </button>
      </div>
    </div>`;
}

// ================================================================
// CLASSES sub-view
// ================================================================
async function pwOpenClasses() {
  triggerNavHaptic('light');
  pwCurrentSubView = 'classes';
  await loadPrivateData();
  renderPWClassesView();
}

function renderPWClassesView() {
  const container = document.getElementById('view-workspace');
  if (!container) return;
  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;

  container.innerHTML = `
    <div class="pw-animate-enter space-y-3.5">
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <button type="button" onclick="renderWorkspaceHub()" class="touch-btn px-2.5 py-1 rounded-xl bg-pink-100 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800 text-xs font-bold text-pink-700 dark:text-pink-300 hover:bg-pink-200 flex items-center gap-1 transition shadow-xs">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Workspace</span>
          </button>
          <div class="flex items-center gap-1.5">
            ${lockSVG('16')}
            <h2 class="text-base font-extrabold text-pink-800 dark:text-pink-200">My Classes</h2>
          </div>
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-pink-500 text-white shadow-sm font-semibold text-xs">
            <span>Total:</span><span class="font-black">${pwClassesList.length}</span>
          </div>
        </div>
        <button onclick="pwOpenAddClassModal()" class="touch-btn px-3.5 py-1.5 pw-gradient-btn text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md flex-shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Add Class</span>
        </button>
      </div>

      <!-- Classes List -->
      <div class="space-y-2.5" id="pw-class-cards">
        ${pwClassesList.length === 0
          ? `<div class="text-center py-12 text-pink-400 dark:text-pink-600">
               <svg class="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
               <p class="text-sm font-bold">No private classes yet</p>
               <p class="text-xs mt-1">Tap "Add Class" to get started</p>
             </div>`
          : pwClassesList.map(cls => {
            const subs = (pwSubjectsList || []).filter(function(s) {
              const inAssigned = (s.assignedClasses || []).some(function(ac) { return (ac || '').trim().toLowerCase() === (cls.name || '').trim().toLowerCase(); });
              const inSingle = (s.class || '').trim().toLowerCase() === (cls.name || '').trim().toLowerCase();
              return inAssigned || inSingle;
            }).map(function(s) { return s.name; });
            // Follow pwSubjectsList order
            subs.sort(function(a, b) {
              const idxA = (pwSubjectsList || []).findIndex(s => s.name === a);
              const idxB = (pwSubjectsList || []).findIndex(s => s.name === b);
              return idxA - idxB;
            });
            return `
            <div class="bg-white dark:bg-[#2d1020] rounded-2xl border border-pink-300 dark:border-pink-800 shadow-md overflow-hidden">
              <!-- Clean light header with SVG icon -->
              <div class="bg-pink-700 text-white p-4 rounded-t-xl flex justify-between items-center">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center flex-shrink-0 border border-pink-200 dark:border-pink-700">
                    <svg class="w-5 h-5 text-pink-600 dark:text-pink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <div class="text-white font-bold text-lg truncate">${escapeHtml(cls.name)}</div>
                    <div class="text-[10px] text-pink-200 dark:text-pink-400 flex items-center gap-1 mt-0.5">
                      <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      <span class="truncate">${escapeHtml(cls.classTeacher || 'No Teacher Assigned')}</span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button onclick="pwEditClass('${cls._id}')" class="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-800 flex items-center justify-center active:scale-95 transition" title="Edit">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button onclick="pwDeleteClass('${cls._id}','${escapeQuotes(cls.name)}')" class="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center active:scale-95 transition" title="Delete">
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
                  ${subs.length > 0
                    ? subs.map(sub => `<span class="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-700 text-[10px] font-bold shadow-xs">${escapeHtml(sub)}</span>`).join('')
                    : `<span class="text-[10px] text-pink-300 dark:text-pink-600 italic">No subjects assigned yet</span>`}
                </div>
              </div>
            </div>`;
          }).join('')}
      </div>
    </div>`;
}

// ================================================================
// SUBJECTS sub-view
// ================================================================
async function pwOpenSubjects() {
  triggerNavHaptic('light');
  pwCurrentSubView = 'subjects';
  await loadPrivateData();
  renderPWSubjectsView();
}

function renderPWSubjectsView() {
  const container = document.getElementById('view-workspace');
  if (!container) return;
  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;

  container.innerHTML = `
    <div class="pw-animate-enter space-y-3.5">
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <button type="button" onclick="renderWorkspaceHub()" class="touch-btn px-2.5 py-1 rounded-xl bg-pink-100 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800 text-xs font-bold text-pink-700 dark:text-pink-300 hover:bg-pink-200 flex items-center gap-1 transition shadow-xs">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Workspace</span>
          </button>
          <div class="flex items-center gap-1.5">
            ${lockSVG('16')}
            <h2 class="text-base font-extrabold text-pink-800 dark:text-pink-200">My Subjects</h2>
          </div>
        </div>
        <button onclick="pwOpenAddSubjectModal()" class="touch-btn px-3.5 py-1.5 pw-gradient-btn text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md flex-shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Add Subject</span>
        </button>
      </div>

      <!-- Subjects List -->
      <div class="space-y-2.5">
        ${pwSubjectsList.length === 0
          ? `<div class="text-center py-12 text-pink-400 dark:text-pink-600">
               <svg class="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
               <p class="text-sm font-bold">No private subjects yet</p>
               <p class="text-xs mt-1">Tap "Add Subject" to get started</p>
             </div>`
          : pwSubjectsList.map(sub => `
            <div class="bg-white/80 dark:bg-pink-950/30 rounded-2xl p-3.5 border border-pink-200 dark:border-pink-800 shadow-sm flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                ${lockSVG()}
                <div class="min-w-0">
                  <div class="text-sm font-black text-pink-800 dark:text-pink-200 truncate">${escapeHtml(sub.name)}</div>
                  <div class="text-[10px] text-pink-500">Code: ${escapeHtml(sub.subjectCode || '-')} • Classes: ${(sub.assignedClasses||[]).join(', ') || 'None'}</div>
                </div>
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button onclick="pwEditSubject('${sub._id}')" class="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300 flex items-center justify-center hover:bg-pink-200 active:scale-95 transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button onclick="pwDeleteSubject('${sub._id}','${escapeQuotes(sub.name)}')" class="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-100 active:scale-95 transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path></svg>
                </button>
              </div>
            </div>`).join('')}
      </div>
    </div>`;
}

// ================================================================
// STUDENTS sub-view
// ================================================================
async function pwOpenStudents() {
  triggerNavHaptic('light');
  pwCurrentSubView = 'students';
  await loadPrivateData();
  renderPWStudentsView();
}

function renderPWStudentsView(filterClass = 'all', searchText = '') {
  const container = document.getElementById('view-workspace');
  if (!container) return;
  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;

  let filtered = pwStudentsList;
  if (filterClass && filterClass !== 'all') {
    filtered = filtered.filter(s => (s.class || '').toLowerCase() === filterClass.toLowerCase());
  }
  if (searchText) {
    const q = searchText.toLowerCase();
    filtered = filtered.filter(s =>
      (s.name||'').toLowerCase().includes(q) ||
      String(s.studentId||'').toLowerCase().includes(q) ||
      (s.class||'').toLowerCase().includes(q)
    );
  }

  const classOptions = [`<option value="all">All Classes</option>`].concat(
    pwClassesList.map(c => `<option value="${escapeHtml(c.name)}" ${c.name === filterClass ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
  ).join('');

  container.innerHTML = `
    <div class="pw-animate-enter space-y-3">
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <button type="button" onclick="renderWorkspaceHub()" class="touch-btn px-2.5 py-1 rounded-xl bg-pink-100 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800 text-xs font-bold text-pink-700 dark:text-pink-300 hover:bg-pink-200 flex items-center gap-1 transition shadow-xs">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Workspace</span>
          </button>
          <div class="flex items-center gap-1.5">
            ${lockSVG('16')}
            <h2 class="text-base font-extrabold text-pink-800 dark:text-pink-200">My Students</h2>
          </div>
          <div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-pink-500 text-white text-xs font-semibold shadow-sm">
            <span>Total:</span><span class="font-black">${pwStudentsList.length}</span>
          </div>
        </div>
        <button onclick="pwOpenAddStudentModal()" class="touch-btn px-3.5 py-1.5 pw-gradient-btn text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md flex-shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Add Student</span>
        </button>
      </div>

      <!-- Class Filter Dropdown -->
      <select id="pw-student-class-filter" onchange="renderPWStudentsView(this.value, document.getElementById('pw-student-search').value)"
        class="touch-input w-full bg-white/80 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800 rounded-xl px-3 text-xs font-bold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400">
        ${classOptions}
      </select>

      <!-- Search -->
      <div class="relative">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" id="pw-student-search" value="${escapeHtml(searchText)}" placeholder="Search students..." oninput="renderPWStudentsView(document.getElementById('pw-student-class-filter').value, this.value)"
          class="touch-input w-full bg-white/80 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800 rounded-xl pl-9 pr-3 text-xs font-semibold text-pink-800 dark:text-pink-200 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400">
      </div>

      <!-- Students List -->
      <div class="space-y-2.5">
        ${filtered.length === 0
          ? `<div class="text-center py-12 text-pink-400 dark:text-pink-600">
               <svg class="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
               <p class="text-sm font-bold">${pwStudentsList.length === 0 ? 'No private students yet' : 'No students match filter'}</p>
               <p class="text-xs mt-1">${pwStudentsList.length === 0 ? 'Tap "Add Student" to enroll' : 'Try a different filter or search'}</p>
             </div>`
          : filtered.map(st => `
            <div class="bg-white/80 dark:bg-pink-950/30 rounded-2xl p-3 border border-pink-200 dark:border-pink-800 shadow-sm flex items-center gap-3">
              <img src="${(typeof isCustomPhoto === 'function' && isCustomPhoto(st.photoUrl)) ? escapeHtml(st.photoUrl) : getInitialsAvatar(st.name, 'db2777')}" class="w-10 h-10 rounded-xl object-cover border-2 border-pink-200 dark:border-pink-700 flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition" alt="${escapeHtml(st.name)}" onclick="openStudentDetailsModal('${escapeQuotes(String(st.studentId))}')" title="Click to view full student details">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1 flex-wrap">
                  ${lockSVG('12')}
                  <span class="text-sm font-black text-pink-800 dark:text-pink-200 truncate">${escapeHtml(st.name)}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-300 font-bold flex-shrink-0">${lockSVG('10')}${escapeHtml(String(st.studentId))}</span>
                </div>
                <div class="text-[11px] text-pink-500 mt-0.5">${escapeHtml(st.class)} • Roll #${st.roll}</div>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button onclick="pwEditStudent('${st._id}')" class="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300 flex items-center justify-center hover:bg-pink-200 active:scale-95 transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button onclick="pwDeleteStudent('${st._id}','${escapeQuotes(st.name)}')" class="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-100 active:scale-95 transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path></svg>
                </button>
              </div>
            </div>`).join('')}
      </div>
    </div>`;
}

// ================================================================

// CLASS CRUD
// ================================================================
function pwOpenAddClassModal() {
  document.getElementById('pw-modal-class').classList.remove('hidden');
  document.getElementById('pw-class-modal-title').textContent = 'Add Private Class';
  document.getElementById('pw-input-class-name').value = '';
  document.getElementById('pw-input-class-teacher').value = currentUser ? currentUser.name : '';
  pwEditClassId = null;
}

function pwCloseClassModal() {
  document.getElementById('pw-modal-class').classList.add('hidden');
  pwEditClassId = null;
}

function pwEditClass(id) {
  const cls = pwClassesList.find(c => c._id === id);
  if (!cls) return;
  pwEditClassId = id;
  document.getElementById('pw-modal-class').classList.remove('hidden');
  document.getElementById('pw-class-modal-title').textContent = 'Edit Private Class';
  document.getElementById('pw-input-class-name').value = cls.name;
  document.getElementById('pw-input-class-teacher').value = cls.classTeacher || '';
}

async function pwSaveClass(e) {
  e.preventDefault();
  const name = document.getElementById('pw-input-class-name').value.trim();
  const teacher = document.getElementById('pw-input-class-teacher').value.trim();
  if (!name) return showToast('Class name is required', true);
  try {
    if (pwEditClassId) {
      await API.request(`/classes/${pwEditClassId}`, { method: 'PUT', body: JSON.stringify({ name, classTeacher: teacher }) });
      showToast(`Class "${name}" updated!`);
    } else {
      await API.addPrivateClass(name, teacher, []);
      showToast(`Private class "${name}" created!`);
    }
    pwCloseClassModal();
    await loadPrivateData();
    renderPWClassesView();
  } catch (err) { showToast(err.message, true); }
}

async function pwDeleteClass(id, name) {
  if (!confirm(`Delete private class "${name}"? This cannot be undone.`)) return;
  try {
    await API.deleteClass(id);
    showToast(`Class "${name}" deleted`);
    await loadPrivateData();
    renderPWClassesView();
  } catch (err) { showToast(err.message, true); }
}


// ================================================================
// SUBJECT CRUD
// ================================================================
function pwOpenAddSubjectModal() {
  document.getElementById('pw-modal-subject').classList.remove('hidden');
  document.getElementById('pw-subject-modal-title').textContent = 'Add Private Subject';
  document.getElementById('pw-input-subject-name').value = '';
  document.getElementById('pw-input-subject-code').value = '';
  document.getElementById('pw-input-subject-teacher').value = currentUser ? currentUser.name : '';
  var selAdd = document.getElementById('pw-subject-class-select');
  if (selAdd) {
    selAdd.innerHTML = '<option value="">— No class (optional) —</option>';
    (pwClassesList || []).forEach(function(c) { var o = document.createElement('option'); o.value = c.name; o.textContent = c.name; selAdd.appendChild(o); });
    selAdd.value = '';
  }
  pwEditSubjectId = null;
}

function pwCloseSubjectModal() {
  document.getElementById('pw-modal-subject').classList.add('hidden');
  pwEditSubjectId = null;
}

function pwEditSubject(id) {
  const sub = pwSubjectsList.find(s => s._id === id);
  if (!sub) return;
  pwEditSubjectId = id;
  document.getElementById('pw-modal-subject').classList.remove('hidden');
  document.getElementById('pw-subject-modal-title').textContent = 'Edit Private Subject';
  document.getElementById('pw-input-subject-name').value = sub.name;
  document.getElementById('pw-input-subject-code').value = sub.subjectCode || '';
  document.getElementById('pw-input-subject-teacher').value = sub.teacher || '';
  var selEdit = document.getElementById('pw-subject-class-select');
  if (selEdit) {
    selEdit.innerHTML = '<option value="">— No class (optional) —</option>';
    (pwClassesList || []).forEach(function(c) { var o = document.createElement('option'); o.value = c.name; o.textContent = c.name; selEdit.appendChild(o); });
    selEdit.value = (sub.assignedClasses && sub.assignedClasses[0]) || '';
  }
}

async function pwSaveSubject(e) {
  e.preventDefault();
  const name = document.getElementById('pw-input-subject-name').value.trim();
  const code = document.getElementById('pw-input-subject-code').value.trim();
  const teacher = document.getElementById('pw-input-subject-teacher').value.trim();
  var pwSelVal = (document.getElementById('pw-subject-class-select') || {}).value || '';
  const assignedClasses = pwSelVal ? [pwSelVal] : [];
  if (!name) return showToast('Subject name is required', true);
  const data = { name, subjectCode: code, teacher, assignedClasses };
  try {
    if (pwEditSubjectId) {
      await API.updateSubject(pwEditSubjectId, data);
      showToast(`Subject "${name}" updated!`);
    } else {
      await API.addPrivateSubject(data);
      showToast(`Private subject "${name}" created!`);
    }
    pwCloseSubjectModal();
    await loadPrivateData();
    renderPWSubjectsView();
  } catch (err) { showToast(err.message, true); }
}

async function pwDeleteSubject(id, name) {
  if (!confirm(`Delete private subject "${name}"?`)) return;
  try {
    await API.deleteSubject(id);
    showToast(`Subject "${name}" deleted`);
    await loadPrivateData();
    renderPWSubjectsView();
  } catch (err) { showToast(err.message, true); }
}

// ================================================================
// STUDENT CRUD
// ================================================================

// PW photo state
let pwStudentPhotoUrl = '';

// Photo upload handler for PW student modal (reuses main app's compressImage + API.uploadPhoto)
async function pwHandlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    showToast('Processing photo...');
    const base64 = await compressImage(file, 500, 500, 0.82);
    pwStudentPhotoUrl = base64;
    const preview = document.getElementById('pw-preview-photo');
    if (preview) preview.src = base64;
    showToast('Saving to storage...');
    const uploadRes = await API.uploadPhoto(file, 'students');
    if (uploadRes && uploadRes.success && uploadRes.url) {
      pwStudentPhotoUrl = uploadRes.url;
      showToast('Photo saved!');
    } else {
      showToast('Photo selected!');
    }
  } catch (err) {
    showToast('Photo selected!');
  }
}

// Helper: reset all PW student modal fields
function pwHandleStudentNameInput() {
  if (pwStudentPhotoUrl) return;
  const nameInput = document.getElementById('pw-input-student-name');
  const preview = document.getElementById('pw-preview-photo');
  if (!nameInput || !preview) return;
  if (typeof getInitialsAvatar === 'function') {
    preview.src = getInitialsAvatar(nameInput.value.trim(), 'db2777');
  }
}

function pwResetStudentModal() {
  pwStudentPhotoUrl = '';
  const DEFAULT_PW_AVATAR = (typeof getInitialsAvatar === 'function')
    ? getInitialsAvatar('', 'db2777')
    : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23f9a8d4'%3E%3Cpath d='M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z'/%3E%3C/svg%3E";
  const preview = document.getElementById('pw-preview-photo');
  if (preview) preview.src = DEFAULT_PW_AVATAR;
  const fileInput = document.getElementById('pw-student-photo-file');
  if (fileInput) fileInput.value = '';
  ['pw-input-student-id','pw-input-student-name','pw-input-student-roll',
   'pw-input-student-address','pw-input-student-place','pw-input-student-district','pw-input-student-state',
   'pw-input-student-fatherName','pw-input-student-motherName',
   'pw-input-student-fatherMobile','pw-input-student-fatherWhatsapp',
   'pw-input-student-yearJoined','pw-input-student-rank','pw-input-student-previousCollege'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const dbId = document.getElementById('pw-input-student-db-id');
  if (dbId) dbId.value = '';
}

async function pwOpenAddStudentModal() {
  pwEditStudentObjId = null;
  document.getElementById('pw-student-modal-title').textContent = 'Add Private Student';
  pwResetStudentModal();
  // Auto-generate next P- ID
  try {
    const r = await API.getNextPrivateStudentId();
    document.getElementById('pw-input-student-id').value = r.nextId || 'P-101';
  } catch(_) {
    document.getElementById('pw-input-student-id').value = 'P-101';
  }
  document.getElementById('pw-input-student-id').readOnly = false;
  // Populate class dropdown with PW classes
  const cls = document.getElementById('pw-input-student-class');
  cls.innerHTML = pwClassesList.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('')
    || '<option value="">No classes — add one first</option>';
  document.getElementById('pw-modal-student').classList.remove('hidden');
}

async function pwEditStudent(id) {
  const st = pwStudentsList.find(s => s._id === id);
  if (!st) return;
  pwEditStudentObjId = id;
  document.getElementById('pw-student-modal-title').textContent = 'Edit Private Student';
  pwResetStudentModal();

  // Fill all fields
  document.getElementById('pw-input-student-db-id').value = id;
  document.getElementById('pw-input-student-id').value = String(st.studentId);
  document.getElementById('pw-input-student-id').readOnly = false;
  document.getElementById('pw-input-student-name').value = st.name || '';
  document.getElementById('pw-input-student-roll').value = st.roll || '';
  document.getElementById('pw-input-student-address').value = st.address || '';
  document.getElementById('pw-input-student-place').value = st.place || '';
  document.getElementById('pw-input-student-district').value = st.district || '';
  document.getElementById('pw-input-student-state').value = st.state || '';
  document.getElementById('pw-input-student-fatherName').value = st.fatherName || '';
  document.getElementById('pw-input-student-motherName').value = st.motherName || '';
  document.getElementById('pw-input-student-fatherMobile').value = st.fatherMobile || '';
  document.getElementById('pw-input-student-fatherWhatsapp').value = st.fatherWhatsapp || '';
  document.getElementById('pw-input-student-yearJoined').value = st.yearJoined || '';
  document.getElementById('pw-input-student-rank').value = st.rank || '';
  document.getElementById('pw-input-student-previousCollege').value = st.previousCollege || '';

  // Load existing photo
  if (st.photoUrl && (typeof isCustomPhoto !== 'function' || isCustomPhoto(st.photoUrl))) {
    pwStudentPhotoUrl = st.photoUrl;
    const preview = document.getElementById('pw-preview-photo');
    if (preview) preview.src = st.photoUrl;
  } else {
    pwStudentPhotoUrl = '';
    const preview = document.getElementById('pw-preview-photo');
    if (preview && typeof getInitialsAvatar === 'function') {
      preview.src = getInitialsAvatar(st.name, 'db2777');
    }
  }

  // Populate class dropdown
  const cls = document.getElementById('pw-input-student-class');
  cls.innerHTML = pwClassesList.map(c =>
    `<option value="${escapeHtml(c.name)}" ${isClassEqual(c.name, st.class) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('') || '<option value="">No classes</option>';

  document.getElementById('pw-modal-student').classList.remove('hidden');
}

function pwCloseStudentModal() {
  document.getElementById('pw-modal-student').classList.add('hidden');
  pwEditStudentObjId = null;
  pwStudentPhotoUrl = '';
}

async function pwSaveStudent(e) {
  e.preventDefault();
  const studentId   = document.getElementById('pw-input-student-id').value.trim();
  const name        = document.getElementById('pw-input-student-name').value.trim();
  const roll        = document.getElementById('pw-input-student-roll').value.trim();
  const cls         = document.getElementById('pw-input-student-class').value;
  const address     = document.getElementById('pw-input-student-address').value.trim();
  const place       = document.getElementById('pw-input-student-place').value.trim();
  const district    = document.getElementById('pw-input-student-district').value.trim();
  const state       = document.getElementById('pw-input-student-state').value.trim();
  const fatherName  = document.getElementById('pw-input-student-fatherName').value.trim();
  const motherName  = document.getElementById('pw-input-student-motherName').value.trim();
  const fatherMobile    = document.getElementById('pw-input-student-fatherMobile').value.trim();
  const fatherWhatsapp  = document.getElementById('pw-input-student-fatherWhatsapp').value.trim();
  const yearJoined      = document.getElementById('pw-input-student-yearJoined').value.trim();
  const rank            = document.getElementById('pw-input-student-rank').value.trim();
  const previousCollege = document.getElementById('pw-input-student-previousCollege').value.trim();

  if (!name) return showToast('Student name is required', true);
  if (!cls)  return showToast('Please select a class', true);
  if (!studentId) return showToast('Student ID is required', true);

  // Frontend duplicate check
  const dup = pwStudentsList.find(s =>
    String(s.studentId).toLowerCase() === studentId.toLowerCase() &&
    s._id !== pwEditStudentObjId
  );
  if (dup) return showToast(`ID "${studentId}" already exists in your workspace!`, true);

  const payload = {
    name, class: cls, roll, studentId,
    photoUrl: pwStudentPhotoUrl || undefined,
    address, place, district, state,
    fatherName, motherName, fatherMobile, fatherWhatsapp,
    yearJoined, rank, previousCollege
  };

  try {
    if (pwEditStudentObjId) {
      await API.updateStudent(pwEditStudentObjId, payload);
      showToast(`Student "${name}" updated!`);
    } else {
      await API.addPrivateStudent(payload);
      showToast(`Private student "${name}" enrolled as ${studentId}!`);
    }
    pwCloseStudentModal();
    await loadPrivateData();
    renderPWStudentsView();
  } catch (err) { showToast(err.message, true); }
}

async function pwDeleteStudent(id, name) {
  if (!confirm(`Delete private student "${name}"?`)) return;
  try {
    await API.deleteStudent(id);
    showToast(`Student "${name}" deleted`);
    await loadPrivateData();
    renderPWStudentsView();
  } catch (err) { showToast(err.message, true); }
}

// ================================================================
// DASHBOARD CAMPUS OVERVIEW: exclude private students & classes
// ================================================================
async function loadDashboardStatsPublicOnly() {
  // This patches the existing loadDashboardStats to exclude private data
  try {
    const stEl = document.getElementById('dash-stat-students');
    const stInEl = document.getElementById('dash-stat-students-in');
    const stOutEl = document.getElementById('dash-stat-students-out');
    const clEl = document.getElementById('dash-stat-classes');
    const clMarkedEl = document.getElementById('dash-stat-classes-marked');
    const tcEl = document.getElementById('dash-stat-teachers');
    const tcActEl = document.getElementById('dash-stat-teachers-active');

    // Public classes only (no private)
    const publicClasses = (classesList || []).filter(c => !c.isPrivate);
    if (clEl) clEl.textContent = String(publicClasses.length);

    // Public students only
    try {
      const res = await API.getPublicStudents('all');
      const studentData = (res && res.success && Array.isArray(res.data)) ? res.data : [];
      const totalStudents = studentData.length;
      if (stEl) stEl.textContent = String(totalStudents);

      // Calculate In/Out from today's attendance
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      try {
        const attRes = await fetch(`/api/attendance?date=${todayStr}&scope=public`, {
          headers: { 'Authorization': `Bearer ${API.getToken()}` }
        });
        const attData = await attRes.json();
        const records = Array.isArray(attData.data) ? attData.data : [];
        const markedClasses = new Set(records.map(r => (r.class||'').toLowerCase()));
        if (clMarkedEl) clMarkedEl.textContent = `${markedClasses.size} Marked`;

        let inCount = 0;
        let outCount = 0;
        for (const rec of records) {
          if (rec.records) {
            inCount += rec.records.filter(r => r.status === 'P').length;
            outCount += rec.records.filter(r => r.status === 'A' || r.status === 'L').length;
          }
        }
        // If no attendance taken today, all are "out"
        if (records.length === 0) {
          inCount = 0;
          outCount = totalStudents;
        }
        if (stInEl) stInEl.textContent = `${inCount} In`;
        if (stOutEl) stOutEl.textContent = `${outCount} Out`;
      } catch(_) {
        if (clMarkedEl) clMarkedEl.textContent = '0 Marked';
        if (stInEl) stInEl.textContent = '0 In';
        if (stOutEl) stOutEl.textContent = `${totalStudents} Out`;
      }
    } catch(_) {}

    // Teachers
    let teacherCount = (cachedTeachersList || []).length;
    if (teacherCount === 0) {
      try {
        const tRes = await API.getTeachers();
        if (tRes && tRes.success && Array.isArray(tRes.data)) {
          cachedTeachersList = tRes.data;
          teacherCount = tRes.data.length;
        }
      } catch(_) {}
    }
    if (tcEl) tcEl.textContent = String(teacherCount);
    if (tcActEl) tcActEl.textContent = '100% Active';
  } catch(e) {
    console.error('[Workspace] Dashboard stats error:', e);
  }
}

// ================================================================
// LOCK ICON: inject lock badges in main classes/subjects/students lists
// ================================================================
function injectPrivateLockBadges() {
  // Classes list: add lock icon to private class cards
  if (Array.isArray(classesList)) {
    classesList.forEach(cls => {
      if (!cls.isPrivate) return;
      // Find cards by scanning DOM for class name
      const cards = document.querySelectorAll('#class-cards-container [data-class-id]');
      cards.forEach(card => {
        if (card.dataset.classId === cls._id && !card.querySelector('.private-lock-badge')) {
          const badge = document.createElement('span');
          badge.className = 'private-lock-badge';
          badge.innerHTML = lockSVG('12');
          badge.title = 'Private Class';
          const title = card.querySelector('[data-class-name]') || card.querySelector('.class-name');
          if (title) title.prepend(badge);
        }
      });
    });
  }
}

// ================================================================
// Notifications badge: update BOTH header and messages card badge
// ================================================================
function updateNotifBadge(count) {
  // Header badge (always visible)
  const headerBadge = document.getElementById('header-unread-msg-badge');
  if (headerBadge) {
    if (count > 0) {
      headerBadge.textContent = count > 9 ? '9+' : String(count);
      headerBadge.classList.remove('hidden');
      headerBadge.classList.add('badge-jump');
      headerBadge.style.display = 'flex';
    } else {
      headerBadge.classList.add('hidden');
      headerBadge.style.display = '';
    }
  }
}

console.log('[PersonalWorkspace] Module loaded');
