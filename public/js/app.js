// Main Application Controller for REGISTERLY
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z'/%3E%3C/svg%3E";
let currentUser = null;
let currentRole = 'admin'; // 'admin' or 'teacher'
let isDarkMode = false;

// In-memory active data
let classesList = [];
let subjectsList = [];
let studentsList = [];
let attendanceRecords = []; // [{ studentId, status, note }]
function formatLocalDate(d = new Date()) {
  const dateObj = (d instanceof Date && !isNaN(d)) ? d : new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let currentDateStr = formatLocalDate(new Date());
let currentClass = 'Class 10';
let currentSubject = '';
let attendanceReadyToLoad = false; // Deferred attendance: false on init until class/subject selected
let reportReadyToLoad = false;     // Deferred report: false on init until class/subject selected

// Universal Case-Insensitive String / Class Comparison Helper
function isClassEqual(a, b) {
  if (a === b) return true;
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function classListIncludes(arr, className) {
  if (!Array.isArray(arr) || !className) return false;
  const target = String(className).trim().toLowerCase();
  return arr.some(item => String(item || '').trim().toLowerCase() === target);
}

// Sanitization Helpers
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeQuotes(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

let appSettings = { appName: 'REGISTERLY', schoolName: '', allowNonAdminEditDelete: false, showTeachersTabToAll: true };

function canViewTeachersTab() {
  if (currentUser && currentUser.role === 'admin') return true;
  return Boolean(appSettings && appSettings.showTeachersTabToAll !== false);
}

function canUserEditDelete() {
  if (currentUser && currentUser.role === 'admin') return true;
  return Boolean(appSettings && appSettings.allowNonAdminEditDelete);
}

// Vibration & Audio Haptic Feedback for Navbars & Interactive Controls
let hapticAudioCtx = null;

function primeHaptics() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass && !hapticAudioCtx) {
      hapticAudioCtx = new AudioContextClass();
    }
    if (hapticAudioCtx && hapticAudioCtx.state === 'suspended') {
      hapticAudioCtx.resume();
    }
  } catch (e) {}
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', primeHaptics, { once: true, passive: true });
  window.addEventListener('touchstart', primeHaptics, { once: true, passive: true });
}

function triggerNavHaptic(intensity = 'medium') {
  // 1. Hardware vibration for mobile devices supporting navigator.vibrate (Android Chrome, Firefox, Opera, Edge)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (typeof intensity === 'number') {
        navigator.vibrate(intensity);
      } else if (intensity === 'delete' || intensity === 'danger') {
        // Strong double heavy pulse for delete / destructive actions
        navigator.vibrate([100, 50, 100]);
      } else if (intensity === 'strong' || intensity === 'success') {
        navigator.vibrate([60, 35, 60]);
      } else if (intensity === 'light' || intensity === 'tap') {
        navigator.vibrate(30);
      } else {
        // 'medium' default for nav tabs
        navigator.vibrate([45, 30, 45]);
      }
    }
  } catch (e) {}

  // 2. Synthesized audio haptic impulse (crisp tactile click) for iOS & desktop browsers
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      if (!hapticAudioCtx) {
        hapticAudioCtx = new AudioContextClass();
      }
      if (hapticAudioCtx.state === 'suspended') {
        hapticAudioCtx.resume();
      }
      const osc = hapticAudioCtx.createOscillator();
      const gain = hapticAudioCtx.createGain();

      let freqStart = 180;
      let freqEnd = 35;
      let duration = 0.035;
      let vol = 0.28;

      if (intensity === 'delete' || intensity === 'danger') {
        freqStart = 95;
        freqEnd = 25;
        duration = 0.055;
        vol = 0.38;
      } else if (intensity === 'light' || intensity === 'tap') {
        freqStart = 230;
        freqEnd = 50;
        duration = 0.025;
        vol = 0.22;
      } else if (intensity === 'strong' || intensity === 'success') {
        freqStart = 250;
        freqEnd = 50;
        duration = 0.045;
        vol = 0.32;
      }

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freqStart, hapticAudioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, hapticAudioCtx.currentTime + duration);
      gain.gain.setValueAtTime(vol, hapticAudioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, hapticAudioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(hapticAudioCtx.destination);
      osc.start();
      osc.stop(hapticAudioCtx.currentTime + duration);
    }
  } catch (e) {}
}

// Student Form Fields Configuration (Configurable in Admin Panel)
const DEFAULT_STUDENT_FORM_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', size: 'half', required: true, enabled: true, isCustom: false },
  { key: 'class', label: 'Class', type: 'select', size: 'half', required: true, enabled: true, isCustom: false },
  { key: 'roll', label: 'Roll No', type: 'number', size: 'half', required: true, enabled: true, isCustom: false },
  { key: 'address', label: 'Address', type: 'text', size: 'full', required: false, enabled: true, isCustom: false },
  { key: 'place', label: 'Place', type: 'text', size: 'half', required: false, enabled: true, isCustom: false },
  { key: 'district', label: 'District', type: 'text', size: 'half', required: false, enabled: true, isCustom: false },
  { key: 'state', label: 'State', type: 'text', size: 'half', required: false, enabled: true, isCustom: false },
  { key: 'fatherName', label: "Father's Name", type: 'text', size: 'half', required: false, enabled: true, isCustom: false },
  { key: 'motherName', label: "Mother's Name", type: 'text', size: 'half', required: false, enabled: true, isCustom: false },
  { key: 'fatherMobile', label: "Father Mobile (Normal)", type: 'tel', size: 'half', required: false, enabled: true, isCustom: false },
  { key: 'fatherWhatsapp', label: "WhatsApp Number", type: 'tel', size: 'half', required: false, enabled: true, isCustom: false },
  { key: 'yearJoined', label: "Year Joined College", type: 'number', size: 'half', required: false, enabled: true, isCustom: false },
  { key: 'rank', label: "Rank", type: 'text', size: 'half', required: false, enabled: true, isCustom: false },
  { key: 'previousCollege', label: "Previous College", type: 'text', size: 'half', required: false, enabled: true, isCustom: false }
];

let appStudentFormFields = JSON.parse(JSON.stringify(DEFAULT_STUDENT_FORM_FIELDS));

function hideSplashLoader() {
  const loader = document.getElementById('app-splash-loader');
  if (loader) {
    loader.classList.add('splash-fade-out');
    setTimeout(() => {
      loader.style.display = 'none';
    }, 450);
  }
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initServiceWorker();
  updateDateDisplay();
  selectTopTab('attendance');
  try {
    await initGoogleAuth();
    await loadCurrentUser();
    if (currentUser) {
      await loadAppSettings();
      await loadClasses();
      await loadSubjects();
      await loadTeachersData();
      renderAttendancePlaceholder(); // Deferred: Show placeholder on initial load instead of auto-loading roster

      // Set default year and month to current date for reports
      const initDate = new Date();
      const repYearEl = document.getElementById('report-year');
      const repPeriodEl = document.getElementById('report-period');
      if (repYearEl) repYearEl.value = initDate.getFullYear().toString();
      if (repPeriodEl) repPeriodEl.value = 'all-year'; // Default to "All Months"
      renderReportPlaceholder(); // Deferred: Show placeholder on initial load instead of auto-loading report

      await loadActivityLogs();
      await checkUnreadMessages();
      _applyTeachersTabVisibility();
      initTimetableNotificationScheduler();
    }
  } catch (err) {
    console.error('[App Init Error]', err);
  } finally {
    hideSplashLoader();
    // Poll for new messages every 60 seconds
    setInterval(checkUnreadMessages, 60000);
  }
});

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.classList.remove('hidden');
  const card = document.getElementById('settings-install-card');
  if (card) card.classList.remove('hidden');
});

async function triggerPwaInstall() {
  if (!deferredPrompt) {
    showToast('To install in Chrome, open menu (☰) > "Install app" or "Add to Home screen"');
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    showToast('Installing REGISTERLY...');
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.classList.add('hidden');
    const card = document.getElementById('settings-install-card');
    if (card) card.classList.add('hidden');
  }
  deferredPrompt = null;
}

window.addEventListener('appinstalled', () => {
  showToast('REGISTERLY installed as a native app!');
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.classList.add('hidden');
  const card = document.getElementById('settings-install-card');
  if (card) card.classList.add('hidden');
  deferredPrompt = null;
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('[SW Registration Error]', err);
    });
  }
}

// Toast helper
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  if (!toast || !toastText) return;

  toastText.innerText = message;
  toast.classList.remove('-translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('-translate-y-20', 'opacity-0');
  }, 2800);
}

// ================= USER & AUTHENTICATION =================
async function loadCurrentUser() {
  const token = API.getToken();
  if (token) {
    try {
      const res = await API.getMe();
      if (res.success && res.user) {
        currentUser = res.user;
        currentRole = currentUser.role;
        updateUserUI();
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.classList.add('hidden');
        checkAndTriggerTimetableNotifications();
        return;
      }
    } catch (error) {
      console.log('[Auth Token Expired or Invalid]', error);
      API.setToken(null);
    }
  }

  // Not authenticated: prompt user to sign in
  currentUser = null;
  currentRole = null;
  updateUserUI();
  openAuthModal();
}

function updateUserUI() {
  const headerName = document.getElementById('header-profile-name');
  const headerRole = document.getElementById('header-profile-role');
  const headerAvatar = document.getElementById('user-avatar-img');

  if (!currentUser) {
    if (headerName) headerName.innerText = 'Sign In';
    if (headerRole) headerRole.innerText = 'Guest';
    if (headerAvatar) headerAvatar.src = DEFAULT_AVATAR;

    const settingsName = document.getElementById('settings-name-display');
    const settingsEmail = document.getElementById('settings-email-display');
    const settingsRole = document.getElementById('settings-role-badge');
    const settingsAvatar = document.getElementById('settings-avatar-img');
    if (settingsName) settingsName.innerText = 'Not Signed In';
    if (settingsEmail) settingsEmail.innerText = 'Please sign in to manage school';
    if (settingsRole) {
      settingsRole.innerText = 'Guest Mode';
      settingsRole.classList.remove('hidden');
    }
    if (settingsAvatar) settingsAvatar.src = DEFAULT_AVATAR;

    const adminSection = document.getElementById('admin-settings-section');
    if (adminSection) adminSection.classList.add('hidden');
    return;
  }

  // Header Profile
  if (headerName) headerName.innerText = currentUser.name || 'User';
  if (headerRole) headerRole.innerText = currentUser.role === 'admin' ? 'Admin' : 'Teacher';
  if (headerAvatar) headerAvatar.src = currentUser.avatarUrl || DEFAULT_AVATAR;

  // Settings Card
  const settingsName = document.getElementById('settings-name-display');
  const settingsEmail = document.getElementById('settings-email-display');
  const settingsRole = document.getElementById('settings-role-badge');
  const settingsAvatar = document.getElementById('settings-avatar-img');
  if (settingsName) settingsName.innerText = currentUser.name || 'User';
  if (settingsEmail) settingsEmail.innerText = currentUser.email || 'No email linked';
  if (settingsRole) {
    settingsRole.innerText = currentUser.role === 'admin' ? 'Admin (First Account)' : 'Teacher';
    settingsRole.classList.remove('hidden');
  }
  if (settingsAvatar) settingsAvatar.src = currentUser.avatarUrl || DEFAULT_AVATAR;

  // Visibility based on Role:
  const adminSection = document.getElementById('admin-settings-section');
  if (adminSection) {
    if (currentUser.role === 'admin') {
      adminSection.classList.remove('hidden');
    } else {
      adminSection.classList.add('hidden');
    }
  }

  // Reload activity logs & profile dashboard stats
  loadActivityLogs();
  updateProfileDashboardKPIs();
}

// Dark Mode Toggle with Sun SVG & persistent storage
function initTheme() {
  try {
    const savedTheme = localStorage.getItem('app_theme');
    // Default theme is light; only activate dark if user explicitly chose it
    isDarkMode = savedTheme === 'dark';
    const body = document.getElementById('app-body');
    if (isDarkMode) {
      body?.classList.add('dark-mode');
      document.documentElement.classList.add('dark');
    } else {
      body?.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark');
    }
  } catch (_) {}
}

function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  const body = document.getElementById('app-body');
  if (isDarkMode) {
    body?.classList.add('dark-mode');
    document.documentElement.classList.add('dark');
    try { localStorage.setItem('app_theme', 'dark'); } catch(_) {}
    showToast('Dark Mode Activated');
  } else {
    body?.classList.remove('dark-mode');
    document.documentElement.classList.remove('dark');
    try { localStorage.setItem('app_theme', 'light'); } catch(_) {}
    showToast('Light Mode Activated');
  }
  renderGoogleButton();
}

// ================= APP SETTINGS (App Name & School Name) =================
function updateHeaderBranding(appName, schoolName) {
  const appEl = document.getElementById('header-app-name');
  const schoolEl = document.getElementById('school-name-display');
  const rawApp = (appName !== undefined && appName !== null ? String(appName) : '').trim();
  const rawSchool = (schoolName !== undefined && schoolName !== null ? String(schoolName) : '').trim();

  // Keep localStorage and splash branding in sync with admin update
  try {
    localStorage.setItem('registerly_app_name', rawApp || 'REGISTERLY');
    const splashName = document.getElementById('splash-app-name');
    const splashLetter = document.getElementById('splash-icon-letter');
    const brandIcon = document.getElementById('header-brand-icon');
    const firstLetter = (rawApp ? rawApp.trim()[0] : 'R').toUpperCase();
    if (splashName) splashName.textContent = rawApp || 'REGISTERLY';
    if (splashLetter) splashLetter.textContent = firstLetter;
    if (brandIcon) brandIcon.textContent = firstLetter;
  } catch (e) {}

  if (!rawApp && !rawSchool) {
    if (appEl) {
      appEl.innerText = '';
      appEl.classList.add('hidden');
    }
    if (schoolEl) {
      schoolEl.innerText = '';
      schoolEl.classList.add('hidden');
    }
  } else if (rawApp && !rawSchool) {
    if (appEl) {
      appEl.innerText = rawApp;
      appEl.className = "font-black text-xl sm:text-2xl tracking-wider text-white leading-normal truncate";
      appEl.classList.remove('hidden');
    }
    if (schoolEl) {
      schoolEl.innerText = '';
      schoolEl.classList.add('hidden');
    }
  } else if (!rawApp && rawSchool) {
    if (appEl) {
      appEl.innerText = '';
      appEl.classList.add('hidden');
    }
    if (schoolEl) {
      schoolEl.innerText = rawSchool;
      schoolEl.className = "font-extrabold text-base sm:text-lg tracking-wide text-white leading-normal truncate";
      schoolEl.classList.remove('hidden');
    }
  } else {
    if (appEl) {
      appEl.innerText = rawApp;
      appEl.className = "font-black text-base sm:text-lg tracking-wider text-white leading-tight truncate";
      appEl.classList.remove('hidden');
    }
    if (schoolEl) {
      schoolEl.innerText = rawSchool;
      schoolEl.className = "text-[11px] text-teal-100 font-medium leading-tight truncate";
      schoolEl.classList.remove('hidden');
    }
  }
}

async function loadAppSettings() {
  try {
    const res = await API.getAdminSettings();
    if (res.success && res.data) {
      appSettings = res.data;
      const appName = res.data.appName !== undefined ? res.data.appName : '';
      const schoolName = res.data.schoolName !== undefined ? res.data.schoolName : '';
      updateHeaderBranding(appName, schoolName);

      const adminAppInput = document.getElementById('admin-input-app-name');
      const adminSchoolInput = document.getElementById('admin-input-school-name');
      if (adminAppInput) adminAppInput.value = appName;
      if (adminSchoolInput) adminSchoolInput.value = schoolName;

      const toggleEl = document.getElementById('admin-toggle-edit-delete');
      if (toggleEl) {
        toggleEl.checked = Boolean(res.data.allowNonAdminEditDelete);
      }
      const ttToggle = document.getElementById('admin-toggle-teachers-tab');
      if (ttToggle) {
        ttToggle.checked = res.data.showTeachersTabToAll !== false;
      }
      _applyTeachersTabVisibility();

      const printToggle = document.getElementById('admin-toggle-student-print');
      if (printToggle) {
        printToggle.checked = res.data.allowStudentDetailsPrint !== false;
      }
      _applyStudentPrintButtonVisibility();

      if (Array.isArray(res.data.studentFormFields) && res.data.studentFormFields.length > 0) {
        appStudentFormFields = res.data.studentFormFields;
      } else {
        appStudentFormFields = JSON.parse(JSON.stringify(DEFAULT_STUDENT_FORM_FIELDS));
      }
    }
  } catch (error) {
    console.log('[Settings Load]', error);
  }
}

function _applyTeachersTabVisibility() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  const canSee = canViewTeachersTab();
  const btn = document.getElementById('bottom-tab-teachers');
  if (btn) btn.style.display = (isAdmin || canSee) ? '' : 'none';
  // If currently on teachers tab but no longer allowed, redirect to classes
  if (!canSee && !isAdmin) {
    const teacherView = document.getElementById('view-teachers');
    if (teacherView && !teacherView.classList.contains('hidden')) {
      selectBottomTab('classes');
    }
  }
}

async function handleAdminToggleTeachersTab(enabled) {
  try {
    // Use a generic settings update - we need a backend field
    // For now store in appSettings locally and via API
    const res = await API.updateAdminSettings(
      appSettings.appName,
      appSettings.schoolName,
      { showTeachersTabToAll: enabled }
    );
    if (res.success) {
      if (appSettings) appSettings.showTeachersTabToAll = enabled;
      _applyTeachersTabVisibility();
      showToast(enabled ? 'Teachers tab visible to all users' : 'Teachers tab hidden for non-admin accounts');
    }
  } catch (error) {
    showToast('Failed: ' + error.message, true);
    const toggle = document.getElementById('admin-toggle-teachers-tab');
    if (toggle) toggle.checked = !enabled;
  }
}

async function handleAdminToggleEditDelete(enabled) {
  try {
    const res = await API.toggleEditDeleteAccess(enabled);
    if (res.success) {
      if (appSettings) {
        appSettings.allowNonAdminEditDelete = Boolean(res.allowNonAdminEditDelete);
      }
      showToast(res.allowNonAdminEditDelete ? 'Edit & Delete buttons visible to all users' : 'Edit & Delete buttons hidden for non-admin accounts');
      // Refresh views so buttons appear/disappear immediately
      renderClassesList();
      renderSubjectsList();
      renderStudentsDirectory();
      renderTeachersList();
    }
  } catch (error) {
    showToast(error.message, true);
    const toggleEl = document.getElementById('admin-toggle-edit-delete');
    if (toggleEl) toggleEl.checked = !enabled;
  }
}

async function saveAdminSchoolSettings() {
  try {
    const appName = document.getElementById('admin-input-app-name').value;
    const schoolName = document.getElementById('admin-input-school-name').value;
    const res = await API.updateAdminSettings(appName, schoolName);
    if (res.success) {
      showToast('App Name and School Name updated!');
      await loadAppSettings();
      closeAdminPanel();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// ================= CLASSES =================
async function loadClasses() {
  try {
    const res = await API.getClasses();
    if (res.success) {
      classesList = res.data;
      populateClassDropdowns();
      renderClassesList();
    }
  } catch (error) {
    console.log('[Classes Load]', error);
  }
}

function populateClassDropdowns() {
  const selClass = document.getElementById('sel-class');
  const repClass = document.getElementById('report-class');
  const studentFilter = document.getElementById('student-class-filter');
  const editStudentClass = document.getElementById('edit-student-class');
  const newStudentClass = document.getElementById('new-student-class');

  const optionsHtml = classesList.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

  if (selClass) {
    const placeholderOpt = `<option value="" disabled selected>Select Class</option>`;
    selClass.innerHTML = placeholderOpt + optionsHtml;
    // Don't auto-set currentClass on initial load; wait for user selection
  }
  if (repClass) {
    const placeholderOpt = `<option value="" disabled selected>Select Class</option>`;
    repClass.innerHTML = placeholderOpt + optionsHtml;
  }
  if (studentFilter) {
    studentFilter.innerHTML = `<option value="all">All Classes</option>` + optionsHtml;
  }
  if (editStudentClass) editStudentClass.innerHTML = optionsHtml;
  if (newStudentClass) newStudentClass.innerHTML = optionsHtml;

  const addSubModal = document.getElementById('modal-add-subject');
  if (addSubModal && !addSubModal.classList.contains('hidden')) {
    renderClassCheckboxes('add-sub-classes-container', getSelectedClassCheckboxes('add-sub-classes-container'));
  }
  const editSubModal = document.getElementById('modal-edit-subject');
  if (editSubModal && !editSubModal.classList.contains('hidden')) {
    renderClassCheckboxes('edit-sub-classes-container', getSelectedClassCheckboxes('edit-sub-classes-container'));
  }
}

// Drag & Drop Sorting for Classes
let draggedClassIndex = null;

function handleClassDragStart(e, index) {
  draggedClassIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}

function handleClassDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.currentTarget;
  if (!item.classList.contains('drag-over')) {
    item.classList.add('drag-over');
  }
}

function handleClassDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleClassDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('#class-cards-container .drag-item').forEach(el => el.classList.remove('drag-over'));
}

async function handleClassDrop(e, targetIndex) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (draggedClassIndex === null || draggedClassIndex === targetIndex) return;

  const movedClass = classesList.splice(draggedClassIndex, 1)[0];
  classesList.splice(targetIndex, 0, movedClass);
  draggedClassIndex = null;

  renderClassesList();
  populateClassDropdowns();

  try {
    const orderedIds = classesList.map(c => c._id);
    await API.reorderClasses(orderedIds);
    showToast('Class order updated!');
  } catch (err) {
    console.error('[Reorder Classes Error]', err);
  }
}

function renderClassesList() {
  const container = document.getElementById('class-cards-container');
  if (!container) return;

  if (classesList.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No classes added yet. Click "Add Class" to create one.</div>`;
    return;
  }

  container.innerHTML = classesList.map((c, index) => {
    const subjectPills = (c.assignedSubjects && c.assignedSubjects.length > 0)
      ? c.assignedSubjects.map(sub => `<span class="subject-chip" title="${escapeHtml(sub)}"><span class="w-1.5 h-1.5 rounded-full bg-[#245b70] dark:bg-teal-400 flex-shrink-0"></span><span>${escapeHtml(sub)}</span></span>`).join('')
      : `<span class="text-xs text-[var(--text-sub)] italic">No subjects assigned</span>`;

    const actionBtns = canUserEditDelete() ? `
      <div class="flex items-center gap-1.5 flex-shrink-0 ml-auto pl-2">
        <button onclick="openEditClassModal('${c._id}')" title="Edit Class" class="w-8 h-8 rounded-xl bg-white/20 hover:bg-white hover:text-[#245b70] text-white flex items-center justify-center transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button onclick="deleteClass('${c._id}', '${escapeQuotes(c.name)}')" title="Delete Class" class="w-8 h-8 rounded-xl bg-rose-500/70 hover:bg-rose-600 text-white flex items-center justify-center transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>` : '';

    return `
    <div class="drag-item rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden hover:shadow-md transition-shadow"
         draggable="true"
         ondragstart="handleClassDragStart(event, ${index})"
         ondragover="handleClassDragOver(event, ${index})"
         ondragleave="handleClassDragLeave(event)"
         ondragend="handleClassDragEnd(event)"
         ondrop="handleClassDrop(event, ${index})">
      <div class="custom-gradient-header px-3.5 py-3 flex items-center gap-2.5">
        <div class="text-white/50 hover:text-white cursor-grab active:cursor-grabbing flex-shrink-0" title="Drag to reorder">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="font-black text-white text-sm leading-tight truncate">${escapeHtml(c.name)}</h3>
          <p class="text-white/70 text-[11px] font-semibold truncate mt-0.5">Class Teacher: <span class="text-white/90">${escapeHtml(c.classTeacher || 'Not assigned')}</span></p>
        </div>
        ${actionBtns}
      </div>
      <div class="bg-[var(--card-bg)] px-3.5 py-2.5">
        <p class="text-[10px] font-extrabold text-[var(--text-sub)] uppercase tracking-wider mb-1.5">Assigned Subjects</p>
        <div class="flex flex-wrap gap-1.5">${subjectPills}</div>
      </div>
    </div>`;
  }).join('');
}

let activeEditClassId = null;
async function openEditClassModal(id) {
  activeEditClassId = id;
  const cls = (classesList || []).find(c => c._id === id);
  if (!cls) return;

  const nameInput = document.getElementById('edit-class-name');
  if (nameInput) nameInput.value = cls.name;
  await populateTeacherDropdowns('edit-class-teacher', cls.classTeacher || '');
  renderSubjectCheckboxesForClass('edit-class-subjects-container', cls.assignedSubjects || []);

  const modal = document.getElementById('modal-edit-class');
  if (modal) modal.classList.remove('hidden');
}

function closeEditClassModal() {
  const modal = document.getElementById('modal-edit-class');
  if (modal) modal.classList.add('hidden');
  activeEditClassId = null;
}

async function handleUpdateClass(e) {
  e.preventDefault();
  if (!activeEditClassId) return;

  const name = document.getElementById('edit-class-name').value.trim();
  const classTeacher = document.getElementById('edit-class-teacher').value.trim();
  const assignedSubjects = getSelectedSubjectCheckboxesForClass('edit-class-subjects-container');

  try {
    const res = await API.updateClass(activeEditClassId, name, classTeacher, assignedSubjects);
    if (res.success) {
      showToast(`Class "${name}" updated!`);
      closeEditClassModal();
      await loadClasses();
      updateAttendanceSubjectsDropdown(currentClass);
      await loadAttendanceRoster();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

async function handleSaveClass(e) {
  e.preventDefault();
  const name = document.getElementById('input-class-name').value.trim();
  const classTeacher = document.getElementById('input-class-teacher').value.trim();
  const assignedSubjects = getSelectedSubjectCheckboxesForClass('add-class-subjects-container');
  try {
    const res = await API.addClass(name, classTeacher, assignedSubjects);
    if (res.success) {
      showToast(`Class "${name}" added!`);
      closeClassModal();
      document.getElementById('input-class-name').value = '';
      document.getElementById('input-class-teacher').value = '';
      await loadClasses();
      updateAttendanceSubjectsDropdown(currentClass);
      await loadAttendanceRoster();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteClass(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
  triggerNavHaptic('delete');
  try {
    const res = await API.deleteClass(id);
    if (res.success) {
      showToast(`Class "${name}" deleted`);
      await loadClasses();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// ================= SUBJECTS =================
async function loadSubjects() {
  try {
    const res = await API.getSubjects();
    if (res.success) {
      subjectsList = res.data;
      populateSubjectDropdowns();
      renderSubjectsList();
    }
  } catch (error) {
    console.log('[Subjects Load]', error);
  }
}

function getAppropriateSubjectsForClass(className) {
  if (!className || !subjectsList || subjectsList.length === 0) return [];
  const cls = (classesList || []).find(c => isClassEqual(c.name, className));
  if (cls && Array.isArray(cls.assignedSubjects) && cls.assignedSubjects.length > 0) {
    const matched = subjectsList.filter(s => cls.assignedSubjects.some(sub => isClassEqual(sub, s.name)));
    if (matched.length > 0) {
      return matched;
    }
  }
  return subjectsList;
}

function updateAttendanceSubjectsDropdown(selectedClass) {
  const selSubject = document.getElementById('sel-subject');
  if (!selSubject) return;

  // Show placeholder if attendance is not ready (initial load)
  if (!attendanceReadyToLoad) {
    selSubject.innerHTML = `<option value="" disabled selected>Select Subject</option>`;
    return;
  }

  const validSubjects = getAppropriateSubjectsForClass(selectedClass);
  if (validSubjects.length > 0) {
    selSubject.innerHTML = validSubjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    if (!currentSubject || currentSubject === 'all' || !validSubjects.some(s => s.name === currentSubject)) {
      currentSubject = validSubjects[0].name;
    }
    selSubject.value = currentSubject;
  } else {
    selSubject.innerHTML = `<option value="General">General</option>`;
    currentSubject = 'General';
  }
}

async function handleClassChange() {
  const selClassEl = document.getElementById('sel-class');
  if (selClassEl) {
    currentClass = selClassEl.value;
  }
  attendanceReadyToLoad = true;
  updateAttendanceSubjectsDropdown(currentClass);
  await loadAttendanceRoster();
}

async function handleSubjectChange() {
  const selSubEl = document.getElementById('sel-subject');
  if (selSubEl) {
    currentSubject = selSubEl.value;
  }
  attendanceReadyToLoad = true;
  await loadAttendanceRoster();
}

function updateReportSubjectsDropdown(selectedClassName) {
  const repSubject = document.getElementById('report-subject');
  if (!repSubject) return;

  // Show placeholder if report is not ready (initial load)
  if (!reportReadyToLoad) {
    repSubject.innerHTML = `<option value="" disabled selected>Select Subject</option>`;
    return;
  }

  const prevVal = repSubject.value;
  let relevantSubjects = subjectsList;
  if (selectedClassName && selectedClassName !== 'all') {
    relevantSubjects = subjectsList.filter(s => {
      const assigned = Array.isArray(s.assignedClasses) ? s.assignedClasses : [];
      return assigned.length === 0 || classListIncludes(assigned, selectedClassName);
    });
  }

  const optionsHtml = relevantSubjects.map(s => `<option value="${escapeHtml(s.name || s)}">${escapeHtml(s.name || s)}</option>`).join('');
  repSubject.innerHTML = `<option value="whole">All Subjects</option>` + optionsHtml;

  if (prevVal && Array.from(repSubject.options).some(o => o.value === prevVal)) {
    repSubject.value = prevVal;
  } else {
    repSubject.value = 'whole';
  }
}

async function handleReportClassChange() {
  const repClassEl = document.getElementById('report-class');
  const selectedClass = repClassEl ? repClassEl.value : '';
  reportReadyToLoad = true;
  updateReportSubjectsDropdown(selectedClass);
  await loadReport();
}

async function handleReportSubjectChange() {
  reportReadyToLoad = true;
  await loadReport();
}

async function handleReportFilterChange() {
  if (reportReadyToLoad) {
    await loadReport();
  }
}

function populateSubjectDropdowns() {
  const selClassEl = document.getElementById('sel-class');
  const targetClass = selClassEl ? selClassEl.value : currentClass;
  updateAttendanceSubjectsDropdown(targetClass);

  const repClassEl = document.getElementById('report-class');
  updateReportSubjectsDropdown(repClassEl ? repClassEl.value : '');
}

// Drag & Drop Sorting for Subjects
let draggedSubjectIndex = null;

function handleSubjectDragStart(e, index) {
  draggedSubjectIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}

function handleSubjectDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.currentTarget;
  if (!item.classList.contains('drag-over')) {
    item.classList.add('drag-over');
  }
}

function handleSubjectDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleSubjectDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('#subject-cards-container .drag-item').forEach(el => el.classList.remove('drag-over'));
}

async function handleSubjectDrop(e, targetIndex) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (draggedSubjectIndex === null || draggedSubjectIndex === targetIndex) return;

  const movedSubject = subjectsList.splice(draggedSubjectIndex, 1)[0];
  subjectsList.splice(targetIndex, 0, movedSubject);
  draggedSubjectIndex = null;

  renderSubjectsList();
  populateSubjectDropdowns();

  try {
    const orderedIds = subjectsList.map(s => s._id);
    await API.reorderSubjects(orderedIds);
    showToast('Subject order updated!');
  } catch (err) {
    console.error('[Reorder Subjects Error]', err);
  }
}

function renderSubjectsList() {
  const container = document.getElementById('subject-cards-container');
  if (!container) return;

  if (subjectsList.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No subjects added yet.</div>`;
    return;
  }

  container.innerHTML = subjectsList.map((s, index) => `
    <div class="drag-item bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center justify-between"
         draggable="true"
         ondragstart="handleSubjectDragStart(event, ${index})"
         ondragover="handleSubjectDragOver(event, ${index})"
         ondragleave="handleSubjectDragLeave(event)"
         ondragend="handleSubjectDragEnd(event)"
         ondrop="handleSubjectDrop(event, ${index})">
      <div class="flex items-center gap-3">
        <!-- Drag Handle Icon -->
        <div class="text-[var(--text-sub)] hover:text-[#245b70] cursor-grab active:cursor-grabbing p-1" title="Drag to reorder subject">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-[var(--text-main)] text-sm">${s.name}</h3>
            <span class="text-[10px] font-black px-1.5 py-0.2 rounded bg-[#245b70]/10 text-[#245b70]">${s.subjectCode}</span>
          </div>
          ${s.teacher ? `<p class="text-xs text-[var(--text-sub)] mt-0.5">Teacher: ${s.teacher}</p>` : ''}
        </div>
      </div>
      ${canUserEditDelete() ? `
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button onclick="openEditSubjectModal('${s._id}', '${s.name}', '${s.subjectCode}', '${s.teacher || ''}')" title="Edit Subject" class="w-8 h-8 rounded-xl bg-[var(--bg-page)] text-[var(--text-main)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button onclick="deleteSubject('${s._id}', '${s.name.replace(/'/g, "\\'")}')" title="Delete Subject" class="w-8 h-8 rounded-xl btn-delete flex items-center justify-center transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
      ` : ''}
    </div>
  `).join('');
}

// Checkbox helper for Class assigned subjects
function renderSubjectCheckboxesForClass(containerId, selectedSubjects = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!subjectsList || subjectsList.length === 0) {
    container.innerHTML = `<span class="text-xs text-[var(--text-sub)] col-span-full py-1">No subjects created yet. Add subjects in "Subjects" tab first.</span>`;
    return;
  }

  container.innerHTML = subjectsList.map(s => {
    const isChecked = selectedSubjects.includes(s.name);
    return `
      <label class="flex items-center gap-1.5 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border-color)] hover:border-[#245b70] cursor-pointer text-xs font-bold text-[var(--text-main)] transition shadow-sm select-none">
        <input type="checkbox" name="${containerId}-cb" value="${escapeHtml(s.name)}" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-[#245b70] focus:ring-[#245b70] accent-[#245b70] cursor-pointer">
        <span class="truncate">${escapeHtml(s.name)}</span>
      </label>
    `;
  }).join('');
}

function getSelectedSubjectCheckboxesForClass(containerId) {
  const checkboxes = document.querySelectorAll(`input[name="${containerId}-cb"]:checked`);
  return Array.from(checkboxes).map(cb => cb.value);
}

async function openSubjectModal() {
  document.getElementById('input-sub-name').value = '';
  document.getElementById('input-sub-code').value = '';
  await populateTeacherDropdowns('input-sub-teacher', '');
  document.getElementById('modal-add-subject').classList.remove('hidden');
}

function closeSubjectModal() {
  document.getElementById('modal-add-subject').classList.add('hidden');
}

async function handleSaveSubject(e) {
  e.preventDefault();
  const name = document.getElementById('input-sub-name').value.trim();
  const subjectCode = document.getElementById('input-sub-code').value.trim();
  const teacherEl = document.getElementById('input-sub-teacher');
  const teacher = teacherEl ? teacherEl.value.trim() : '';

  try {
    const res = await API.addSubject({ name, subjectCode, teacher });
    if (res.success) {
      showToast(`Subject "${name}" added!`);
      closeSubjectModal();
      await loadSubjects();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

let activeEditSubjectId = null;
async function openEditSubjectModal(id, name, code, teacher) {
  activeEditSubjectId = id;
  document.getElementById('edit-sub-name').value = name;
  document.getElementById('edit-sub-code').value = code || '';
  await populateTeacherDropdowns('edit-sub-teacher', teacher || '');
  document.getElementById('modal-edit-subject').classList.remove('hidden');
}

function closeEditSubjectModal() {
  document.getElementById('modal-edit-subject').classList.add('hidden');
  activeEditSubjectId = null;
}

async function handleUpdateSubject(e) {
  e.preventDefault();
  if (!activeEditSubjectId) return;

  const name = document.getElementById('edit-sub-name').value.trim();
  const subjectCode = document.getElementById('edit-sub-code').value.trim();
  const teacherEl = document.getElementById('edit-sub-teacher');
  const teacher = teacherEl ? teacherEl.value.trim() : '';

  try {
    const res = await API.updateSubject(activeEditSubjectId, { name, subjectCode, teacher });
    if (res.success) {
      showToast(`Subject "${name}" updated!`);
      closeEditSubjectModal();
      await loadSubjects();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteSubject(id, name) {
  if (!confirm(`Delete subject "${name}"?`)) return;
  triggerNavHaptic('delete');
  try {
    const res = await API.deleteSubject(id);
    if (res.success) {
      showToast(`Subject "${name}" deleted`);
      await loadSubjects();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// ================= ATTENDANCE ROSTER =================
// USER DIRECTIVE: "when taking attendence not show id and roll"
function renderAttendancePlaceholder() {
  const container = document.getElementById('attendance-list');
  if (!container) return;

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-10 px-4 bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] text-center shadow-sm my-1">
      <!-- Modern Minimalist Dual-tone Checklist in Soft Light Teal Rounded Square -->
      <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/50 flex items-center justify-center mb-3 shadow-sm">
        <svg class="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="5" y="4" width="14" height="17" rx="3" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8.5 10l1.5 1.5 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="14.5" y1="10" x2="16.5" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M8.5 15l1.5 1.5 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="14.5" y1="15" x2="16.5" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h3 class="text-sm sm:text-base font-black text-[var(--text-main)] mb-1">Select Class &amp; Subject</h3>
      <p class="text-xs text-[var(--text-sub)] max-w-xs leading-relaxed">
        Choose a class and subject above to view students and mark attendance.
      </p>
    </div>
  `;

  _toggleAttendanceControls(false);
}

function _toggleAttendanceControls(show) {
  const ids = ['attendance-stats-bar', 'attendance-bulk-bar', 'attendance-action-bar'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (show) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });
}

function renderReportPlaceholder() {
  const container = document.getElementById('report-placeholder');
  if (!container) return;

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-10 px-4 bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] text-center shadow-sm my-1">
      <!-- Modern Minimalist Dual-tone Bar Chart in Soft Light Purple Rounded Square -->
      <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center mb-3 shadow-sm">
        <svg class="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2"/>
          <rect x="6.5" y="12" width="2.5" height="5" rx="1" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.5"/>
          <rect x="10.75" y="8.5" width="2.5" height="8.5" rx="1" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-width="1.5"/>
          <rect x="15" y="6" width="2.5" height="11" rx="1" fill="currentColor" fill-opacity="0.75" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </div>
      <h3 class="text-sm sm:text-base font-black text-[var(--text-main)] mb-1">Select Class &amp; Subject</h3>
      <p class="text-xs text-[var(--text-sub)] max-w-xs leading-relaxed">
        Choose a class and subject above to view the attendance report and student analytics.
      </p>
    </div>
  `;

  _toggleReportControls(false);
}

function _toggleReportControls(show) {
  const tableEl = document.getElementById('printable-report');
  const printBtn = document.getElementById('btn-print-report');
  const placeholderEl = document.getElementById('report-placeholder');

  if (show) {
    if (placeholderEl) placeholderEl.classList.add('hidden');
    if (tableEl) tableEl.classList.remove('hidden');
    if (printBtn) printBtn.classList.remove('hidden');
  } else {
    if (placeholderEl) placeholderEl.classList.remove('hidden');
    if (tableEl) tableEl.classList.add('hidden');
    if (printBtn) printBtn.classList.add('hidden');
  }
}

async function loadAttendanceRoster() {
  if (!attendanceReadyToLoad) {
    renderAttendancePlaceholder();
    return;
  }

  const selClassEl = document.getElementById('sel-class');
  const selSubEl = document.getElementById('sel-subject');
  if (selClassEl) currentClass = selClassEl.value;
  if (selSubEl) currentSubject = selSubEl.value;

  try {
    // 1. Fetch students for this class
    const studentsRes = await API.getStudents(currentClass);
    if (studentsRes.success) {
      studentsList = studentsRes.data;
    }

    // 2. Fetch existing attendance for this date & class
    const attRes = await API.getAttendance(currentDateStr, currentClass, currentSubject);
    attendanceRecords = [];
    const saveBtnText = document.getElementById('btn-save-attendance-text');

    if (attRes.success && attRes.data && Array.isArray(attRes.data.records) && attRes.data.records.length > 0) {
      attendanceRecords = attRes.data.records;
      if (saveBtnText) saveBtnText.innerText = 'Update Attendance';
    } else {
      // Default to Present
      attendanceRecords = studentsList.map(st => ({
        studentId: st.studentId,
        status: 'P',
        note: ''
      }));
      if (saveBtnText) saveBtnText.innerText = 'Save Attendance';
    }

    renderAttendanceList();
    renderStudentsDirectory();
  } catch (error) {
    console.log('[Attendance Load]', error);
  }
}

function renderAttendanceList() {
  const container = document.getElementById('attendance-list');
  if (!container) return;

  _toggleAttendanceControls(true);

  if (studentsList.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-[var(--text-sub)]">No students enrolled in ${currentClass}. Go to Students tab to add students.</div>`;
    updateAttendanceStats();
    return;
  }

  // USER DIRECTIVE: "when taking attendence not show id and roll"
  // Here we explicitly DO NOT SHOW studentId and DO NOT SHOW roll!
  container.innerHTML = studentsList.map(st => {
    const record = attendanceRecords.find(r => r.studentId === st.studentId) || { status: 'P', note: '' };
    const isP = record.status === 'P';
    const isA = record.status === 'A';
    const isL = record.status === 'L';

    return `
      <div class="bg-[var(--card-bg)] p-3 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center justify-between gap-2.5 transition-all">
        <!-- Student Info: Photo & Name ONLY (No ID and No Roll) - Click Photo to View Details -->
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative flex-shrink-0 cursor-pointer group" onclick="openStudentDetailsModal(${st.studentId})" title="Click to view student details">
            <img src="${st.photoUrl || DEFAULT_AVATAR}" alt="${st.name}" class="w-11 h-11 rounded-xl object-cover border border-[#245b70] group-hover:scale-105 transition shadow-sm">
            <span class="absolute -bottom-1 -right-1 text-[9px] font-black px-1.5 py-0.2 rounded-md ${
              isP ? 'bg-emerald-600 text-white' : isA ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
            }">${record.status}</span>
          </div>
          <div class="truncate">
            <span class="font-extrabold text-[var(--text-main)] text-sm sm:text-base truncate block">${st.name}</span>
          </div>
        </div>

        <!-- Medium-Big Status Toggle Buttons -->
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <button onclick="setStudentStatus(${st.studentId}, 'P')" class="w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center transition-all ${
            isP ? 'bg-emerald-600 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700'
          }">P</button>
          
          <button onclick="setStudentStatus(${st.studentId}, 'A')" class="w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center transition-all ${
            isA ? 'bg-rose-600 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-50 hover:text-rose-700'
          }">A</button>

          <button onclick="setStudentStatus(${st.studentId}, 'L')" title="Mark Leave" class="w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center transition-all ${
            isL ? 'bg-amber-500 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-amber-50 hover:text-amber-700'
          }">L</button>
        </div>
      </div>
    `;
  }).join('');

  updateAttendanceStats();
}

function setStudentStatus(studentId, status) {
  triggerNavHaptic('light');
  let record = attendanceRecords.find(r => r.studentId === studentId);
  if (!record) {
    record = { studentId, status, note: '' };
    attendanceRecords.push(record);
  } else {
    record.status = status;
  }
  renderAttendanceList();
}

function bulkMark(status) {
  triggerNavHaptic('medium');
  attendanceRecords = studentsList.map(st => ({
    studentId: st.studentId,
    status,
    note: ''
  }));
  renderAttendanceList();
  showToast(`Marked all as ${status === 'P' ? 'Present' : 'Absent'}`);
}

function updateAttendanceStats() {
  const total = studentsList.length;
  const present = attendanceRecords.filter(r => r.status === 'P').length;
  const absent = attendanceRecords.filter(r => r.status === 'A').length;
  const late = attendanceRecords.filter(r => r.status === 'L').length;

  const totalEl = document.getElementById('stat-total');
  const presentEl = document.getElementById('stat-present');
  const absentEl = document.getElementById('stat-absent');
  const lateEl = document.getElementById('stat-late');

  if (totalEl) totalEl.innerText = total;
  if (presentEl) presentEl.innerText = present;
  if (absentEl) absentEl.innerText = absent;
  if (lateEl) lateEl.innerText = late;
}

async function saveAttendance() {
  triggerNavHaptic('strong');
  try {
    const payload = {
      date: currentDateStr,
      class: currentClass,
      subject: currentSubject,
      records: attendanceRecords
    };
    const res = await API.saveAttendance(payload);
    if (res.success) {
      showToast('Attendance saved & updated successfully!');
      const saveBtnText = document.getElementById('btn-save-attendance-text');
      if (saveBtnText) saveBtnText.innerText = 'Update Attendance';
      await loadActivityLogs();
      await loadReport();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteCurrentAttendance() {
  const promptMsg = `Are you sure you want to delete the recorded attendance for ${currentClass} on ${currentDateStr}${currentSubject ? ' (' + currentSubject + ')' : ''}?`;
  if (!confirm(promptMsg)) {
    return;
  }
  triggerNavHaptic('delete');
  try {
    const res = await API.deleteAttendance({
      date: currentDateStr,
      class: currentClass,
      subject: currentSubject
    });
    if (res.success) {
      showToast('Attendance record deleted!');
      await loadAttendanceRoster();
      await loadActivityLogs();
      await loadReport();
    }
  } catch (error) {
    showToast(error.message || 'Error deleting attendance', true);
  }
}

function updateDateDisplay() {
  const parts = currentDateStr.split('-');
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const displayEl = document.getElementById('current-date');
  const dayEl = document.getElementById('current-day');
  const pickerEl = document.getElementById('attendance-date-picker');

  if (displayEl) {
    displayEl.innerText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (dayEl) {
    const todayStr = formatLocalDate(new Date());
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = formatLocalDate(yest);

    if (currentDateStr === todayStr) {
      dayEl.innerText = 'Today';
    } else if (currentDateStr === yestStr) {
      dayEl.innerText = 'Yesterday';
    } else {
      dayEl.innerText = d.toLocaleDateString('en-US', { weekday: 'short' });
    }
  }
  if (pickerEl) {
    pickerEl.value = currentDateStr;
  }
}

// USER DIRECTIVE: "when click the today date...... show 'date input' with app theme ui.not remove the date up and down arrows"
function changeDate(delta) {
  const parts = currentDateStr.split('-');
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() + delta);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  currentDateStr = `${year}-${month}-${day}`;

  updateDateDisplay();
  loadAttendanceRoster();
}

function handleDatePickerChange(event) {
  if (!event.target.value) return;
  currentDateStr = event.target.value;
  updateDateDisplay();
  loadAttendanceRoster();
}

function openDatePicker() {
  const pickerEl = document.getElementById('attendance-date-picker');
  if (pickerEl) {
    if (typeof pickerEl.showPicker === 'function') {
      try {
        pickerEl.showPicker();
      } catch (e) {
        pickerEl.focus();
      }
    } else {
      pickerEl.focus();
    }
  }
}

// ================= REPORT PAGE =================
// USER DIRECTIVE:
// "in report page
// roll no with rounded sqaure border solid background
// student name,sessins,present,absent,late,percent,
// action .....under of it a button named log when click it shows the date period present status etc"
// "only show main name in filters not in the bracket"
async function loadReport() {
  if (!reportReadyToLoad) {
    renderReportPlaceholder();
    return;
  }

  const repClassEl = document.getElementById('report-class');
  const repYearEl = document.getElementById('report-year');
  const repPeriodEl = document.getElementById('report-period');
  const repSubEl = document.getElementById('report-subject');

  const repClass = repClassEl ? repClassEl.value : (currentClass || 'Class 10');
  const repYear = repYearEl ? repYearEl.value : 'all';
  const repPeriod = repPeriodEl ? repPeriodEl.value : 'all-year';
  const repSubject = repSubEl ? repSubEl.value : 'whole';

  try {
    const res = await API.getClassReport(repClass, repYear, repPeriod, repSubject);
    if (res.success) {
      _toggleReportControls(true);
      renderReportTable(res.data, res.summary);
    }
  } catch (error) {
    console.log('[Report Load]', error);
  }
}

function renderReportTable(data, summary) {
  const tbody = document.getElementById('report-table-body');
  const avgEl = document.getElementById('report-class-avg');
  if (avgEl && summary) {
    avgEl.innerText = `Class Avg: ${summary.classAverage}%`;
  }
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-xs text-[var(--text-sub)]">No attendance records found for this selection.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(row => {
    const effStatus = row.status || (row.percent >= 90 ? 'Excellent' : row.percent >= 75 ? 'Regular' : row.percent >= 60 ? 'Warning' : 'Critical');
    const badgeClass =
      effStatus === 'Excellent' ? 'status-excellent' :
      effStatus === 'Regular' ? 'status-regular' :
      effStatus === 'Warning' ? 'status-warning' : 'status-critical';

    return `
    <tr>
      <td class="py-2.5 px-2">
        <!-- Roll No with rounded square border solid background -->
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#245b70] text-white font-black text-xs shadow-sm">
          ${row.roll}
        </span>
      </td>
      <td class="py-2.5 px-2 font-bold">
        <div class="flex items-center gap-2">
          <img src="${row.photoUrl || DEFAULT_AVATAR}" class="w-7 h-7 rounded-lg object-cover border border-[#245b70] shadow-sm">
          <div>${row.name}</div>
        </div>
      </td>
      <td class="py-2.5 px-1.5 text-center font-bold">${row.sessions}</td>
      <td class="py-2.5 px-1.5 text-center font-bold text-emerald-600">${row.present}</td>
      <td class="py-2.5 px-1.5 text-center font-bold text-rose-600">${row.absent}</td>
      <td class="py-2.5 px-1.5 text-center font-bold text-amber-600">${row.late}</td>
      <td class="py-2.5 px-1.5 text-center font-black ${row.percent >= 75 ? 'text-emerald-600' : 'text-rose-600'}">
        ${row.percent}%
      </td>
      <td class="py-2.5 px-1.5 text-center">
        <!-- Status: Excellent, Regular, Warning, Critical -->
        <span class="status-badge ${badgeClass}">${effStatus}</span>
      </td>
      <td class="py-2.5 px-2 text-center no-print">
        <!-- Action: Button named "Log" -->
        <button onclick="openStudentLogModal(${row.studentId}, '${row.name.replace(/'/g, "\\'")}', ${row.roll})" class="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#245b70]/10 hover:bg-[#245b70] hover:text-white text-[#245b70] transition shadow-sm">
          Log
        </button>
      </td>
    </tr>
  `;
  }).join('');
}

// Student Log Modal (When clicking "Log")
// USER DIRECTIVE: "in report of students, in the log button click add in the window also their attendance like....present in green,,,absent in red ....late in yellew present at the top of log window"
async function openStudentLogModal(studentId, name, roll) {
  document.getElementById('log-modal-title').innerText = `Attendance Logs - ${name}`;
  document.getElementById('log-modal-subtitle').innerText = `Roll #${roll} · ID: ${studentId}`;

  // Reset top badges
  const statP = document.getElementById('log-stat-present');
  const statA = document.getElementById('log-stat-absent');
  const statL = document.getElementById('log-stat-late');
  if (statP) statP.innerText = '0';
  if (statA) statA.innerText = '0';
  if (statL) statL.innerText = '0';

  const listContainer = document.getElementById('student-logs-list');
  if (listContainer) listContainer.innerHTML = `<div class="p-3 text-xs text-center text-[var(--text-sub)]">Loading logs...</div>`;

  document.getElementById('modal-student-log').classList.remove('hidden');

  try {
    const res = await API.getStudentLogs(studentId);
    if (res.success && res.logs) {
      const pCount = res.logs.filter(l => l.status === 'P').length;
      const aCount = res.logs.filter(l => l.status === 'A').length;
      const lCount = res.logs.filter(l => l.status === 'L').length;
      if (statP) statP.innerText = pCount;
      if (statA) statA.innerText = aCount;
      if (statL) statL.innerText = lCount;

      if (res.logs.length === 0) {
        listContainer.innerHTML = `<div class="p-3 text-xs text-center text-[var(--text-sub)]">No attendance sessions recorded yet.</div>`;
        return;
      }

      listContainer.innerHTML = res.logs.map(log => {
        const subjectName = log.subject || log.period || 'General Attendance';
        return `
          <div class="p-2.5 rounded-xl bg-[var(--bg-page)] flex items-center justify-between text-xs border border-[var(--border-color)]">
            <div class="min-w-0 pr-2">
              <div class="font-bold text-[var(--text-main)] flex items-center gap-2 flex-wrap">
                <span>${log.date}</span>
                <span class="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#245b70]/10 text-[#245b70] dark:bg-[#245b70]/30 dark:text-cyan-300">
                  ${subjectName}
                </span>
              </div>
              ${log.note ? `<div class="text-[10px] text-[var(--text-sub)] mt-0.5">Note: ${log.note}</div>` : ''}
            </div>
            <span class="px-2.5 py-0.5 rounded-md font-black text-xs flex-shrink-0 ${
              log.status === 'P' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' :
              log.status === 'A' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
            }">${log.statusText}</span>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    if (listContainer) listContainer.innerHTML = `<div class="p-3 text-xs text-rose-600">Failed to load logs.</div>`;
  }
}

function closeStudentLogModal() {
  document.getElementById('modal-student-log').classList.add('hidden');
}

function printReport() {
  const printable = document.getElementById('printable-report');
  if (!printable || printable.classList.contains('hidden')) {
    showToast('Please select a class and subject to load a report first.', true);
    return;
  }
  document.body.classList.add('print-report-active');
  window.print();
}

// ================= STUDENTS DIRECTORY =================
// USER DIRECTIVE:
// "in add students show total students numbers and the no. of students in selected class"
// "change student directory to students or avoid it if not space"
async function renderStudentsDirectory() {
  const container = document.getElementById('student-directory-cards');
  const classFilterEl = document.getElementById('student-class-filter');
  const searchInput = document.getElementById('student-search-input');
  const filterClass = classFilterEl ? classFilterEl.value : 'all';
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  try {
    // 1. Fetch all students to know accurate total count
    const allRes = await API.getStudents('all');
    const allStudents = (allRes.success && allRes.data) ? allRes.data : [];

    // Calculate class count
    const classCount = filterClass === 'all'
      ? allStudents.length
      : allStudents.filter(s => isClassEqual(s.class, filterClass)).length;

    // Update Live Count Badges in Students Header
    // USER DIRECTIVE: "Make students total div with round square small color fill div...dont show second div if selected class is all"
    const totalCountEl = document.getElementById('students-count-total');
    const classCountEl = document.getElementById('students-count-class');
    const classNameEl = document.getElementById('students-count-class-name');
    const classContainerEl = document.getElementById('students-count-class-container');

    if (totalCountEl) totalCountEl.innerText = allStudents.length;

    if (filterClass === 'all') {
      if (classContainerEl) {
        classContainerEl.classList.add('hidden');
        classContainerEl.classList.remove('inline-flex', 'flex');
      }
    } else {
      if (classContainerEl) {
        classContainerEl.classList.remove('hidden');
        classContainerEl.classList.add('inline-flex');
      }
      if (classNameEl) classNameEl.innerText = filterClass;
      if (classCountEl) classCountEl.innerText = classCount;
    }

    // Filter by class
    let students = filterClass === 'all' ? allStudents : allStudents.filter(s => isClassEqual(s.class, filterClass));

    // Filter by search query if any
    if (searchTerm) {
      students = students.filter(s =>
        (s.name && s.name.toLowerCase().includes(searchTerm)) ||
        (s.roll && String(s.roll).includes(searchTerm)) ||
        (s.studentId && String(s.studentId).includes(searchTerm))
      );
    }

    if (!container) return;

    if (students.length === 0) {
      container.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No students found.</div>`;
      return;
    }

      container.innerHTML = students.map(st => `
        <div id="student-card-${st.studentId}" class="bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border-color)] shadow-sm space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5 min-w-0 select-none">
              <img src="${st.photoUrl || DEFAULT_AVATAR}" class="w-11 h-11 rounded-xl object-cover border border-[#245b70] flex-shrink-0 shadow-sm">
              <div class="truncate">
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-[var(--text-main)] text-sm truncate">${st.name}</span>
                  <span class="text-[10px] font-black bg-[#245b70]/10 text-[#245b70] px-1.5 py-0.2 rounded flex-shrink-0">ID: ${st.studentId}</span>
                </div>
                <p class="text-xs text-[var(--text-sub)] truncate">${st.class} · Roll: ${st.roll}</p>
              </div>
            </div>

            <!-- Edit and Delete Buttons -->
            ${canUserEditDelete() ? `
            <div class="flex items-center gap-1 flex-shrink-0">
              <button onclick="openEditStudentModal('${st._id}')" title="Edit Student (All fields)" class="w-8 h-8 rounded-xl bg-[var(--bg-page)] text-[var(--text-main)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button onclick="confirmDeleteStudent('${st._id}', '${st.name.replace(/'/g, "\\'")}', ${st.studentId})" title="Delete Student" class="w-8 h-8 rounded-xl btn-delete flex items-center justify-center transition">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
            ` : ''}
          </div>
        </div>
      `).join('');
  } catch (error) {
    console.log('[Students Directory Load]', error);
  }
}

// Image Compression Helper via HTML5 Canvas (ensures photos are optimized and under 60KB)
function compressImage(file, maxWidth = 500, maxHeight = 500, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Student Photo Upload Helper (External Storage Upload & Local Fallback)
let newStudentPhotoUrl = '';
let editStudentPhotoUrl = '';
let newStudentBase64Photo = '';
let editStudentBase64Photo = '';

async function handlePhotoUpload(event, mode) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    showToast('Processing photo...');
    const base64 = await compressImage(file, 500, 500, 0.82);
    if (mode === 'new') {
      newStudentBase64Photo = base64;
      newStudentPhotoUrl = base64;
      const preview = document.getElementById('new-preview-photo');
      if (preview) preview.src = base64;
    } else {
      editStudentBase64Photo = base64;
      editStudentPhotoUrl = base64;
      const preview = document.getElementById('edit-preview-photo');
      if (preview) preview.src = base64;
    }

    // Upload to External Storage (Cloudinary / Local Fallback)
    showToast('Saving to storage...');
    const uploadRes = await API.uploadPhoto(file, 'students');
    if (uploadRes && uploadRes.success && uploadRes.url) {
      if (mode === 'new') {
        newStudentPhotoUrl = uploadRes.url;
      } else {
        editStudentPhotoUrl = uploadRes.url;
      }
      showToast(`Photo stored on ${uploadRes.provider === 'cloudinary' ? 'Cloudinary CDN' : 'storage'}!`);
    } else {
      showToast('Photo selected!');
    }
  } catch (error) {
    console.error('[Photo Upload Error]', error);
    showToast('Photo selected!');
  }
}

// ================= USER PROFILE EDIT MODAL =================
// USER DIRECTIVE: "all accounts can be change their names and photo by clicking their photo"
let editUserBase64Photo = '';
let editUserPhotoUrl = '';

function openProfileEditModal() {
  if (!currentUser) {
    showToast('Please sign in first', true);
    openAuthModal();
    return;
  }

  editUserBase64Photo = currentUser.avatarUrl || '';
  editUserPhotoUrl = currentUser.avatarUrl || '';
  const preview = document.getElementById('edit-profile-avatar-preview') || document.getElementById('user-profile-preview');
  if (preview) preview.src = currentUser.avatarUrl || DEFAULT_AVATAR;

  const nameInput = document.getElementById('edit-profile-name-input') || document.getElementById('user-profile-name');
  if (nameInput) nameInput.value = currentUser.name || '';

  const emailInput = document.getElementById('edit-profile-email-input') || document.getElementById('user-profile-email');
  if (emailInput) emailInput.value = currentUser.email || '';

  const modal = document.getElementById('modal-edit-profile');
  if (modal) modal.classList.remove('hidden');
}

function closeProfileEditModal() {
  const modal = document.getElementById('modal-edit-profile');
  if (modal) modal.classList.add('hidden');
  editUserBase64Photo = '';
  editUserPhotoUrl = '';
}

async function handleUserProfilePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    showToast('Processing photo...');
    const base64 = await compressImage(file, 400, 400, 0.85);
    editUserBase64Photo = base64;
    editUserPhotoUrl = base64;
    const preview = document.getElementById('edit-profile-avatar-preview') || document.getElementById('user-profile-preview');
    if (preview) preview.src = base64;

    // Upload to External Storage
    showToast('Saving avatar to storage...');
    const uploadRes = await API.uploadPhoto(file, 'avatars');
    if (uploadRes && uploadRes.success && uploadRes.url) {
      editUserPhotoUrl = uploadRes.url;
      showToast(`Profile photo saved to ${uploadRes.provider === 'cloudinary' ? 'Cloudinary CDN' : 'storage'}!`);
    } else {
      showToast('Photo selected!');
    }
  } catch (error) {
    console.error('[User Photo Upload]', error);
    showToast('Photo selected!');
  }
}

async function handleSaveProfile(event) {
  if (event) event.preventDefault();
  const nameInput = document.getElementById('edit-profile-name-input') || document.getElementById('user-profile-name');
  const name = nameInput ? nameInput.value.trim() : '';

  if (!name) {
    showToast('Please enter your name', true);
    return;
  }

  try {
    const finalAvatarUrl = editUserPhotoUrl || editUserBase64Photo;
    const res = await API.updateProfile(name, finalAvatarUrl);
    if (res.success && res.user) {
      currentUser = res.user;
      updateUserUI();
      closeProfileEditModal();
      showToast('Profile updated successfully!');
    }
  } catch (error) {
    showToast(error.message || 'Failed to update profile', true);
  }
}

// USER DIRECTIVE: "in add students show total students numbers and the no. of students in selected class"
async function updateModalStudentCounts() {
  try {
    const classSelect = document.getElementById('new-student-class');
    const selectedClass = classSelect ? classSelect.value : '';
    const allRes = await API.getStudents('all');
    if (allRes.success && allRes.data) {
      const allStudents = allRes.data;
      const totalCount = allStudents.length;
      const classCount = (selectedClass && selectedClass !== 'all')
        ? allStudents.filter(s => isClassEqual(s.class, selectedClass)).length
        : 0;

      const modalTotal = document.getElementById('modal-add-total-count');
      const modalClass = document.getElementById('modal-add-class-count');
      const modalClassName = document.getElementById('modal-add-class-name');
      const modalClassWrap = document.getElementById('modal-add-class-wrapper');

      if (modalTotal) modalTotal.innerText = totalCount;
      if (modalClass) modalClass.innerText = classCount;
      if (modalClassName) modalClassName.innerText = selectedClass || 'Class';

      if (modalClassWrap) {
        if (!selectedClass || selectedClass === 'all') {
          modalClassWrap.classList.add('hidden');
          modalClassWrap.classList.remove('inline-flex', 'flex');
        } else {
          modalClassWrap.classList.remove('hidden');
          modalClassWrap.classList.add('inline-flex');
        }
      }
    }
  } catch (e) {
    console.log('[Modal Counts Error]', e);
  }
}

// Helper to safely get value of form fields
function getStudentInputValue(prefix, key) {
  const el = document.getElementById(`${prefix}-student-${key}`);
  return el ? el.value.trim() : '';
}

// Helper to collect all custom fields
function collectStudentCustomFields(prefix) {
  const customs = {};
  (appStudentFormFields || []).forEach(f => {
    if (f.isCustom) {
      customs[f.key] = getStudentInputValue(prefix, f.key);
    }
  });
  return customs;
}

// State for Student Form Layout Editor Mode
let isStudentFormEditMode = false;
let draggedFieldIndex = null;
let touchDraggedIdx = null;
let touchElement = null;
let activeEditingFieldIdx = null;
let currentFieldEditorSize = 'half';

// Dynamic Student Inputs Renderer for Add & Edit Modals (Supports Normal & Interactive Layout Editor Mode)
function renderDynamicStudentInputs(prefix = 'new', student = null) {
  const container = document.getElementById(prefix === 'new' ? 'dynamic-new-student-fields' : 'dynamic-edit-student-fields');
  if (!container) return;

  const fields = (Array.isArray(appStudentFormFields) && appStudentFormFields.length > 0)
    ? appStudentFormFields
    : DEFAULT_STUDENT_FORM_FIELDS;

  // ================= INTERACTIVE LAYOUT EDITOR MODE (ADMIN CAN DRAG BY HOLDING, EDIT WITH KEY/BUTTON) =================
  if (isStudentFormEditMode && prefix === 'new') {
    let html = '';
    fields.forEach((field, idx) => {
      const spanClass = field.size === 'full' ? 'col-span-1 sm:col-span-2' : 'col-span-1';
      const isHidden = field.enabled === false;

      html += `
        <div class="${spanClass} field-drag-card relative p-3 rounded-2xl border-2 ${isHidden ? 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/40 opacity-60' : 'border-[#245b70]/30 hover:border-[#245b70] bg-[var(--card-bg)] shadow-xs'} transition group"
             draggable="true"
             tabindex="0"
             data-index="${idx}"
             ondragstart="handleFieldDragStart(event, ${idx})"
             ondragover="handleFieldDragOver(event, ${idx})"
             ondragleave="handleFieldDragLeave(event, ${idx})"
             ondrop="handleFieldDrop(event, ${idx})"
             ondragend="handleFieldDragEnd(event)"
             ontouchstart="handleFieldTouchStart(event, ${idx})"
             ontouchmove="handleFieldTouchMove(event)"
             ontouchend="handleFieldTouchEnd(event)"
             onkeydown="handleFieldKeyDown(event, ${idx})">
          
          <!-- Card Header: Drag handle, Size toggle, Edit key, Delete -->
          <div class="flex items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-[var(--border-color)]">
            <div class="flex items-center gap-1.5 cursor-grab active:cursor-grabbing text-[#245b70] dark:text-cyan-400">
              <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
              <span class="text-[10px] font-black uppercase tracking-wider">Drag to Move</span>
            </div>

            <div class="flex items-center gap-1">
              <!-- 1-Click Size Toggle -->
              <button type="button" onclick="toggleAdminStudentFieldSize(${idx})" class="px-2 py-0.5 rounded-lg text-[10px] font-black border transition ${field.size === 'full' ? 'bg-[#245b70] text-white border-[#245b70]' : 'bg-[var(--bg-page)] text-[var(--text-main)] border-[var(--border-color)]'}" title="Click to toggle Half / Full width">
                ${field.size === 'full' ? 'Full (100%)' : 'Half (50%)'}
              </button>

              <!-- Edit Key / Button -->
              <button type="button" onclick="openFieldEditModal(${idx})" class="px-2 py-0.5 rounded-lg text-[10px] font-black bg-teal-500/10 hover:bg-[#245b70] text-[#245b70] hover:text-white transition flex items-center gap-1" title="Click or press 'E' key to edit label & properties">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                <span>Edit</span>
              </button>

              ${field.isCustom ? `
                <button type="button" onclick="deleteAdminStudentCustomField(${idx})" class="w-5 h-5 rounded text-rose-500 hover:bg-rose-500/10 flex items-center justify-center font-bold" title="Delete custom field">✕</button>
              ` : ''}
            </div>
          </div>

          <!-- Card Content / Preview -->
          <div class="pointer-events-none">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-black text-[var(--text-main)]">${escapeHtml(field.label)}</span>
              ${isHidden ? `<span class="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">Hidden</span>` : ''}
            </div>
            <div class="h-8 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)] px-2.5 flex items-center text-xs font-medium text-[var(--text-sub)]">
              ${field.key === 'class' ? 'Class Dropdown' : (field.type === 'number' ? '123...' : 'Text input...')}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    return;
  }

  // ================= NORMAL FORM INPUTS RENDERING =================
  let html = '';
  fields.forEach(field => {
    if (field.enabled === false) return;

    const spanClass = field.size === 'full' ? 'col-span-1 sm:col-span-2' : 'col-span-1';
    const inputId = `${prefix}-student-${field.key}`;

    let val = '';
    if (student) {
      if (field.isCustom) {
        val = (student.customFields && (student.customFields[field.key] !== undefined ? student.customFields[field.key] : '')) || '';
      } else {
        switch (field.key) {
          case 'name': val = student.name || ''; break;
          case 'class': val = student.class || ''; break;
          case 'roll': val = student.roll !== undefined ? student.roll : ''; break;
          case 'address': val = (student.address && student.address.fullAddress) || ''; break;
          case 'place': val = (student.address && student.address.place) || ''; break;
          case 'district': val = (student.address && student.address.district) || ''; break;
          case 'state': val = (student.address && student.address.state) || ''; break;
          case 'fatherName': val = (student.familyDetails && student.familyDetails.fatherName) || ''; break;
          case 'motherName': val = (student.familyDetails && student.familyDetails.motherName) || ''; break;
          case 'fatherMobile': val = (student.familyDetails && student.familyDetails.fatherMobile) || ''; break;
          case 'fatherWhatsapp': val = (student.familyDetails && student.familyDetails.fatherWhatsapp) || ''; break;
          case 'yearJoined': val = (student.academicStatus && (student.academicStatus.yearJoined || student.academicStatus.admissionStatus)) || '2024'; break;
          case 'rank': val = (student.academicStatus && student.academicStatus.rank) || ''; break;
          case 'previousCollege': val = (student.academicStatus && student.academicStatus.previousCollege) || ''; break;
          default: val = '';
        }
      }
    } else {
      if (field.key === 'yearJoined') val = '2024';
    }

    if (field.key === 'class') {
      const classOpts = (classesList || []).map(c => {
        const cName = c.name || c;
        const sel = (val === cName) ? 'selected' : '';
        return `<option value="${escapeHtml(cName)}" ${sel}>${escapeHtml(cName)}</option>`;
      }).join('');

      html += `
        <div class="${spanClass}">
          <label class="block text-[10px] font-bold text-[var(--text-main)] mb-1">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
          <select id="${inputId}" ${field.required ? 'required' : ''} ${prefix === 'new' ? 'onchange="updateModalStudentCounts()"' : ''} class="touch-input w-full bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-2.5 text-xs font-bold text-[var(--text-main)]">
            ${classOpts}
          </select>
        </div>
      `;
    } else {
      const inputType = field.type || 'text';
      html += `
        <div class="${spanClass}">
          <label class="block text-[10px] font-bold text-[var(--text-main)] mb-1">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
          <input type="${inputType}" id="${inputId}" value="${escapeHtml(String(val))}" placeholder="${escapeHtml(field.label)}" ${field.required ? 'required' : ''} class="touch-input w-full bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-3 text-xs font-bold text-[var(--text-main)]">
        </div>
      `;
    }
  });

  container.innerHTML = html;
}

// Opens the Add Student modal directly in Layout Customizer Mode from Admin Panel
function openStudentFormLayoutEditor() {
  closeAdminPanel();
  isStudentFormEditMode = true;

  const titleEl = document.getElementById('modal-add-student-title');
  if (titleEl) titleEl.innerText = 'Customize Student Form Layout';
  
  const statsEl = document.getElementById('modal-add-student-stats');
  if (statsEl) statsEl.classList.add('hidden');

  const bannerEl = document.getElementById('student-layout-editor-banner');
  if (bannerEl) bannerEl.classList.remove('hidden');

  const enrollBtn = document.getElementById('btn-enroll-student');
  if (enrollBtn) enrollBtn.classList.add('hidden');

  const saveLayoutBtn = document.getElementById('btn-save-layout-exit');
  if (saveLayoutBtn) saveLayoutBtn.classList.remove('hidden');

  renderDynamicStudentInputs('new');
  document.getElementById('modal-add-student').classList.remove('hidden');
  triggerNavHaptic('strong');
}

function exitStudentFormLayoutEditor() {
  isStudentFormEditMode = false;

  const titleEl = document.getElementById('modal-add-student-title');
  if (titleEl) titleEl.innerText = 'Add Student';

  const statsEl = document.getElementById('modal-add-student-stats');
  if (statsEl) statsEl.classList.remove('hidden');

  const bannerEl = document.getElementById('student-layout-editor-banner');
  if (bannerEl) bannerEl.classList.add('hidden');

  const enrollBtn = document.getElementById('btn-enroll-student');
  if (enrollBtn) enrollBtn.classList.remove('hidden');

  const saveLayoutBtn = document.getElementById('btn-save-layout-exit');
  if (saveLayoutBtn) saveLayoutBtn.classList.add('hidden');

  renderDynamicStudentInputs('new');
  closeStudentModal();
}

async function saveAndExitStudentFormLayoutEditor() {
  await saveAdminStudentFieldsConfig();
  exitStudentFormLayoutEditor();
}

// Drag & Drop Handlers for Reordering Form Inputs
function handleFieldDragStart(e, idx) {
  draggedFieldIndex = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', idx);
  e.currentTarget.classList.add('dragging');
  triggerNavHaptic('medium');
}

function handleFieldDragOver(e, idx) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  if (!card.classList.contains('drag-over') && draggedFieldIndex !== idx) {
    card.classList.add('drag-over');
  }
}

function handleFieldDragLeave(e, idx) {
  e.currentTarget.classList.remove('drag-over');
}

function handleFieldDrop(e, targetIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (draggedFieldIndex === null || draggedFieldIndex === targetIdx) return;

  const item = appStudentFormFields.splice(draggedFieldIndex, 1)[0];
  appStudentFormFields.splice(targetIdx, 0, item);
  draggedFieldIndex = null;

  triggerNavHaptic('strong');
  renderDynamicStudentInputs('new');
}

function handleFieldDragEnd(e) {
  draggedFieldIndex = null;
  document.querySelectorAll('.field-drag-card').forEach(el => {
    el.classList.remove('dragging', 'drag-over');
  });
}

// Mobile Touch Drag & Drop for reordering
function handleFieldTouchStart(e, idx) {
  touchDraggedIdx = idx;
  touchElement = e.currentTarget;
  touchElement.classList.add('dragging');
  triggerNavHaptic('medium');
}

function handleFieldTouchMove(e) {
  if (touchDraggedIdx === null) return;
  const touch = e.touches[0];
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const card = target ? target.closest('.field-drag-card') : null;

  document.querySelectorAll('.field-drag-card').forEach(el => el.classList.remove('drag-over'));
  if (card && card !== touchElement) {
    card.classList.add('drag-over');
  }
}

function handleFieldTouchEnd(e) {
  if (touchDraggedIdx === null) return;
  const touch = e.changedTouches[0];
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const card = target ? target.closest('.field-drag-card') : null;

  if (card) {
    const targetIdx = parseInt(card.getAttribute('data-index'), 10);
    if (!isNaN(targetIdx) && targetIdx !== touchDraggedIdx) {
      const item = appStudentFormFields.splice(touchDraggedIdx, 1)[0];
      appStudentFormFields.splice(targetIdx, 0, item);
      triggerNavHaptic('strong');
    }
  }

  touchDraggedIdx = null;
  touchElement = null;
  document.querySelectorAll('.field-drag-card').forEach(el => {
    el.classList.remove('dragging', 'drag-over');
  });
  renderDynamicStudentInputs('new');
}

// Keyboard Shortcut: press 'E' or 'Enter' on a field card to edit it
function handleFieldKeyDown(e, idx) {
  if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
    e.preventDefault();
    openFieldEditModal(idx);
  }
}

// Quick Field Editor Modal (Edit label, half/full width, visibility, delete)
function openFieldEditModal(idx) {
  const field = appStudentFormFields[idx];
  if (!field) return;

  activeEditingFieldIdx = idx;
  currentFieldEditorSize = field.size || 'half';

  document.getElementById('field-editor-idx').value = idx;
  document.getElementById('field-editor-label').value = field.label;
  document.getElementById('field-editor-key-subtitle').innerText = `${field.isCustom ? 'Custom' : 'Standard'} Field • ${field.key}`;
  document.getElementById('field-editor-enabled').checked = field.enabled !== false;

  setFieldEditorSize(currentFieldEditorSize);

  const deleteWrap = document.getElementById('field-editor-delete-wrap');
  if (deleteWrap) {
    if (field.isCustom) {
      deleteWrap.classList.remove('hidden');
    } else {
      deleteWrap.classList.add('hidden');
    }
  }

  document.getElementById('modal-field-editor').classList.remove('hidden');
  triggerNavHaptic('medium');
}

function closeFieldEditModal() {
  document.getElementById('modal-field-editor').classList.add('hidden');
  activeEditingFieldIdx = null;
}

function setFieldEditorSize(size) {
  currentFieldEditorSize = size;
  const halfBtn = document.getElementById('btn-size-half');
  const fullBtn = document.getElementById('btn-size-full');

  if (halfBtn && fullBtn) {
    if (size === 'half') {
      halfBtn.className = 'p-2.5 rounded-xl border border-[#245b70] bg-[#245b70] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm';
      fullBtn.className = 'p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] text-[var(--text-main)] text-xs font-bold transition flex items-center justify-center gap-1.5';
    } else {
      halfBtn.className = 'p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] text-[var(--text-main)] text-xs font-bold transition flex items-center justify-center gap-1.5';
      fullBtn.className = 'p-2.5 rounded-xl border border-[#245b70] bg-[#245b70] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm';
    }
  }
}

function saveFieldEditChanges() {
  if (activeEditingFieldIdx === null || !appStudentFormFields[activeEditingFieldIdx]) return;
  const newLabel = document.getElementById('field-editor-label').value.trim();
  const enabled = document.getElementById('field-editor-enabled').checked;

  if (newLabel) {
    appStudentFormFields[activeEditingFieldIdx].label = newLabel;
  }
  appStudentFormFields[activeEditingFieldIdx].size = currentFieldEditorSize;
  appStudentFormFields[activeEditingFieldIdx].enabled = enabled;

  closeFieldEditModal();
  renderDynamicStudentInputs('new');
  triggerNavHaptic('strong');
  showToast(`Updated "${newLabel || 'field'}"!`);
}

function deleteCurrentCustomField() {
  if (activeEditingFieldIdx === null || !appStudentFormFields[activeEditingFieldIdx]) return;
  const name = appStudentFormFields[activeEditingFieldIdx].label;
  if (confirm(`Delete custom field "${name}"?`)) {
    appStudentFormFields.splice(activeEditingFieldIdx, 1);
    closeFieldEditModal();
    renderDynamicStudentInputs('new');
    triggerNavHaptic('strong');
    showToast(`Deleted custom field "${name}"`);
  }
}

function toggleAdminStudentFieldSize(index) {
  if (!appStudentFormFields[index]) return;
  appStudentFormFields[index].size = appStudentFormFields[index].size === 'full' ? 'half' : 'full';
  renderDynamicStudentInputs('new');
  triggerNavHaptic('medium');
}

function promptAddCustomStudentField() {
  const label = prompt('Enter label for new custom field (e.g. Blood Group, Bus Stop, DOB):');
  if (!label || !label.trim()) return;

  const key = 'custom_' + label.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
  appStudentFormFields.push({
    key,
    label: label.trim(),
    type: 'text',
    size: 'half',
    required: false,
    enabled: true,
    isCustom: true
  });
  renderDynamicStudentInputs('new');
  triggerNavHaptic('strong');
  showToast(`Custom field "${label.trim()}" added! Drag & hold to reposition.`);
}

function deleteAdminStudentCustomField(index) {
  if (!appStudentFormFields[index]) return;
  const name = appStudentFormFields[index].label;
  if (confirm(`Delete custom field "${name}"?`)) {
    appStudentFormFields.splice(index, 1);
    renderDynamicStudentInputs('new');
    triggerNavHaptic('strong');
  }
}

function resetAdminStudentFieldsConfig() {
  if (confirm('Reset student form inputs and layout to default?')) {
    appStudentFormFields = JSON.parse(JSON.stringify(DEFAULT_STUDENT_FORM_FIELDS));
    renderDynamicStudentInputs('new');
    triggerNavHaptic('strong');
  }
}

async function saveAdminStudentFieldsConfig() {
  try {
    const res = await API.saveStudentFormFields(appStudentFormFields);
    if (res.success) {
      showToast('Student form layout saved successfully!');
      triggerNavHaptic('strong');
    }
  } catch (err) {
    showToast('Failed to save layout: ' + err.message, true);
  }
}

// Add Student Modal (Auto Student ID starting at 2000, read-only)
async function openStudentModal() {
  const titleEl = document.getElementById('modal-add-student-title');
  if (titleEl) titleEl.innerText = 'Add Student';

  const statsEl = document.getElementById('modal-add-student-stats');
  if (statsEl) statsEl.classList.remove('hidden');

  newStudentPhotoUrl = '';
  newStudentBase64Photo = '';
  const preview = document.getElementById('new-preview-photo');
  if (preview) preview.src = DEFAULT_AVATAR;

  // Clear all inputs
  const clearIds = [
    'new-student-name', 'new-student-roll', 'new-student-address',
    'new-student-place', 'new-student-district', 'new-student-state',
    'new-student-fatherName', 'new-student-motherName', 'new-student-fatherMobile',
    'new-student-fatherWhatsapp', 'new-student-rank', 'new-student-previousCollege'
  ];
  clearIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const yearEl = document.getElementById('new-student-yearJoined');
  if (yearEl) yearEl.value = '2024';

  // Populate classes dropdown
  const classSelect = document.getElementById('new-student-class');
  if (classSelect) {
    classSelect.innerHTML = (classesList || []).map(c => {
      const cName = c.name || c;
      return `<option value="${escapeHtml(cName)}">${escapeHtml(cName)}</option>`;
    }).join('');
  }

  await updateModalStudentCounts();

  try {
    const res = await API.getNextStudentId();
    if (res.success) {
      document.getElementById('auto-student-id').value = res.nextId;
    }
  } catch (e) {
    document.getElementById('auto-student-id').value = 2000;
  }
  document.getElementById('modal-add-student').classList.remove('hidden');
}

function closeStudentModal() {
  document.getElementById('modal-add-student').classList.add('hidden');
  newStudentPhotoUrl = '';
  newStudentBase64Photo = '';
}

async function handleSaveNewStudent(e) {
  e.preventDefault();
  const name = getStudentInputValue('new', 'name');
  const studentClass = getStudentInputValue('new', 'class') || (classesList[0]?.name || '');
  const roll = getStudentInputValue('new', 'roll');
  const fullAddress = getStudentInputValue('new', 'address');
  const place = getStudentInputValue('new', 'place');
  const district = getStudentInputValue('new', 'district');
  const state = getStudentInputValue('new', 'state');
  const fatherName = getStudentInputValue('new', 'fatherName');
  const motherName = getStudentInputValue('new', 'motherName');
  const fatherMobile = getStudentInputValue('new', 'fatherMobile');
  const fatherWhatsapp = getStudentInputValue('new', 'fatherWhatsapp');
  const yearJoined = getStudentInputValue('new', 'yearJoined') || '2024';
  const rank = getStudentInputValue('new', 'rank');
  const previousCollege = getStudentInputValue('new', 'previousCollege');
  const customFields = collectStudentCustomFields('new');

  const photoUrl = newStudentPhotoUrl || newStudentBase64Photo || DEFAULT_AVATAR;

  const payload = {
    name,
    class: studentClass,
    roll,
    photoUrl,
    address: { fullAddress, place, district, state },
    familyDetails: { fatherName, motherName, fatherMobile, fatherWhatsapp },
    academicStatus: { yearJoined, rank, previousCollege },
    customFields
  };

  try {
    const res = await API.addStudent(payload);
    if (res.success) {
      showToast(`Student "${name}" enrolled with ID ${res.data.studentId}!`);
      closeStudentModal();
      await renderStudentsDirectory();
      await loadAttendanceRoster();
      await loadReport();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// USER DIRECTIVE: "when update student show the all inputs to edit"
let activeEditStudentObjId = null;
async function openEditStudentModal(id) {
  activeEditStudentObjId = id;
  try {
    const res = await API.getStudents();
    const student = res.data.find(s => s._id === id);
    if (!student) return;

    editStudentPhotoUrl = student.photoUrl || '';
    editStudentBase64Photo = student.photoUrl || '';
    document.getElementById('edit-student-modal-title').innerText = `Edit Student: ${student.name}`;
    document.getElementById('edit-student-id').value = student.studentId;
    document.getElementById('edit-preview-photo').src = student.photoUrl || DEFAULT_AVATAR;

    // Populate class options in select
    const classSelect = document.getElementById('edit-student-class');
    if (classSelect) {
      classSelect.innerHTML = (classesList || []).map(c => {
        const cName = c.name || c;
        return `<option value="${escapeHtml(cName)}" ${isClassEqual(cName, student.class) ? 'selected' : ''}>${escapeHtml(cName)}</option>`;
      }).join('');
      const matchedOpt = Array.from(classSelect.options).find(o => isClassEqual(o.value, student.class));
      if (matchedOpt) classSelect.value = matchedOpt.value;
    }

    const setVal = (inputKey, val) => {
      const el = document.getElementById(inputKey);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('edit-student-name', student.name);
    setVal('edit-student-class', student.class);
    setVal('edit-student-roll', student.roll);
    setVal('edit-student-address', student.address?.fullAddress);
    setVal('edit-student-place', student.address?.place);
    setVal('edit-student-district', student.address?.district);
    setVal('edit-student-state', student.address?.state);
    setVal('edit-student-fatherName', student.familyDetails?.fatherName);
    setVal('edit-student-motherName', student.familyDetails?.motherName);
    setVal('edit-student-fatherMobile', student.familyDetails?.fatherMobile);
    setVal('edit-student-fatherWhatsapp', student.familyDetails?.fatherWhatsapp);
    setVal('edit-student-yearJoined', student.academicStatus?.yearJoined || student.academicStatus?.admissionStatus || '2024');
    setVal('edit-student-rank', student.academicStatus?.rank);
    setVal('edit-student-previousCollege', student.academicStatus?.previousCollege);

    document.getElementById('modal-edit-student').classList.remove('hidden');
  } catch (error) {
    showToast('Failed to load student details', true);
  }
}

function closeEditStudentModal() {
  document.getElementById('modal-edit-student').classList.add('hidden');
  activeEditStudentObjId = null;
  editStudentPhotoUrl = '';
  editStudentBase64Photo = '';
}

async function handleSaveEditedStudent(e) {
  e.preventDefault();
  if (!activeEditStudentObjId) return;

  const name = getStudentInputValue('edit', 'name');
  const studentClass = getStudentInputValue('edit', 'class');
  const roll = getStudentInputValue('edit', 'roll');
  const fullAddress = getStudentInputValue('edit', 'address');
  const place = getStudentInputValue('edit', 'place');
  const district = getStudentInputValue('edit', 'district');
  const state = getStudentInputValue('edit', 'state');
  const fatherName = getStudentInputValue('edit', 'fatherName');
  const motherName = getStudentInputValue('edit', 'motherName');
  const fatherMobile = getStudentInputValue('edit', 'fatherMobile');
  const fatherWhatsapp = getStudentInputValue('edit', 'fatherWhatsapp');
  const yearJoined = getStudentInputValue('edit', 'yearJoined');
  const rank = getStudentInputValue('edit', 'rank');
  const previousCollege = getStudentInputValue('edit', 'previousCollege');
  const customFields = collectStudentCustomFields('edit');

  const payload = {
    name,
    class: studentClass,
    roll,
    photoUrl: editStudentPhotoUrl || editStudentBase64Photo,
    address: { fullAddress, place, district, state },
    familyDetails: { fatherName, motherName, fatherMobile, fatherWhatsapp },
    academicStatus: { yearJoined, rank, previousCollege },
    customFields
  };

  try {
    const res = await API.updateStudent(activeEditStudentObjId, payload);
    if (res.success) {
      showToast(`Student "${name}" details updated!`);
      closeEditStudentModal();
      await renderStudentsDirectory();
      await loadAttendanceRoster();
      await loadReport();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// ================= READ-ONLY STUDENT DETAILS & PHOTO ENLARGE =================
// USER DIRECTIVE:
// "when click the photo from taking attendence show sudents details fully ....only to read not edit...one more click to photo show largly...."
async function openStudentDetailsModal(studentId) {
  let student = studentsList.find(s => s.studentId === studentId);
  if (!student) {
    try {
      const res = await API.getStudents();
      student = res.data.find(s => s.studentId === studentId);
    } catch (e) {
      console.log(e);
    }
  }
  if (!student) {
    showToast('Student information not found', true);
    return;
  }

  const photo = student.photoUrl || DEFAULT_AVATAR;
  document.getElementById('details-student-photo').src = photo;
  document.getElementById('details-student-name').innerText = student.name;
  document.getElementById('details-student-id').innerText = `ID: ${student.studentId}`;
  document.getElementById('details-student-class').innerText = `Class: ${student.class}`;
  document.getElementById('details-student-roll').innerText = `Roll #${student.roll}`;

  document.getElementById('details-student-address').innerText = (student.address && student.address.fullAddress) || '-';
  document.getElementById('details-student-place').innerText = (student.address && student.address.place) || '-';
  document.getElementById('details-student-district').innerText = (student.address && student.address.district) || '-';
  document.getElementById('details-student-state').innerText = (student.address && student.address.state) || '-';

  document.getElementById('details-student-father').innerText = (student.familyDetails && student.familyDetails.fatherName) || '-';
  document.getElementById('details-student-mother').innerText = (student.familyDetails && student.familyDetails.motherName) || '-';
  document.getElementById('details-student-mobile').innerText = (student.familyDetails && student.familyDetails.fatherMobile) || '-';
  document.getElementById('details-student-wa').innerText = (student.familyDetails && student.familyDetails.fatherWhatsapp) || '-';

  const yr = (student.academicStatus && (student.academicStatus.yearJoined || student.academicStatus.admissionStatus)) || '-';
  document.getElementById('details-student-year').innerText = yr;
  document.getElementById('details-student-rank').innerText = (student.academicStatus && student.academicStatus.rank) || '-';
  document.getElementById('details-student-college').innerText = (student.academicStatus && student.academicStatus.previousCollege) || '-';

  document.getElementById('modal-student-details').classList.remove('hidden');
}

function closeStudentDetailsModal() {
  document.getElementById('modal-student-details').classList.add('hidden');
}

// Lightbox: One more click to photo shows largely!
function openEnlargedPhoto(photoUrl, name) {
  const modal = document.getElementById('modal-photo-enlarged');
  const img = document.getElementById('enlarged-photo-img');
  const cap = document.getElementById('enlarged-photo-caption');
  if (img) img.src = photoUrl;
  if (cap) cap.innerText = name || 'Student Photo';
  if (modal) modal.classList.remove('hidden');
}

function closeEnlargedPhoto() {
  const modal = document.getElementById('modal-photo-enlarged');
  if (modal) modal.classList.add('hidden');
}

async function confirmDeleteStudent(id, name, studentId) {
  if (!confirm(`Are you sure you want to delete "${name}" (ID: ${studentId})?`)) return;
  triggerNavHaptic('delete');
  try {
    const res = await API.deleteStudent(id);
    if (res.success) {
      showToast(`Student "${name}" deleted.`);
      await renderStudentsDirectory();
      await loadAttendanceRoster();
      await loadReport();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// ================= ACTIVITY LOGS & UNDO =================
// USER DIRECTIVE:
// "add in logs of attendence .....present,absent,late"
// "remove undo from activity logs of non admin accounts"
let cachedActivityLogs = [];
let currentActivityLogFilter = 'all';

function setActivityLogFilter(filter) {
  currentActivityLogFilter = filter;
  const btnAll = document.getElementById('btn-log-filter-all');
  const btnMine = document.getElementById('btn-log-filter-mine');
  if (btnAll && btnMine) {
    if (filter === 'all') {
      btnAll.className = 'px-2 py-0.5 rounded-lg bg-[#245b70] text-white shadow-xs font-bold transition';
      btnMine.className = 'px-2 py-0.5 rounded-lg text-[var(--text-sub)] hover:text-[var(--text-main)] font-semibold transition';
    } else {
      btnMine.className = 'px-2 py-0.5 rounded-lg bg-[#245b70] text-white shadow-xs font-bold transition';
      btnAll.className = 'px-2 py-0.5 rounded-lg text-[var(--text-sub)] hover:text-[var(--text-main)] font-semibold transition';
    }
  }
  renderActivityLogsList();
}

function renderActivityLogsList() {
  const container = document.getElementById('activity-logs-container');
  if (!container) return;

  const logs = cachedActivityLogs || [];
  const myName = (currentUser && currentUser.name) ? currentUser.name.trim().toLowerCase() : '';

  let filteredLogs = logs;
  if (currentActivityLogFilter === 'mine' && myName) {
    filteredLogs = logs.filter(log => {
      const performed = (log.performedBy || '').trim().toLowerCase();
      const details = (log.details || '').trim().toLowerCase();
      return performed === myName || performed.includes(myName) || details.includes(myName);
    });
  }

  if (filteredLogs.length === 0) {
    container.innerHTML = `<div class="p-3 text-xs text-center text-[var(--text-sub)]">${currentActivityLogFilter === 'mine' ? 'No actions recorded for your account yet.' : 'No recent activity logs.'}</div>`;
    return;
  }

  const isAdmin = currentUser && currentUser.role === 'admin';

  container.innerHTML = filteredLogs.map(log => `
    <div id="log-item-${log._id}" class="p-2.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-center justify-between gap-2 ${log.isUndone ? 'opacity-50' : ''}">
      <div>
        <div class="font-bold text-[var(--text-main)] text-xs">${escapeHtml(log.action)}</div>
        <div class="text-[10px] text-[var(--text-sub)]">${escapeHtml(log.details || '')}</div>
        <div class="text-[9px] text-[#245b70] font-semibold mt-0.5">by ${escapeHtml(log.performedBy || '')}</div>
      </div>
      ${log.isUndone ? `
        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Reverted</span>
      ` : (isAdmin && log.canUndo ? `
        <!-- UNDO BUTTON: ONLY shown for Admin accounts as explicitly requested! -->
        <button onclick="undoLog('${log._id}', '${escapeHtml(log.action)}')" class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 hover:bg-amber-200 active:scale-95 transition">
          Undo
        </button>
      ` : '')}
    </div>
  `).join('');
}

async function loadActivityLogs() {
  const container = document.getElementById('activity-logs-container');
  if (!container) return;

  try {
    const res = await API.getLogs();
    if (res.success && res.data) {
      cachedActivityLogs = res.data;
      renderActivityLogsList();
      updateProfileDashboardKPIs();
    }
  } catch (error) {
    console.log('[Logs Load]', error);
  }
}

// Teacher Daily Summary & KPI Badges (At-a-Glance Dashboard)
async function updateProfileDashboardKPIs() {
  if (!currentUser) return;

  const todayClassesEl = document.getElementById('kpi-today-classes');
  const markedEl = document.getElementById('kpi-attendance-marked');
  const assignedEl = document.getElementById('kpi-assigned-classes');
  if (!todayClassesEl && !markedEl && !assignedEl) return;

  const myName = (currentUser.name || '').trim().toLowerCase();
  const myId = currentUser._id || currentUser.id || null;
  const isAdmin = currentUser.role === 'admin';

  // 1. Calculate today's classes from timetable
  try {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()].toLowerCase();

    const ttRes = await API.getTimetable('', '', '');
    const allSlots = (ttRes && ttRes.data) ? ttRes.data : (Array.isArray(ttRes) ? ttRes : []);
    const mySlots = allSlots.filter(s => isSlotForTeacher(s, myName, myId));

    const todaySlots = mySlots.filter(s => {
      const d = (s.day || '').trim().toLowerCase();
      const days = Array.isArray(s.days) ? s.days.map(x => x.trim().toLowerCase()) : [];
      const splitDays = d.split(',').map(x => x.trim().toLowerCase());
      return d === todayName || d === 'all days' || splitDays.includes(todayName) || days.includes(todayName) || days.includes('all days');
    });

    if (todayClassesEl) todayClassesEl.textContent = String(todaySlots.length);
  } catch (_) {}

  // 2. Count attendance marked today from logs
  try {
    const now = new Date();
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const logs = cachedActivityLogs || [];
    let markedTodayCount = 0;
    logs.forEach(log => {
      if (log.action && log.action.toLowerCase().includes('attendance')) {
        const performed = (log.performedBy || '').trim().toLowerCase();
        const isMyLog = isAdmin || performed === myName || performed.includes(myName);
        const logDate = log.timestamp || log.createdAt;
        if (isMyLog && logDate && String(logDate).startsWith(todayDateStr)) {
          markedTodayCount++;
        }
      }
    });
    if (markedEl) markedEl.textContent = String(markedTodayCount);
  } catch (_) {}

  // 3. Count assigned classes
  try {
    if (assignedEl) {
      if (isAdmin) {
        assignedEl.textContent = String(classesList.length);
      } else {
        const myAssigned = classesList.filter(c => {
          const ct = (c.classTeacher || '').trim().toLowerCase();
          return ct === myName || ct.includes(myName);
        });
        assignedEl.textContent = String(myAssigned.length || classesList.length);
      }
    }
  } catch (_) {}
}

async function undoLog(logId, actionName) {
  try {
    const res = await API.undoLog(logId);
    if (res.success) {
      showToast(`Reverted: "${actionName}"`);
      await loadActivityLogs();
      await loadAttendanceRoster();
      await loadClasses();
      await loadSubjects();
      await renderStudentsDirectory();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

function openActivityLogsModal() {
  const modal = document.getElementById('modal-activity-logs');
  if (modal) modal.classList.remove('hidden');
  loadActivityLogs();
}

function closeActivityLogsModal() {
  const modal = document.getElementById('modal-activity-logs');
  if (modal) modal.classList.add('hidden');
}

// ================= ADMIN PANEL & TEACHERS LIST =================
function handleAdminToggleNotifMorning(enabled) {
  try {
    localStorage.setItem('admin_notif_morning', enabled ? 'true' : 'false');
    showToast(enabled ? 'Morning timetable alerts enabled' : 'Morning timetable alerts disabled');
  } catch(_) {}
}

function handleAdminToggleNotifPreclass(enabled) {
  try {
    localStorage.setItem('admin_notif_preclass', enabled ? 'true' : 'false');
    showToast(enabled ? '5-minute pre-class reminders enabled' : '5-minute pre-class reminders disabled');
  } catch(_) {}
}

function handleAdminToggleNotifVibrate(enabled) {
  try {
    localStorage.setItem('admin_notif_vibrate', enabled ? 'true' : 'false');
    showToast(enabled ? 'Alert vibration enabled' : 'Alert vibration disabled');
  } catch(_) {}
}

function openAdminPanel() {
  document.getElementById('modal-admin-panel').classList.remove('hidden');
  loadAdminTeachersList();

  // Sync notification toggles in Admin Panel
  const tMorning = document.getElementById('admin-toggle-notif-morning');
  const tPreclass = document.getElementById('admin-toggle-notif-preclass');
  const tVibrate = document.getElementById('admin-toggle-notif-vibrate');
  if (tMorning) tMorning.checked = localStorage.getItem('admin_notif_morning') !== 'false';
  if (tPreclass) tPreclass.checked = localStorage.getItem('admin_notif_preclass') !== 'false';
  if (tVibrate) tVibrate.checked = localStorage.getItem('admin_notif_vibrate') !== 'false';
}

function closeAdminPanel() {
  document.getElementById('modal-admin-panel').classList.add('hidden');
}

async function loadAdminTeachersList() {
  const container = document.getElementById('admin-teachers-list');
  if (!container) return;

  try {
    const res = await API.getTeachers();
    if (res.success && res.data) {
      const teachers = res.data;
      container.innerHTML = teachers.map(t => {
        const isAdmin = t.role === 'admin';
        return `
          <div class="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border-color)] flex items-center justify-between gap-2 shadow-sm">
            <div class="min-w-0">
              <div class="font-bold text-[var(--text-main)] text-xs flex items-center gap-1.5 flex-wrap">
                <span class="truncate">${t.name}</span>
                ${isAdmin ? '<span class="text-[9px] font-black text-amber-800 bg-amber-100 dark:bg-amber-900/60 dark:text-amber-300 px-1.5 py-0.5 rounded">Admin</span>' : '<span class="text-[9px] font-bold text-blue-800 bg-blue-100 dark:bg-blue-900/60 dark:text-blue-300 px-1.5 py-0.5 rounded">Teacher</span>'}
              </div>
              <div class="text-[10px] text-[var(--text-sub)] truncate">${t.email}</div>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button onclick="toggleTeacherAdminRole('${t._id}', '${t.name.replace(/'/g, "\\'")}', '${t.role}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition shadow-sm ${
                isAdmin ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-[#245b70] hover:bg-[#1b4454] text-white'
              }">
                ${isAdmin ? 'Remove Admin' : 'Make Admin'}
              </button>
              <button onclick="deleteTeacherAccount('${t._id}', '${t.name.replace(/'/g, "\\'")}', '${t.role}')" class="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:hover:bg-rose-900 dark:text-rose-300 transition" title="Delete account">
                Remove
              </button>
              <button onclick="editTeacherName('${t._id}', '${t.name.replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition">
                Edit
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.log('[Teachers Load]', error);
  }
}

// USER DIRECTIVE: "also make an option to unadmin the admined accounts for admin by clicking the same button"
async function toggleTeacherAdminRole(id, name, currentRole) {
  const isCurrentlyAdmin = currentRole === 'admin';
  const actionText = isCurrentlyAdmin ? `remove Admin privileges from "${name}"` : `make "${name}" an Admin`;
  if (!confirm(`Are you sure you want to ${actionText}?`)) return;

  try {
    const res = await API.toggleTeacherAdmin(id);
    if (res.success) {
      showToast(res.message || `${name} role updated to ${res.data.role}!`);
      await loadAdminTeachersList();
      if (currentUser && currentUser._id === id) {
        await loadCurrentUser();
      }
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// USER DIRECTIVE: "also add remove teachers for admin near to make admin"
async function deleteTeacherAccount(id, name, role) {
  if (currentUser && currentUser._id === id) {
    showToast('You cannot delete your own logged-in admin account', true);
    return;
  }
  if (!confirm(`Are you sure you want to permanently remove teacher "${name}"?`)) return;
  triggerNavHaptic('delete');

  try {
    const res = await API.deleteTeacher(id);
    if (res.success) {
      showToast(res.message || `Account "${name}" removed successfully!`);
      await loadAdminTeachersList();
    }
  } catch (error) {
    showToast(error.message || 'Failed to remove teacher', true);
  }
}

async function editTeacherName(id, currentName) {
  const updated = prompt('Edit Teacher Name:', currentName);
  if (!updated || updated === currentName) return;

  try {
    const res = await API.editTeacher(id, updated);
    if (res.success) {
      showToast(`Teacher name updated to "${updated}"`);
      await loadAdminTeachersList();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// ================= BACKUP (ADMIN ONLY) =================
async function exportBackupData() {
  try {
    showToast('Admin: Preparing backup export...');
    const token = API.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/backup/export', {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to download backup');
    }

    const data = await res.json();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const downloadUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `REGISTERLY_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    }, 200);

    showToast('Admin: Database backup downloaded successfully!');
  } catch (error) {
    console.error('[Backup Export Error]', error);
    showToast(error.message || 'Failed to export backup', true);
  }
}

async function importBackupData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const res = await API.importBackup(data);
    if (res.success) {
      showToast('Admin: Database successfully restored from backup!');
      await loadAppSettings();
      await loadClasses();
      await loadSubjects();
      await loadTeachersData();
      await loadAttendanceRoster();
      await loadReport();
      await loadActivityLogs();
      await renderStudentsDirectory();
    }
  } catch (error) {
    showToast('Invalid backup file or restore failed', true);
  } finally {
    if (event.target) event.target.value = '';
  }
}

// ================= DATA CONTROLS (ADMIN ONLY) =================
// USER DIRECTIVE:
// "clear data for only clear data of attendence of whole class, not teachers, students, class ,subjects,details"
async function handleClearDataPrompt() {
  const confirmed = confirm(
    "⚠ CLEAR ATTENDANCE DATA:\n\n" +
    "Are you sure you want to clear attendance records? Teachers, students, classes, subjects, and student details will NOT be deleted."
  );
  if (!confirmed) return;
  triggerNavHaptic('delete');

  try {
    const res = await API.clearData();
    if (res.success) {
      showToast('All attendance records have been cleared!');
      await loadAttendanceRoster();
      await loadReport();
      await loadActivityLogs();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// USER DIRECTIVE:
// "reset button for clear all app data...like new"
async function handleResetAppPrompt() {
  const confirmed = confirm(
    "⚠ FULL APP RESET (LIKE NEW):\n\n" +
    "Are you sure you want to wipe all app data like new? All students, classes, subjects, attendance, logs, and settings will be completely reset."
  );
  if (!confirmed) return;
  triggerNavHaptic('delete');

  try {
    const res = await API.resetApp();
    if (res.success) {
      showToast('App has been reset like brand new!');
      await loadAppSettings();
      await loadClasses();
      await loadSubjects();
      await loadAttendanceRoster();
      await loadReport();
      await loadActivityLogs();
      await renderStudentsDirectory();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// ================= TAB NAVIGATION =================
function selectTopTab(tab) {
  triggerNavHaptic('medium');
  ['attendance', 'report', 'settings', 'classes', 'subjects', 'students', 'teachers'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`view-${tab}`);
  if (activeEl) activeEl.classList.remove('hidden');

  ['attendance', 'report', 'settings'].forEach(t => {
    const btn = document.getElementById(`top-tab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = "flex-1 py-2 px-1 sm:px-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1 sm:gap-1.5 bg-white text-[#245b70] shadow-md tab-transition truncate";
      } else {
        btn.className = "flex-1 py-2 px-1 sm:px-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 text-white/90 hover:text-white tab-transition truncate";
      }
    }
  });

  ['classes', 'subjects', 'students', 'teachers'].forEach(t => {
    const btn = document.getElementById(`bottom-tab-${t}`);
    if (btn) btn.className = "flex-1 flex flex-col items-center justify-center py-1 text-[var(--text-sub)] hover:text-[#245b70] font-medium tab-transition";
  });

  if (tab === 'report') {
    if (reportReadyToLoad) loadReport();
    else renderReportPlaceholder();
  }
  if (tab === 'settings') loadActivityLogs();
}

function selectBottomTab(tab) {
  triggerNavHaptic('medium');
  ['attendance', 'report', 'settings', 'classes', 'subjects', 'students', 'teachers'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`view-${tab}`);
  if (activeEl) activeEl.classList.remove('hidden');

  ['classes', 'subjects', 'students', 'teachers'].forEach(t => {
    const btn = document.getElementById(`bottom-tab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = "flex-1 flex flex-col items-center justify-center py-1 text-[#245b70] font-black tab-transition scale-105";
      } else {
        btn.className = "flex-1 flex flex-col items-center justify-center py-1 text-[var(--text-sub)] hover:text-[#245b70] font-medium tab-transition";
      }
    }
  });

  ['attendance', 'report', 'settings'].forEach(t => {
    const btn = document.getElementById(`top-tab-${t}`);
    if (btn) {
      btn.className = "flex-1 py-2 px-1 sm:px-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 text-white/90 hover:text-white tab-transition truncate";
    }
  });

  if (tab === 'classes') renderClassesList();
  if (tab === 'subjects') renderSubjectsList();
  if (tab === 'students') renderStudentsDirectory();
  if (tab === 'teachers') renderTeachersList();
}

// Modal triggers
async function openClassModal() {
  document.getElementById('input-class-name').value = '';
  await populateTeacherDropdowns('input-class-teacher', '');
  renderSubjectCheckboxesForClass('add-class-subjects-container', []);
  document.getElementById('modal-add-class').classList.remove('hidden');
}
function closeClassModal() {
  document.getElementById('modal-add-class').classList.add('hidden');
}
// Auth Modal & Controls
function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
  const closeBtn = document.getElementById('auth-close-btn');
  if (closeBtn) {
    if (!currentUser) {
      closeBtn.classList.add('hidden');
    } else {
      closeBtn.classList.remove('hidden');
    }
  }
  clearAuthAlert();
  renderGoogleButton();
}

function closeAuthModal() {
  if (!currentUser) {
    showToast('Please sign in to access REGISTERLY', true);
    return;
  }
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

// Switch between Sign In and Register tabs
function switchAuthTab(tab) {
  const tabSignin = document.getElementById('auth-tab-signin');
  const tabRegister = document.getElementById('auth-tab-register');
  const formSignin = document.getElementById('form-signin');
  const formRegister = document.getElementById('form-register');
  clearAuthAlert();

  if (tab === 'signin') {
    if (formSignin) formSignin.classList.remove('hidden');
    if (formRegister) formRegister.classList.add('hidden');
    if (tabSignin) tabSignin.className = "flex-1 py-2 rounded-xl text-xs sm:text-sm font-black custom-gradient-btn shadow-sm transition";
    if (tabRegister) tabRegister.className = "flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold text-[var(--text-sub)] hover:text-[var(--text-main)] transition";
  } else {
    if (formSignin) formSignin.classList.add('hidden');
    if (formRegister) formRegister.classList.remove('hidden');
    if (tabRegister) tabRegister.className = "flex-1 py-2 rounded-xl text-xs sm:text-sm font-black custom-gradient-btn shadow-sm transition";
    if (tabSignin) tabSignin.className = "flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold text-[var(--text-sub)] hover:text-[var(--text-main)] transition";
  }
}

// Show/Hide Password visibility toggle
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
    }
  }
}

// Inline Auth Alert Box
function showAuthAlert(message, isError = true) {
  const alertEl = document.getElementById('auth-alert');
  const textEl = document.getElementById('auth-alert-text');
  const iconEl = document.getElementById('auth-alert-icon');
  if (!alertEl || !textEl) return;

  textEl.innerText = message;
  if (iconEl) iconEl.innerText = isError ? '⚠' : '✓';
  alertEl.className = `p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all ${
    isError ? 'alert-error' : 'alert-success'
  }`;
  alertEl.classList.remove('hidden');
}

function clearAuthAlert() {
  const alertEl = document.getElementById('auth-alert');
  if (alertEl) alertEl.classList.add('hidden');
}

// ================= SECURE GOOGLE IDENTITY SERVICES (OAuth 2.0 / GSI) =================
let googleClientId = '';
let googleTokenClient = null;

async function initGoogleAuth() {
  try {
    const res = await API.getGoogleClientId();
    googleClientId = res && res.clientId ? res.clientId.trim() : '';
    renderGoogleButton();
  } catch (error) {
    console.warn('[Google Auth Init Error]', error);
  }
}

function renderGoogleButton() {
  const container = document.getElementById('g-signin-container');
  const directBtn = document.getElementById('btn-google-direct');
  const notice = document.getElementById('google-setup-notice');
  if (!container) return;

  if (!googleClientId) {
    if (notice) notice.classList.remove('hidden');
    if (directBtn) directBtn.classList.add('hidden');
    container.innerHTML = `
      <div class="w-full py-2.5 px-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-dashed border-amber-300 dark:border-amber-800 text-center">
        <span class="text-xs font-bold text-amber-700 dark:text-amber-300">🔑 Google OAuth awaiting Client ID in .env</span>
      </div>
    `;
    return;
  }

  if (notice) notice.classList.add('hidden');

  let attempts = 0;
  const setupGsi = () => {
    attempts++;
    if (window.google && window.google.accounts) {
      try {
        // 1. Setup ID Token GSI Button
        if (window.google.accounts.id) {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            error_callback: (err) => {
              console.warn('[Google GSI Error Callback]', err);
              if (directBtn) directBtn.classList.remove('hidden');
            },
            auto_select: false,
            cancel_on_tap_outside: true
          });

          container.innerHTML = '';
          window.google.accounts.id.renderButton(container, {
            theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
            size: 'large',
            type: 'standard',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320
          });
        }

        // 2. Setup OAuth2 Token Client for 1-Click popup fallback
        if (window.google.accounts.oauth2) {
          googleTokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'email profile openid',
            callback: handleGoogleTokenResponse,
            error_callback: (err) => {
              console.error('[Google OAuth2 Popup Error]', err);
              showAuthAlert('Google Sign-In Error: ' + (err.message || 'Popup blocked or cancelled'), true);
            }
          });
        }

        // Show direct button if iframe didn't attach or has origin limits
        setTimeout(() => {
          const hasIframe = container && container.querySelector('iframe');
          if (!hasIframe && directBtn) {
            directBtn.classList.remove('hidden');
          }
        }, 1200);

      } catch (err) {
        console.error('[Google GSI Setup Error]', err);
        if (directBtn) directBtn.classList.remove('hidden');
      }
    } else if (attempts < 20) {
      setTimeout(setupGsi, 200);
    } else {
      // If script didn't load (e.g. adblocker), show direct button
      if (directBtn) directBtn.classList.remove('hidden');
    }
  };

  setupGsi();
}

// Trigger Google Sign-In popup directly
function triggerGooglePopupSignIn() {
  clearAuthAlert();
  if (googleTokenClient) {
    try {
      googleTokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
      showAuthAlert('Could not launch Google popup: ' + e.message, true);
    }
  } else if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        showAuthAlert('Google One-Tap is not displayed. Please check that http://localhost:5000 is added in Google Cloud Console origins.', true);
      }
    });
  } else {
    showAuthAlert('Google Identity SDK is still loading. Please try again.', true);
  }
}

// Callback for OAuth2 access_token flow (Popup)
async function handleGoogleTokenResponse(tokenResponse) {
  if (!tokenResponse || !tokenResponse.access_token) {
    if (tokenResponse && tokenResponse.error) {
      showAuthAlert('Google Sign-In failed: ' + tokenResponse.error, true);
    }
    return;
  }

  clearAuthAlert();
  showToast('Authenticating with Google...');

  try {
    const res = await API.googleLogin({ access_token: tokenResponse.access_token });
    if (res.success) {
      showToast(res.message || `Welcome, ${res.user.name}!`);
      closeAuthModal();
      await loadCurrentUser();
      await loadAppSettings();
      await loadClasses();
      await loadSubjects();
      await loadTeachersData();
      await loadAttendanceRoster();
      await loadReport();
      await loadActivityLogs();
    }
  } catch (error) {
    showAuthAlert('Google Authentication Failed: ' + (error.message || 'Verification rejected'), true);
  }
}

// Google Identity Services Credential Callback (ID Token)
async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    showAuthAlert('Google Sign-In was cancelled or failed.', true);
    return;
  }

  clearAuthAlert();
  showToast('Verifying Google credentials...');

  try {
    const res = await API.googleLogin({ credential: response.credential });
    if (res.success) {
      showToast(res.message || `Welcome, ${res.user.name}!`);
      closeAuthModal();
      await loadCurrentUser();
      await loadAppSettings();
      await loadClasses();
      await loadSubjects();
      await loadTeachersData();
      await loadAttendanceRoster();
      await loadReport();
      await loadActivityLogs();
    }
  } catch (error) {
    showAuthAlert('Google Authentication Failed: ' + (error.message || 'Verification rejected'), true);
  }
}

// Handle Sign In (Email / Username & Password)
async function handleEmailLogin(e) {
  e.preventDefault();
  clearAuthAlert();
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const btn = document.getElementById('btn-signin-submit');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passInput ? passInput.value : '';

  if (!email || !password) {
    showAuthAlert('Please enter your username/email and password', true);
    return;
  }

  const originalBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Signing In...</span>`;
  }

  try {
    const res = await API.login(email, password);
    if (res.success) {
      showToast(res.message || `Welcome back, ${res.user.name}!`);
      closeAuthModal();
      await loadCurrentUser();
      await loadAppSettings();
      await loadClasses();
      await loadSubjects();
      await loadTeachersData();
      await loadAttendanceRoster();
      await loadReport();
      await loadActivityLogs();
    }
  } catch (error) {
    showAuthAlert(error.message || 'Invalid username/email or password', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
  }
}

// Handle Register (Create New Account)
async function handleEmailRegister(e) {
  e.preventDefault();
  clearAuthAlert();

  const nameInput = document.getElementById('register-name');
  const emailInput = document.getElementById('register-email');
  const passInput = document.getElementById('register-password');
  const confirmInput = document.getElementById('register-confirm');
  const btn = document.getElementById('btn-register-submit');

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passInput ? passInput.value : '';
  const confirmPass = confirmInput ? confirmInput.value : '';

  if (!name || !email || !password) {
    showAuthAlert('Please fill in all required fields', true);
    return;
  }

  if (password.length < 6) {
    showAuthAlert('Password must be at least 6 characters long', true);
    return;
  }

  if (password !== confirmPass) {
    showAuthAlert('Passwords do not match. Please re-enter.', true);
    return;
  }

  const originalBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Creating Account...</span>`;
  }

  try {
    const res = await API.register(name, email, password);
    if (res.success) {
      showToast(res.message || 'Account created successfully!');
      closeAuthModal();
      await loadCurrentUser();
      await loadAppSettings();
      await loadClasses();
      await loadSubjects();
      await loadTeachersData();
      await loadAttendanceRoster();
      await loadReport();
      await loadActivityLogs();
    }
  } catch (error) {
    showAuthAlert(error.message || 'Registration failed', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
  }
}

// Signout
// USER DIRECTIVE: "sign out error fix it .....not come out side the app to the login page"
function handleSignout() {
  API.setToken(null);
  currentUser = null;
  currentRole = null;
  updateUserUI();
  selectTopTab('attendance');
  const bubbleModal = document.getElementById('notif-bubble-timetable-modal');
  if (bubbleModal) bubbleModal.classList.add('hidden');
  const preclassCard = document.getElementById('notif-preclass-card');
  if (preclassCard) preclassCard.classList.add('hidden');
  showToast('Signed out successfully');
  openAuthModal();
}

// =========================================================================
// TEACHERS MANAGEMENT MODULE (4th Bottom Nav Tab)
// Connects teacher profile via Google auth email matching
// =========================================================================
let cachedTeachersList = [];
let availableTeacherYears = [];
let newTeacherPhotoUrl = '';
let editTeacherPhotoUrl = '';
let activeEditTeacherId = null;
let currentTeacherLogData = null;
let currentTeacherSessions = [];

// Helper to load teachers list into memory
async function loadTeachersData() {
  try {
    const yearEl = document.getElementById('teachers-filter-year');
    const classEl = document.getElementById('teachers-filter-class');
    const selectedYear = yearEl ? yearEl.value : 'all';
    const selectedClass = classEl ? classEl.value : 'all';

    const res = await API.getTeachers(selectedYear, selectedClass);
    if (res.success && Array.isArray(res.data)) {
      cachedTeachersList = res.data;
      if (Array.isArray(res.availableYears)) {
        availableTeacherYears = res.availableYears;
      }
      populateTeacherFilterDropdowns(selectedYear, selectedClass);
    }
  } catch (e) {
    console.log('[Teachers Load Error]', e);
  }
}

function populateTeacherFilterDropdowns(selectedYear = 'all', selectedClass = 'all') {
  const yearEl = document.getElementById('teachers-filter-year');
  const classEl = document.getElementById('teachers-filter-class');

  if (yearEl && (!yearEl.options || yearEl.options.length <= 1)) {
    let yearOptions = `<option value="all">All Years</option>`;
    (availableTeacherYears || []).forEach(yr => {
      yearOptions += `<option value="${yr}" ${selectedYear === yr ? 'selected' : ''}>${yr}</option>`;
    });
    yearEl.innerHTML = yearOptions;
  }

  if (classEl && (!classEl.options || classEl.options.length <= 1)) {
    let classOptions = `<option value="all">All Classes</option>`;
    (classesList || []).forEach(cl => {
      classOptions += `<option value="${escapeHtml(cl.name)}" ${selectedClass === cl.name ? 'selected' : ''}>${escapeHtml(cl.name)}</option>`;
    });
    classEl.innerHTML = classOptions;
  }
}

function handleTeacherFiltersChange() {
  renderTeachersList();
}

// Helper to populate teacher dropdowns in Add/Edit Class & Subject
async function populateTeacherDropdowns(targetSelectId, selectedValue = '') {
  if (!cachedTeachersList || cachedTeachersList.length === 0) {
    await loadTeachersData();
  }
  const selectEl = document.getElementById(targetSelectId);
  if (!selectEl) return;

  const isClassTeacher = targetSelectId.includes('class-teacher');
  const defaultLabel = isClassTeacher ? '-- Select Class Teacher --' : '-- Select Teacher --';

  let optionsHtml = `<option value="">${defaultLabel}</option>`;
  cachedTeachersList.forEach(t => {
    const isSel = (selectedValue && (selectedValue === t.name || selectedValue === t.email)) ? 'selected' : '';
    optionsHtml += `<option value="${escapeHtml(t.name)}" ${isSel}>${escapeHtml(t.name)}</option>`;
  });

  // If previous custom value exists, keep it selectable
  if (selectedValue && !cachedTeachersList.some(t => t.name === selectedValue || t.email === selectedValue)) {
    optionsHtml += `<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)}</option>`;
  }

  selectEl.innerHTML = optionsHtml;
}

// Helper to render class checkboxes for Teacher
function renderTeacherClassCheckboxes(containerId, selectedClasses = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!classesList || classesList.length === 0) {
    container.innerHTML = `<span class="col-span-full text-xs text-[var(--text-sub)] py-1">No classes available. Add classes first.</span>`;
    return;
  }

  container.innerHTML = classesList.map(c => {
    const isChecked = selectedClasses.includes(c.name) ? 'checked' : '';
    const safeId = `tc-${containerId}-${c.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return `
      <label for="${safeId}" class="flex items-center gap-1.5 p-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[#245b70] cursor-pointer text-xs select-none transition">
        <input type="checkbox" id="${safeId}" value="${escapeHtml(c.name)}" ${isChecked} class="rounded border-slate-300 text-[#245b70] focus:ring-[#245b70]">
        <span class="font-bold text-[var(--text-main)] truncate">${escapeHtml(c.name)}</span>
      </label>
    `;
  }).join('');
}

// Helper to render subject checkboxes for Teacher
function renderTeacherSubjectCheckboxes(containerId, selectedSubjects = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!subjectsList || subjectsList.length === 0) {
    container.innerHTML = `<span class="col-span-full text-xs text-[var(--text-sub)] py-1">No subjects available. Add subjects first.</span>`;
    return;
  }

  container.innerHTML = subjectsList.map(s => {
    const isChecked = selectedSubjects.includes(s.name) ? 'checked' : '';
    const safeId = `ts-${containerId}-${s.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return `
      <label for="${safeId}" class="flex items-center gap-1.5 p-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[#245b70] cursor-pointer text-xs select-none transition">
        <input type="checkbox" id="${safeId}" value="${escapeHtml(s.name)}" ${isChecked} class="rounded border-slate-300 text-[#245b70] focus:ring-[#245b70]">
        <span class="font-bold text-[var(--text-main)] truncate">${escapeHtml(s.name)}</span>
      </label>
    `;
  }).join('');
}

function getSelectedTeacherCheckboxes(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const checked = container.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(checked).map(cb => cb.value);
}

// Generate friendly fallback avatar
function getEmailAvatarPreview(email, name = '') {
  if (!email && !name) return DEFAULT_AVATAR;
  const label = (name || email || 'Teacher').trim();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=245b70&color=ffffff&bold=true&rounded=true`;
}

// Live email typing avatar preview
function handleTeacherEmailInput(type) {
  const emailInput = document.getElementById(`${type}-teacher-email`);
  const nameInput = document.getElementById(`${type}-teacher-name`);
  const preview = document.getElementById(`${type}-teacher-preview-photo`);

  if (!emailInput || !preview) return;
  const emailVal = emailInput.value.trim();
  const nameVal = nameInput ? nameInput.value.trim() : '';

  // Only auto-update preview if no custom photo has been uploaded
  if (type === 'new' && !newTeacherPhotoUrl) {
    preview.src = getEmailAvatarPreview(emailVal, nameVal);
  } else if (type === 'edit' && !editTeacherPhotoUrl) {
    preview.src = getEmailAvatarPreview(emailVal, nameVal);
  }
}

// Photo upload for Teacher
async function handleTeacherPhotoUpload(e, type) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const preview = document.getElementById(`${type}-teacher-preview-photo`);
  if (preview) {
    preview.src = URL.createObjectURL(file);
  }

  showToast('Uploading teacher photo...');
  try {
    const res = await API.uploadPhoto(file, 'teachers');
    if (res.success && res.url) {
      if (type === 'new') newTeacherPhotoUrl = res.url;
      else editTeacherPhotoUrl = res.url;
      if (preview) preview.src = res.url;
      showToast('Photo uploaded successfully!');
    }
  } catch (err) {
    console.error('[Photo Upload Error]', err);
    showToast('Uploaded photo saved locally');
  }
}

// USER DIRECTIVE: Render teachers cards in the 4th tab
async function renderTeachersList() {
  const container = document.getElementById('teachers-cards-container');
  const countEl = document.getElementById('teachers-count-total');
  const searchInput = document.getElementById('teacher-search-input');
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  try {
    await loadTeachersData();
    let teachers = cachedTeachersList || [];

    if (countEl) countEl.innerText = teachers.length;

    if (searchTerm) {
      teachers = teachers.filter(t =>
        (t.name && t.name.toLowerCase().includes(searchTerm)) ||
        (t.email && t.email.toLowerCase().includes(searchTerm)) ||
        (t.assignedClasses && t.assignedClasses.some(c => c.toLowerCase().includes(searchTerm))) ||
        (t.assignedSubjects && t.assignedSubjects.some(s => s.toLowerCase().includes(searchTerm)))
      );
    }

    if (!container) return;

    if (teachers.length === 0) {
      container.innerHTML = `
        <div class="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] text-center text-xs text-[var(--text-sub)]">
          No teachers found. Click "Add Teacher" above to add your first teacher profile!
        </div>
      `;
      return;
    }

    const yearEl = document.getElementById('teachers-filter-year');
    const classEl = document.getElementById('teachers-filter-class');
    const selectedYear = yearEl ? yearEl.value : 'all';
    const selectedClass = classEl ? classEl.value : 'all';

    container.innerHTML = teachers.map(t => {
      const avatar = t.avatarUrl || getEmailAvatarPreview(t.email, t.name);
      const isGoogleLinked = Boolean(t.googleConnected);
      const roleBadge = t.role === 'admin'
        ? `<span class="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[10px] border border-amber-500/20">Admin</span>`
        : `<span class="px-2 py-0.5 rounded-lg bg-slate-500/10 text-[var(--text-sub)] font-bold text-[10px] border border-[var(--border-color)]">Teacher</span>`;

      const googleStatusBadge = isGoogleLinked
        ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-md px-1.5 py-0.5" title="Profile connected with verified Google account">
            <svg class="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            Google Linked
          </span>`
        : (t.email
            ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-[var(--border-color)] rounded-md px-1.5 py-0.5" title="Matches Google login email to connect profile">
                Email Connected
              </span>`
            : `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md px-1.5 py-0.5" title="Edit teacher to link an email address">
                No Email
              </span>`);

      const subjectsPills = (t.assignedSubjects && t.assignedSubjects.length > 0)
        ? t.assignedSubjects.map(s => `<span class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold text-xs shadow-sm">${escapeHtml(s)}</span>`).join(' ')
        : `<span class="text-xs text-[var(--text-sub)] italic">None assigned</span>`;

      const totalAllTime = t.totalAllTimeSessions !== undefined ? t.totalAllTimeSessions : (t.sessionCount || 0);
      const currentSessions = t.sessionCount || 0;
      const sessionButtonLabel = selectedYear === 'all'
        ? `Log (${totalAllTime} Total)`
        : `Log (${currentSessions} in ${selectedYear})`;

      return `
        <div class="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition overflow-hidden">
          <!-- Main row: avatar left, content right -->
          <div class="flex gap-0">
            <!-- Left: Avatar column -->
            <div class="flex-shrink-0 flex flex-col items-center justify-start pt-3.5 px-3 pb-3">
              <img src="${avatar}" alt="${escapeHtml(t.name)}" class="w-14 h-14 rounded-2xl object-cover border-2 border-[#245b70]/40 shadow-sm">
            </div>

            <!-- Right: Content column -->
            <div class="flex-1 min-w-0 pt-3 pb-3 pr-3 flex flex-col gap-2">

              <!-- Row 1: Name + role badge + google badge | Edit + Delete -->
              <div class="flex items-start justify-between gap-1.5">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <h3 class="font-extrabold text-sm text-[var(--text-main)] leading-tight">${escapeHtml(t.name)}</h3>
                    ${roleBadge}
                  </div>
                  <div class="mt-0.5">${googleStatusBadge}</div>
                </div>
                ${canUserEditDelete() ? `
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button onclick="openEditTeacherModal('${t._id}')" title="Edit Teacher"
                    class="w-7 h-7 rounded-xl bg-[var(--bg-page)] text-[var(--text-sub)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition border border-[var(--border-color)]">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button onclick="handleDeleteTeacher('${t._id}', this.getAttribute('data-name'))" data-name="${escapeHtml(t.name)}" title="Delete Teacher"
                    class="w-7 h-7 rounded-xl btn-delete flex items-center justify-center transition">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>` : ''}
              </div>

              <!-- Row 2: Timetable + Log buttons -->
              <div class="flex gap-1.5">
                <button onclick="openTeacherTimetable('${escapeQuotes(t.name)}', '${t._id}')"
                  class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500 hover:text-white text-xs font-bold transition shadow-sm" title="View timetable">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <span>Timetable</span>
                </button>
                <button onclick="openTeacherLogModal('${t._id}')"
                  class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 hover:bg-[#245b70] hover:text-white text-xs font-bold transition shadow-sm" title="View logs">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  <span>${sessionButtonLabel}</span>
                </button>
              </div>

              <!-- Row 3: Email -->
              <p class="text-[11px] text-[var(--text-sub)] font-medium truncate leading-tight">
                ${t.email
                  ? '<svg class=\'w-3 h-3 inline mr-0.5 text-[var(--text-sub)] opacity-60\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'><path d=\'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z\'></path><polyline points=\'22,6 12,13 2,6\'></polyline></svg>' + escapeHtml(t.email)
                  : '<span class=\'text-slate-400 italic font-normal\'>No email linked</span>'}
              </p>
            </div>
          </div>

          <!-- Subjects strip at bottom -->
          <div class="border-t border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2 flex items-start gap-2">
            <span class="text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-wide pt-0.5 flex-shrink-0">Subjects</span>
            <div class="flex flex-wrap gap-1 flex-1">${subjectsPills}</div>
          </div>
        </div>
      `
    }).join('');
  } catch (error) {
    console.error('[Render Teachers List Error]', error);
  }
}

// Add Teacher Modal
function openAddTeacherModal() {
  newTeacherPhotoUrl = '';
  const preview = document.getElementById('new-teacher-preview-photo');
  if (preview) preview.src = DEFAULT_AVATAR;

  document.getElementById('new-teacher-name').value = '';
  document.getElementById('new-teacher-email').value = '';

  renderTeacherClassCheckboxes('new-teacher-classes-container', []);
  renderTeacherSubjectCheckboxes('new-teacher-subjects-container', []);

  document.getElementById('modal-add-teacher').classList.remove('hidden');
}

function closeAddTeacherModal() {
  document.getElementById('modal-add-teacher').classList.add('hidden');
  newTeacherPhotoUrl = '';
}

async function handleSaveTeacher(e) {
  e.preventDefault();
  const name = document.getElementById('new-teacher-name').value.trim();
  const email = document.getElementById('new-teacher-email').value.trim();
  const assignedClasses = getSelectedTeacherCheckboxes('new-teacher-classes-container');
  const assignedSubjects = getSelectedTeacherCheckboxes('new-teacher-subjects-container');

  if (!name) {
    showToast('Teacher name is required', true);
    return;
  }

  try {
    const res = await API.addTeacher({
      name,
      email,
      avatarUrl: newTeacherPhotoUrl,
      assignedClasses,
      assignedSubjects
    });

    if (res.success) {
      showToast(res.message || `Teacher "${name}" added!`);
      closeAddTeacherModal();
      await loadTeachersData();
      await renderTeachersList();
    }
  } catch (err) {
    showToast(err.message || 'Error adding teacher', true);
  }
}

// Edit Teacher Modal
async function openEditTeacherModal(id) {
  activeEditTeacherId = id;
  const teacher = (cachedTeachersList || []).find(t => t._id === id);
  if (!teacher) return;

  editTeacherPhotoUrl = teacher.avatarUrl || '';

  const idInput = document.getElementById('edit-teacher-id');
  const nameInput = document.getElementById('edit-teacher-name');
  const emailInput = document.getElementById('edit-teacher-email');
  const preview = document.getElementById('edit-teacher-preview-photo');
  const googleBadge = document.getElementById('edit-teacher-google-badge');

  if (idInput) idInput.value = teacher._id;
  if (nameInput) nameInput.value = teacher.name;
  if (emailInput) emailInput.value = teacher.email || '';
  if (preview) preview.src = teacher.avatarUrl || getEmailAvatarPreview(teacher.email, teacher.name);

  if (googleBadge) {
    if (teacher.googleConnected) {
      googleBadge.innerText = 'Google Linked';
      googleBadge.className = 'text-[10px] text-emerald-600 dark:text-emerald-400 font-bold';
    } else if (teacher.email) {
      googleBadge.innerText = 'Email Connected';
      googleBadge.className = 'text-[10px] text-slate-500 font-bold';
    } else {
      googleBadge.innerText = 'No Email Linked';
      googleBadge.className = 'text-[10px] text-amber-600 dark:text-amber-400 font-bold';
    }
  }

  renderTeacherClassCheckboxes('edit-teacher-classes-container', teacher.assignedClasses || []);
  renderTeacherSubjectCheckboxes('edit-teacher-subjects-container', teacher.assignedSubjects || []);

  document.getElementById('modal-edit-teacher').classList.remove('hidden');
}

function closeEditTeacherModal() {
  document.getElementById('modal-edit-teacher').classList.add('hidden');
  activeEditTeacherId = null;
  editTeacherPhotoUrl = '';
}

async function handleUpdateTeacher(e) {
  e.preventDefault();
  if (!activeEditTeacherId) return;

  const name = document.getElementById('edit-teacher-name').value.trim();
  const email = document.getElementById('edit-teacher-email').value.trim();
  const assignedClasses = getSelectedTeacherCheckboxes('edit-teacher-classes-container');
  const assignedSubjects = getSelectedTeacherCheckboxes('edit-teacher-subjects-container');

  try {
    const res = await API.editTeacher(activeEditTeacherId, {
      name,
      email,
      avatarUrl: editTeacherPhotoUrl,
      assignedClasses,
      assignedSubjects
    });

    if (res.success) {
      showToast(res.message || `Teacher "${name}" updated!`);
      closeEditTeacherModal();
      await loadTeachersData();
      await renderTeachersList();
    }
  } catch (err) {
    showToast(err.message || 'Error updating teacher', true);
  }
}

// Delete Teacher
async function handleDeleteTeacher(id, name) {
  if (!confirm(`Are you sure you want to remove teacher "${name}"?`)) return;

  try {
    const res = await API.deleteTeacher(id);
    if (res.success) {
      showToast(res.message || `Teacher "${name}" removed.`);
      await loadTeachersData();
      await renderTeachersList();
    }
  } catch (err) {
    showToast(err.message || 'Error deleting teacher', true);
  }
}

// =========================================================================
// TEACHER ACTIVITY & SESSION LOG MODAL
// USER DIRECTIVE: "also a 'log' button for how many class attended in which days in which class also how many sessions"
// =========================================================================
async function openTeacherLogModal(teacherId) {
  const modal = document.getElementById('modal-teacher-log');
  if (modal) modal.classList.remove('hidden');

  // Loading placeholders
  const nameEl = document.getElementById('tlog-name');
  const emailEl = document.getElementById('tlog-email');
  const avatarEl = document.getElementById('tlog-avatar');
  const sessionsCountEl = document.getElementById('tlog-total-sessions');
  const daysCountEl = document.getElementById('tlog-total-days');
  const classesCountEl = document.getElementById('tlog-classes-count');
  const sessionsContainer = document.getElementById('tlog-sessions-container');
  const filterSelect = document.getElementById('tlog-filter-class');

  if (nameEl) nameEl.innerText = 'Loading teacher logs...';
  if (emailEl) emailEl.innerText = '';
  if (avatarEl) avatarEl.src = DEFAULT_AVATAR;
  if (sessionsContainer) sessionsContainer.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">Fetching attendance sessions...</div>`;

  try {
    // Always fetch all sessions - filters applied inside log modal
    const res = await API.getTeacherLogs(teacherId, 'all', 'all');
    if (res.success) {
      currentTeacherLogData = res;
      currentTeacherSessions = res.sessions || [];

      const teacher = res.teacher;
      const stats = res.stats;

      if (nameEl) nameEl.innerText = teacher.name;
      if (emailEl) emailEl.innerText = teacher.email || 'No email linked';
      if (avatarEl) avatarEl.src = teacher.avatarUrl || getEmailAvatarPreview(teacher.email, teacher.name);

      const statusEl = document.getElementById('tlog-google-status');
      if (statusEl) {
        if (teacher.googleConnected) {
          statusEl.innerText = 'Google Linked';
          statusEl.className = 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
        } else if (teacher.email) {
          statusEl.innerText = 'Email Connected';
          statusEl.className = 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-[var(--border-color)]';
        } else {
          statusEl.innerText = 'No Email Linked';
          statusEl.className = 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
        }
      }

      if (sessionsCountEl) sessionsCountEl.innerText = stats.totalSessions;
      if (daysCountEl) daysCountEl.innerText = stats.totalDays;
      if (classesCountEl) classesCountEl.innerText = stats.classesCount;

      // Assigned Classes & Subjects
      const classesWrap = document.getElementById('tlog-assigned-classes');
      const subjectsWrap = document.getElementById('tlog-assigned-subjects');
      if (classesWrap) {
        classesWrap.innerHTML = (teacher.assignedClasses && teacher.assignedClasses.length > 0)
          ? teacher.assignedClasses.map(c => `<span class="px-2 py-0.5 rounded-lg bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 font-bold text-xs">${escapeHtml(c)}</span>`).join('')
          : `<span class="text-xs text-[var(--text-sub)] italic">None</span>`;
      }
      if (subjectsWrap) {
        subjectsWrap.innerHTML = (teacher.assignedSubjects && teacher.assignedSubjects.length > 0)
          ? teacher.assignedSubjects.map(s => `<span class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-xs">${escapeHtml(s)}</span>`).join('')
          : `<span class="text-xs text-[var(--text-sub)] italic">None</span>`;
      }

      // Populate Year Filter inside Log Modal
      const yearFilterInLog = document.getElementById('tlog-filter-year');
      if (yearFilterInLog) {
        const years = res.availableYears || [];
        let yearOpts = `<option value="all">All Years</option>`;
        years.forEach(yr => {
          yearOpts += `<option value="${escapeHtml(yr)}">${escapeHtml(yr)}</option>`;
        });
        yearFilterInLog.innerHTML = yearOpts;
      }

      // Populate Class Filter inside Log Modal
      if (filterSelect) {
        let optionsHtml = `<option value="all">All Classes</option>`;
        (stats.classesList || []).forEach(cl => {
          optionsHtml += `<option value="${escapeHtml(cl)}">${escapeHtml(cl)}</option>`;
        });
        filterSelect.innerHTML = optionsHtml;
      }

      renderTeacherLogSessionsList();
    }
  } catch (err) {
    console.error('[Teacher Logs Error]', err);
    if (sessionsContainer) {
      sessionsContainer.innerHTML = `<div class="p-4 text-center text-xs text-rose-500">Failed to load teacher logs: ${err.message}</div>`;
    }
  }
}

function filterTeacherLogSessions() {
  renderTeacherLogSessionsList();
}

function renderTeacherLogSessionsList() {
  const sessionsContainer = document.getElementById('tlog-sessions-container');
  const classFilter = document.getElementById('tlog-filter-class');
  const yearFilter = document.getElementById('tlog-filter-year');
  const selectedClass = classFilter ? classFilter.value : 'all';
  const selectedYear = yearFilter ? yearFilter.value : 'all';

  if (!sessionsContainer) return;

  let filtered = currentTeacherSessions || [];

  // Filter by year (date string starts with year e.g. "2025-03-15")
  if (selectedYear !== 'all') {
    filtered = filtered.filter(s => s.date && String(s.date).startsWith(selectedYear));
  }
  if (selectedClass !== 'all') {
    filtered = filtered.filter(s => isClassEqual(s.class, selectedClass));
  }

  if (filtered.length === 0) {
    sessionsContainer.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No attendance sessions recorded for this selection.</div>`;
    return;
  }

  sessionsContainer.innerHTML = filtered.map(s => {
    const summary = s.summary || { total: 0, present: 0, absent: 0, late: 0, percentage: 0 };
    return `
      <div class="bg-[var(--bg-page)] p-3 rounded-2xl border border-[var(--border-color)] flex items-center justify-between gap-3 text-xs hover:border-[#245b70] transition shadow-sm">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-extrabold text-[var(--text-main)] text-xs">${escapeHtml(s.date)}</span>
            <span class="px-2 py-0.5 rounded-lg bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 font-bold text-[11px]">${escapeHtml(s.class)}</span>
            <span class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">${escapeHtml(s.subject || 'All Subjects')}</span>
          </div>
          <p class="text-[11px] text-[var(--text-sub)]">Marked by: <span class="font-bold text-[var(--text-main)]">${escapeHtml(s.markedBy || 'Teacher')}</span></p>
        </div>

        <!-- Present / Absent / Leave Badges -->
        <div class="flex items-center gap-1.5 flex-shrink-0 text-[11px] font-bold">
          <span class="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">${summary.present} P</span>
          <span class="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">${summary.absent} A</span>
          <span class="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">${summary.leave !== undefined ? summary.leave : summary.late} Leave</span>
          <span class="px-2 py-0.5 rounded-lg bg-[#245b70] text-white font-extrabold">${summary.percentage}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function closeTeacherLogModal() {
  const modal = document.getElementById('modal-teacher-log');
  if (modal) modal.classList.add('hidden');
  currentTeacherLogData = null;
  currentTeacherSessions = [];
}


// ================= MESSAGES MODULE =================
let cachedMessages = [];

function _timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
  if (diff < 604800) return Math.floor(diff / 86400) + ' day ago';
  return new Date(dateStr).toLocaleDateString();
}

async function checkUnreadMessages() {
  try {
    const res = await API.getMessages();
    // Backend returns { success, data: [...], unreadCount }
    const messages = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
    cachedMessages = messages;
    const myId = currentUser && (currentUser._id || currentUser.id);
    // Use backend's unreadCount if available, else compute locally
    const unreadCount = (res && res.unreadCount !== undefined) ? res.unreadCount :
      messages.filter(m => {
        const readBy = (m.readBy || []).map(id => String(id));
        return !readBy.includes(String(myId));
      }).length;
    const badge = document.getElementById('unread-msg-badge');
    if (badge) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      if (unreadCount > 0) {
        badge.classList.remove('hidden');
        badge.style.display = 'flex';
      } else {
        badge.classList.add('hidden');
        badge.style.display = '';
      }
    }
  } catch (err) {
    // silently fail - not critical
  }
}

async function openMessagesModal() {
  const modal = document.getElementById('modal-messages');
  if (modal) modal.classList.remove('hidden');
  await loadMessages();
  try { await API.markMessagesRead(); } catch(_) {}
  const badge = document.getElementById('unread-msg-badge');
  if (badge) { badge.classList.add('hidden'); badge.style.display = ''; }
}

function closeMessagesModal() {
  const modal = document.getElementById('modal-messages');
  if (modal) modal.classList.add('hidden');
}

async function loadMessages() {
  const container = document.getElementById('messages-list-container');
  if (!container) return;
  container.innerHTML = `<div class="flex items-center justify-center py-8"><div class="w-6 h-6 rounded-full border-2 border-[#245b70] border-t-transparent animate-spin"></div></div>`;
  try {
    const res = await API.getMessages();
    // Backend returns { success: true, data: [...], unreadCount }
    const messages = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
    cachedMessages = messages;
    if (messages.length === 0) {
      container.innerHTML = `<div class="text-center text-xs text-[var(--text-sub)] py-8 italic">No messages yet. Be the first to post!</div>`;
      return;
    }
    const myId = currentUser && (currentUser._id || currentUser.id);
    container.innerHTML = messages.map(m => {
      const isMine = String(m.senderId) === String(myId);
      const avatar = m.senderAvatar || DEFAULT_AVATAR;
      const rolePill = m.senderRole === 'admin'
        ? `<span class="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[10px] border border-amber-500/20">Admin</span>`
        : `<span class="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-[var(--text-sub)] font-bold text-[10px]">Teacher</span>`;
      return `
        <div class="flex items-start gap-2.5 ${isMine ? 'flex-row-reverse' : ''}">
          <img src="${avatar}" alt="${escapeHtml(m.senderName)}" class="w-8 h-8 rounded-xl object-cover flex-shrink-0 border border-[var(--border-color)]">
          <div class="max-w-[78%] space-y-1 ${isMine ? 'items-end flex flex-col' : ''}">
            <div class="flex items-center gap-1.5 ${isMine ? 'flex-row-reverse' : ''}">
              <span class="font-extrabold text-xs text-[var(--text-main)]">${escapeHtml(m.senderName)}</span>
              ${rolePill}
              <span class="text-[10px] text-[var(--text-sub)]">${_timeAgo(m.createdAt)}</span>
            </div>
            <div class="${isMine ? 'bg-[#245b70] text-white' : 'bg-[var(--bg-page)] text-[var(--text-main)]'} px-3 py-2 rounded-2xl ${isMine ? 'rounded-tr-md' : 'rounded-tl-md'} text-xs font-medium border ${isMine ? 'border-[#245b70]' : 'border-[var(--border-color)]'} shadow-sm cursor-pointer select-none active:scale-98 transition relative"
              onmousedown="handleMsgStartHold(event, '${m._id}')"
              onmouseup="handleMsgEndHold(event)"
              onmouseleave="handleMsgEndHold(event)"
              ontouchstart="handleMsgStartHold(event, '${m._id}')"
              ontouchend="handleMsgEndHold(event)"
              ontouchcancel="handleMsgEndHold(event)"
              oncontextmenu="handleMsgContextMenu(event, '${m._id}')"
              title="Click & hold to edit or delete"
              style="white-space:pre-wrap;word-break:break-word;">
              ${escapeHtml(m.text)}
              ${m.isEdited ? '<span class="text-[9px] opacity-75 ml-1 italic">(edited)</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    // scroll to bottom (messages are chronological from backend)
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-6">Failed to load messages: ${escapeHtml(err.message)}</div>`;
  }
}

async function handleSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('message-input-text');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  try {
    await API.sendMessage(text);
    input.value = '';
    await loadMessages();
  } catch (err) {
    showToast('Failed to send message: ' + err.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
  }
}

// ================= TIMETABLE MODULE =================
let currentTimetableDay = 'all';
let timetableViewTeacher = null;     // string: teacher name being viewed
let timetableViewTeacherId = null;   // string: teacher ObjectId if available
let timetableReadOnly = false;       // true=no add/edit/delete buttons
let timetableEditingSlotId = null;

// Helper: match slot strictly to teacher name or id (no blank or partial string collisions!)
function isSlotForTeacher(slot, teacherName, teacherId = null) {
  if (!slot) return false;
  const target = (teacherName || '').trim().toLowerCase();
  const slotTeacher = (slot.teacher || '').trim().toLowerCase();

  if (teacherId && slot.teacherId && String(slot.teacherId) === String(teacherId)) {
    return true;
  }
  if (target && slotTeacher && target === slotTeacher) {
    return true;
  }
  return false;
}

// Open current logged-in account's timetable (from Profile tab)
async function openMyTimetable() {
  if (!currentUser) return;
  timetableViewTeacher = (currentUser.name || '').trim();
  timetableViewTeacherId = currentUser._id || currentUser.id || null;
  timetableReadOnly = false; // Always editable for the user's own profile!
  await openTimetableModal();
}

// Open timetable for a specific teacher (from Teachers tab)
// USER DIRECTIVE:
// "In teachers tab.... When click time of a teacher ....show that teacher time table only which he seted in his account from profile tab...."
// "In teacher tab....Also gave admin to edit and delete and and slot to time table of every teacher....."
async function openTeacherTimetable(teacherName, teacherId = null) {
  const isAdmin = currentUser && currentUser.role === 'admin';
  const myName = (currentUser && currentUser.name ? currentUser.name : '').trim().toLowerCase();
  const targetTeacher = (teacherName || '').trim();
  const isMe = myName && myName === targetTeacher.toLowerCase();

  timetableViewTeacher = targetTeacher;
  timetableViewTeacherId = teacherId || null;
  // Editable for admin AND the teacher themselves!
  timetableReadOnly = !(isAdmin || isMe);
  await openTimetableModal();
}

async function openTimetableModal() {
  const modal = document.getElementById('modal-timetable');
  if (modal) modal.classList.remove('hidden');

  // Populate class filter
  const classFilter = document.getElementById('timetable-filter-class');
  if (classFilter) {
    classFilter.innerHTML = `<option value="all">All Classes</option>` +
      classesList.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
  }

  // Fallback: If timetableViewTeacher was not set, default to currentUser
  if (!timetableViewTeacher && currentUser) {
    timetableViewTeacher = (currentUser.name || '').trim();
    timetableViewTeacherId = currentUser._id || currentUser.id || null;
  }

  const isAdminTT = currentUser && currentUser.role === 'admin';
  const myName = (currentUser && currentUser.name ? currentUser.name : '').trim().toLowerCase();
  const targetLower = (timetableViewTeacher || '').toLowerCase();
  const isMe = myName && myName === targetLower;

  // Show/hide Add button:
  // Admin can add a slot to ANY teacher's timetable (or their own);
  // Non-admin can add a slot to their OWN timetable.
  const addSlotBtn = document.getElementById('btn-add-timetable-slot');
  const canAddSlot = !timetableReadOnly && (isAdminTT || isMe);
  if (addSlotBtn) addSlotBtn.classList.toggle('hidden', !canAddSlot);

  // Update title & subtitle
  const ttTitleEl = document.getElementById('timetable-modal-title') || document.querySelector('#modal-timetable h3');
  const ttSubtitleEl = document.getElementById('timetable-modal-subtitle');
  if (ttTitleEl) {
    if (isMe) {
      ttTitleEl.textContent = 'My Timetable';
    } else if (timetableViewTeacher) {
      ttTitleEl.textContent = `${timetableViewTeacher}'s Timetable`;
    } else {
      ttTitleEl.textContent = 'Timetable';
    }
  }
  if (ttSubtitleEl) {
    if (isMe) {
      ttSubtitleEl.textContent = 'Your personal class schedule & timetable slots';
    } else if (timetableViewTeacher) {
      ttSubtitleEl.textContent = `Class schedule assigned to ${timetableViewTeacher}`;
    }
  }

  // Default to All Days
  currentTimetableDay = 'all';
  _updateTimetableDayTabs();
  await renderTimetableSlots();
}

function closeTimetableModal() {
  const modal = document.getElementById('modal-timetable');
  if (modal) modal.classList.add('hidden');
  timetableViewTeacher = null;
  timetableViewTeacherId = null;
  timetableReadOnly = false;
}

function _updateTimetableDayTabs() {
  document.querySelectorAll('.tt-day-btn').forEach(btn => {
    const day = btn.getAttribute('data-day');
    if (day === currentTimetableDay || (currentTimetableDay === 'all' && day === 'all')) {
      btn.className = 'tt-day-btn px-2.5 py-1 rounded-xl bg-[#245b70] text-white shadow-sm transition font-bold text-xs';
    } else {
      btn.className = 'tt-day-btn px-2.5 py-1 rounded-xl bg-[var(--bg-page)] text-[var(--text-sub)] hover:text-[var(--text-main)] transition font-bold text-xs border border-[var(--border-color)]';
    }
  });
}

async function selectTimetableDay(day) {
  currentTimetableDay = day;
  _updateTimetableDayTabs();
  await renderTimetableSlots();
}

async function renderTimetableSlots() {
  const container = document.getElementById('timetable-slots-container');
  if (!container) return;
  container.innerHTML = `<div class="flex items-center justify-center py-8"><div class="w-6 h-6 rounded-full border-2 border-[#245b70] border-t-transparent animate-spin"></div></div>`;

  const classFilter = document.getElementById('timetable-filter-class');
  const selectedClass = classFilter ? classFilter.value : 'all';

  try {
    const dayParam = currentTimetableDay === 'all' ? '' : currentTimetableDay;
    const res = await API.getTimetable(selectedClass === 'all' ? '' : selectedClass, dayParam, timetableViewTeacher || '');
    let slots = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

    // USER DIRECTIVE:
    // "Not mix all time tables.."
    // Strictly filter by teacher/account
    if (timetableViewTeacher) {
      slots = slots.filter(s => isSlotForTeacher(s, timetableViewTeacher, timetableViewTeacherId));
    }

    if (slots.length === 0) {
      const emptyMsg = timetableViewTeacher
        ? `No timetable slots scheduled for ${escapeHtml(timetableViewTeacher)} on ${escapeHtml(currentTimetableDay)}.`
        : `No slots for ${escapeHtml(currentTimetableDay)}${selectedClass !== 'all' ? ' · ' + escapeHtml(selectedClass) : ''}.`;
      container.innerHTML = `
        <div class="text-center py-8 text-xs text-[var(--text-sub)]">
          <svg class="w-10 h-10 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          ${emptyMsg}
        </div>`;
      return;
    }

    cachedCurrentTimetableSlots = slots;
    container.innerHTML = _generateTimetableSlotsHtml(slots);
  } catch (err) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-6">Failed to load timetable: ${escapeHtml(err.message)}</div>`;
  }
}

let selectedSlotDays = [];

function renderSlotDayChips(initialDays = []) {
  const container = document.getElementById('slot-day-chips');
  if (!container) return;
  const daysList = [
    { label: 'Mon', full: 'Monday' },
    { label: 'Tue', full: 'Tuesday' },
    { label: 'Wed', full: 'Wednesday' },
    { label: 'Thu', full: 'Thursday' },
    { label: 'Fri', full: 'Friday' },
    { label: 'Sat', full: 'Saturday' },
    { label: 'Sun', full: 'Sunday' },
    { label: 'All', full: 'All Days' }
  ];

  if (Array.isArray(initialDays)) {
    selectedSlotDays = initialDays.map(d => d.trim()).filter(Boolean);
  } else if (typeof initialDays === 'string' && initialDays) {
    selectedSlotDays = initialDays.split(',').map(d => d.trim()).filter(Boolean);
  } else {
    selectedSlotDays = [];
  }

  container.innerHTML = daysList.map(d => {
    const isSelected = selectedSlotDays.includes(d.full) || (d.full === 'All Days' && selectedSlotDays.includes('All Days'));
    const btnCls = isSelected
      ? 'bg-[#245b70] text-white border-[#245b70] shadow-xs'
      : 'bg-[var(--bg-page)] text-[var(--text-sub)] border-[var(--border-color)] hover:text-[var(--text-main)]';
    return `
      <button type="button" onclick="toggleSlotDaySelection('${d.full}')"
        data-day="${d.full}"
        class="slot-day-chip px-2 py-1.5 rounded-xl border text-xs font-bold transition flex items-center justify-center ${btnCls}">
        ${d.label}
      </button>
    `;
  }).join('');

  _updateSlotDayHiddenInput();
}

function toggleSlotDaySelection(dayName) {
  if (dayName === 'All Days') {
    if (selectedSlotDays.includes('All Days')) {
      selectedSlotDays = [];
    } else {
      selectedSlotDays = ['All Days'];
    }
  } else {
    selectedSlotDays = selectedSlotDays.filter(d => d !== 'All Days');
    if (selectedSlotDays.includes(dayName)) {
      selectedSlotDays = selectedSlotDays.filter(d => d !== dayName);
    } else {
      selectedSlotDays.push(dayName);
    }
  }

  document.querySelectorAll('.slot-day-chip').forEach(btn => {
    const d = btn.getAttribute('data-day');
    const isSelected = selectedSlotDays.includes(d);
    if (isSelected) {
      btn.className = 'slot-day-chip px-2 py-1.5 rounded-xl border text-xs font-bold transition flex items-center justify-center bg-[#245b70] text-white border-[#245b70] shadow-xs';
    } else {
      btn.className = 'slot-day-chip px-2 py-1.5 rounded-xl border text-xs font-bold transition flex items-center justify-center bg-[var(--bg-page)] text-[var(--text-sub)] border-[var(--border-color)] hover:text-[var(--text-main)]';
    }
  });

  _updateSlotDayHiddenInput();
}

function _updateSlotDayHiddenInput() {
  const hiddenInput = document.getElementById('slot-input-day');
  if (hiddenInput) {
    hiddenInput.value = selectedSlotDays.join(', ');
  }
}

async function openAddTimetableSlotModal(slotId = null) {
  timetableEditingSlotId = slotId;
  const modal = document.getElementById('modal-add-timetable-slot');
  if (!modal) return;

  // Reset form
  const form = modal.querySelector('form');
  if (form) form.reset();
  const editIdInput = document.getElementById('slot-edit-id');
  if (editIdInput) editIdInput.value = slotId || '';

  // Initial day selection
  const defaultDay = currentTimetableDay === 'all' ? ['Monday'] : [currentTimetableDay];
  renderSlotDayChips(defaultDay);

  // Populate class dropdown
  const classSelect = document.getElementById('slot-input-class');
  if (classSelect) {
    classSelect.innerHTML = `<option value="">Select class...</option>` +
      classesList.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
  }

  // Populate subject dropdown
  const subjectSelect = document.getElementById('slot-input-subject');
  if (subjectSelect) {
    subjectSelect.innerHTML = `<option value="">Select subject...</option>` +
      subjectsList.map(s => `<option value="${escapeHtml(s.name || s)}">${escapeHtml(s.name || s)}</option>`).join('');
  }

  // Target teacher / account
  const targetTeacherName = timetableViewTeacher || (currentUser && currentUser.name) || '';
  const targetTeacherId = timetableViewTeacherId || (currentUser && (currentUser._id || currentUser.id)) || '';

  const teacherInput = document.getElementById('slot-input-teacher');
  const teacherIdInput = document.getElementById('slot-input-teacher-id');
  const assigneeNameEl = document.getElementById('slot-assignee-name');

  if (teacherInput) teacherInput.value = targetTeacherName;
  if (teacherIdInput) teacherIdInput.value = targetTeacherId;
  if (assigneeNameEl) assigneeNameEl.textContent = targetTeacherName;

  // If editing, pre-fill values
  if (slotId) {
    try {
      const res = await API.getTimetable('', '', '');
      const slots = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
      const slot = slots.find(s => String(s._id) === String(slotId));
      if (slot) {
        const slotDays = (Array.isArray(slot.days) && slot.days.length > 0)
          ? slot.days
          : (slot.day ? slot.day.split(',').map(d => d.trim()).filter(Boolean) : [currentTimetableDay]);
        renderSlotDayChips(slotDays);

        const timeInput = document.getElementById('slot-input-time');
        if (timeInput) timeInput.value = slot.timeSlot || slot.time || '';
        if (classSelect) classSelect.value = slot.class || '';
        filterTimetableSubjectsByClass();
        if (subjectSelect) subjectSelect.value = slot.subject || '';
        if (teacherInput && slot.teacher) teacherInput.value = slot.teacher;
        if (teacherIdInput && slot.teacherId) teacherIdInput.value = slot.teacherId;
        if (assigneeNameEl && slot.teacher) assigneeNameEl.textContent = slot.teacher;
        const roomInput = document.getElementById('slot-input-room');
        if (roomInput) roomInput.value = slot.room || '';
      }
    } catch(_) {}
  }

  // Update modal title
  const titleEl = document.getElementById('timetable-slot-modal-title');
  if (titleEl) titleEl.textContent = slotId ? 'Edit Timetable Slot' : 'Add Timetable Slot';

  modal.classList.remove('hidden');
}

function closeAddTimetableSlotModal() {
  const modal = document.getElementById('modal-add-timetable-slot');
  if (modal) modal.classList.add('hidden');
  timetableEditingSlotId = null;
}

async function handleSaveTimetableSlot(e) {
  e.preventDefault();
  const slotId = (document.getElementById('slot-edit-id') || {}).value || timetableEditingSlotId;
  const teacherName = ((document.getElementById('slot-input-teacher') || {}).value || timetableViewTeacher || (currentUser && currentUser.name) || '').trim();
  const teacherIdVal = ((document.getElementById('slot-input-teacher-id') || {}).value || timetableViewTeacherId || (currentUser && (currentUser._id || currentUser.id)) || '').trim();

  const daysArr = selectedSlotDays.length > 0
    ? selectedSlotDays
    : [((document.getElementById('slot-input-day') || {}).value || '').trim()].filter(Boolean);

  const slotData = {
    day: daysArr.join(', '),
    days: daysArr,
    timeSlot: (document.getElementById('slot-input-time') || {}).value || '',
    class: (document.getElementById('slot-input-class') || {}).value || '',
    subject: (document.getElementById('slot-input-subject') || {}).value || '',
    teacher: teacherName,
    teacherId: teacherIdVal || null,
    room: (document.getElementById('slot-input-room') || {}).value || '',
  };

  if (!slotData.day || !slotData.timeSlot || !slotData.class || !slotData.subject) {
    showToast('Please select at least one day, time, class and subject.', true);
    return;
  }

  // Feature 3: Schedule conflict / overlap detection
  const newRange = _parseSlotTimeRange(slotData.timeSlot);
  if (newRange && cachedCurrentTimetableSlots && cachedCurrentTimetableSlots.length > 0) {
    const overlapping = cachedCurrentTimetableSlots.find(s => {
      if (slotId && String(s._id) === String(slotId)) return false;
      const existingDays = Array.isArray(s.days) && s.days.length > 0
        ? s.days
        : (s.day || '').split(',').map(x => x.trim()).filter(Boolean);
      const daysOverlap = daysArr.some(d =>
        d === 'All Days' || existingDays.includes('All Days') || existingDays.includes(d)
      );
      if (!daysOverlap) return false;

      const existRange = _parseSlotTimeRange(s.timeSlot || s.time);
      if (!existRange) return false;

      return (newRange.startMin < existRange.endMin && existRange.startMin < newRange.endMin);
    });

    if (overlapping) {
      const proceed = confirm(
        `⚠️ Schedule Conflict Warning!\n\nThis slot overlaps with an existing class:\n` +
        `• Subject: ${overlapping.subject} (${overlapping.class})\n` +
        `• Time: ${overlapping.timeSlot || overlapping.time}\n` +
        `• Day(s): ${overlapping.day || (overlapping.days || []).join(', ')}\n\n` +
        `Do you still want to save this slot?`
      );
      if (!proceed) return;
    }
  }

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    if (slotId) {
      await API.updateTimetableSlot(slotId, slotData);
      showToast('Timetable slot updated!');
    } else {
      await API.createTimetableSlot(slotData);
      showToast('Timetable slot added!');
    }
    closeAddTimetableSlotModal();
    if (currentTimetableDay !== 'all' && !daysArr.includes(currentTimetableDay) && !daysArr.includes('All Days')) {
      currentTimetableDay = daysArr[0] || 'all';
      _updateTimetableDayTabs();
    }
    await renderTimetableSlots();
    checkAndTriggerTimetableNotifications();
  } catch (err) {
    showToast('Failed to save slot: ' + err.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = slotId ? 'Save Changes' : 'Save Slot'; }
  }
}

async function deleteTimetableSlot(id) {
  if (!confirm('Delete this timetable slot?')) return;
  triggerNavHaptic('delete');
  try {
    await API.deleteTimetableSlot(id);
    showToast('Slot deleted.');
    await renderTimetableSlots();
    checkAndTriggerTimetableNotifications();
  } catch (err) {
    showToast('Failed to delete slot: ' + err.message, true);
  }
}

// ---- TIMETABLE HELPERS ----

// Filter subjects dropdown by selected class in add-slot form
function filterTimetableSubjectsByClass() {
  const classSelect = document.getElementById('slot-input-class');
  const subjectSelect = document.getElementById('slot-input-subject');
  if (!classSelect || !subjectSelect) return;
  const selectedClass = classSelect.value;
  const cls = classesList.find(c => isClassEqual(c.name || c, selectedClass));
  const subjects = (cls && cls.assignedSubjects && cls.assignedSubjects.length > 0)
    ? cls.assignedSubjects
    : subjectsList.map(s => s.name || s);
  const currentVal = subjectSelect.value;
  subjectSelect.innerHTML = '<option value="">Select subject...</option>' +
    subjects.map(s => '<option value="' + escapeHtml(s) + '" ' + (s === currentVal ? 'selected' : '') + '>' + escapeHtml(s) + '</option>').join('');
}


// ================= TIMETABLE DRAG & DROP AND GENERATOR =================
let cachedCurrentTimetableSlots = [];
let draggedTimetableSlotId = null;

// Parse a slot time range like "09:00 AM - 10:00 AM" into start and end minute numbers
function _parseSlotTimeRange(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(/[-–—to]/i).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const meridiems = String(timeStr).match(/(am|pm)/gi) || [];
  const defaultMeridiem = meridiems[meridiems.length - 1] ? meridiems[meridiems.length - 1].toLowerCase() : null;

  function parsePart(partStr, fallbackMeridiem) {
    if (!partStr) return null;
    let m = fallbackMeridiem;
    const directM = partStr.match(/(am|pm)/i);
    if (directM) m = directM[1].toLowerCase();

    const timeMatch = partStr.match(/(\d{1,2})[:.](\d{2})/);
    let h = 0, min = 0;
    if (timeMatch) {
      h = parseInt(timeMatch[1], 10);
      min = parseInt(timeMatch[2], 10);
    } else {
      const singleH = partStr.match(/(\d{1,2})/);
      if (!singleH) return null;
      h = parseInt(singleH[1], 10);
      min = 0;
    }
    if (m === 'pm' && h < 12) h += 12;
    if (m === 'am' && h === 12) h = 0;
    if (isNaN(h) || isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  const startMin = parsePart(parts[0], meridiems.length > 1 ? meridiems[0].toLowerCase() : defaultMeridiem);
  if (startMin === null) return null;

  let endMin = null;
  if (parts.length > 1) {
    endMin = parsePart(parts[1], defaultMeridiem);
  }
  if (endMin === null || endMin <= startMin) {
    endMin = startMin + 50; // default period 50 mins
  }

  return { startMin, endMin };
}

// Clean printable weekly schedule view (Print / Save as PDF)
function printTimetableSchedule() {
  const printSheet = document.getElementById('timetable-print-sheet');
  if (!printSheet) return;

  const appName = (appSettings && appSettings.appName && appSettings.appName.trim())
    ? appSettings.appName.trim()
    : (localStorage.getItem('registerly_app_name') || 'REGISTERLY');

  const teacherDisplay = timetableViewTeacher || (currentUser ? currentUser.name : 'Weekly Schedule');
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Group slots by day
  const slotsByDay = {};
  daysOfWeek.forEach(d => { slotsByDay[d] = []; });

  (cachedCurrentTimetableSlots || []).forEach(slot => {
    let days = [];
    if (Array.isArray(slot.days) && slot.days.length > 0) {
      days = slot.days;
    } else if (slot.day) {
      days = slot.day.split(',').map(d => d.trim()).filter(Boolean);
    }
    days.forEach(day => {
      if (day.toLowerCase() === 'all days' || day.toLowerCase() === 'all') {
        daysOfWeek.forEach(d => slotsByDay[d].push(slot));
      } else {
        const match = daysOfWeek.find(d => d.toLowerCase() === day.toLowerCase());
        if (match) slotsByDay[match].push(slot);
      }
    });
  });

  // Sort each day chronologically
  daysOfWeek.forEach(day => {
    slotsByDay[day].sort((a, b) => {
      const tA = _parseSlotStartTime(a.timeSlot || a.time);
      const tB = _parseSlotStartTime(b.timeSlot || b.time);
      if (!tA && !tB) return 0;
      if (!tA) return 1;
      if (!tB) return -1;
      return (tA.hours * 60 + tA.minutes) - (tB.hours * 60 + tB.minutes);
    });
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let tablesHtml = daysOfWeek.map(day => {
    const slots = slotsByDay[day];
    if (slots.length === 0) return '';
    const rows = slots.map(s => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 12px; font-weight: 700; color: #1e293b; font-size: 12px; white-space: nowrap;">${escapeHtml(s.timeSlot || s.time || '-')}</td>
        <td style="padding: 8px 12px; font-weight: 800; color: #0f172a; font-size: 13px;">${escapeHtml(s.subject || '-')}</td>
        <td style="padding: 8px 12px; font-weight: 600; color: #334155; font-size: 12px;">${escapeHtml(s.class || '-')}</td>
        <td style="padding: 8px 12px; color: #64748b; font-size: 11px;">${s.room ? escapeHtml(s.room) : '-'}</td>
      </tr>
    `).join('');

    return `
      <div style="margin-bottom: 20px; break-inside: avoid;">
        <div style="background: #f1f5f9; padding: 6px 12px; border-left: 4px solid #245b70; font-weight: 800; font-size: 13px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
          ${day}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 4px; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569;">
              <th style="padding: 6px 12px;">Time</th>
              <th style="padding: 6px 12px;">Subject</th>
              <th style="padding: 6px 12px;">Class</th>
              <th style="padding: 6px 12px;">Room</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }).filter(Boolean).join('');

  if (!tablesHtml) {
    tablesHtml = `
      <div style="padding: 30px; text-align: center; color: #64748b; font-size: 13px;">
        No timetable slots scheduled to display.
      </div>
    `;
  }

  printSheet.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; max-width: 900px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #245b70; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(appName)}</h1>
          <h2 style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #1e293b;">Timetable: ${escapeHtml(teacherDisplay)}</h2>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          <div>Generated: ${escapeHtml(dateStr)}</div>
          <div style="font-weight: 600; color: #245b70; margin-top: 2px;">Official Schedule</div>
        </div>
      </div>
      <div>
        ${tablesHtml}
      </div>
      <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 8px; text-align: center; font-size: 10px; color: #94a3b8;">
        Printed from ${escapeHtml(appName)} Attendance & Timetable Management System
      </div>
    </div>
  `;

  document.body.classList.add('printing-timetable');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-timetable');
    printSheet.innerHTML = '';
  }, 1000);
}

function _generateTimetableSlotsHtml(slots) {
  if (!slots || slots.length === 0) {
    return `
      <div class="text-center py-8 text-xs text-[var(--text-sub)]">
        <svg class="w-10 h-10 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        No timetable slots found. Click "+ Add Slot" to create one.
      </div>`;
  }

  const isAdminUser = currentUser && currentUser.role === 'admin';
  const myName = currentUser && currentUser.name ? currentUser.name.trim().toLowerCase() : '';
  const myId = currentUser ? String(currentUser._id || currentUser.id || '') : '';

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[now.getDay()];
  const todayLower = todayName.toLowerCase();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return slots.map(slot => {
    const slotTeacher = (slot.teacher || '').trim().toLowerCase();
    const isOwnSlot = (myName && slotTeacher === myName) || (myId && slot.teacherId && String(slot.teacherId) === myId);

    // USER DIRECTIVE:
    // "Also add edit, delete button to time table window in admin and all users..."
    // "In teacher tab....Also gave admin to edit and delete and and slot to time table of every teacher....."
    const canEditThisSlot = !timetableReadOnly && (isAdminUser || isOwnSlot);

    // Extract day names for clean presentation below subject and class
    let slotDays = [];
    if (Array.isArray(slot.days) && slot.days.length > 0) {
      slotDays = slot.days;
    } else if (slot.day) {
      slotDays = slot.day.split(',').map(d => d.trim()).filter(Boolean);
    }
    const dayBadgesHtml = slotDays.map(d => `<span class="px-1.5 py-0.5 rounded-md bg-teal-500/10 text-teal-800 dark:text-teal-300 font-bold text-[9px]">${escapeHtml(d)}</span>`).join('');

    // Feature 2: LIVE NOW and NEXT (in Xm) status indicators
    const isTodaySlot = slotDays.some(d => {
      const dl = d.trim().toLowerCase();
      return dl === todayLower || dl === 'all days' || dl === 'all';
    });

    let liveBadgeHtml = '';
    let isLiveNow = false;
    if (isTodaySlot) {
      const range = _parseSlotTimeRange(slot.timeSlot || slot.time);
      if (range) {
        if (nowMin >= range.startMin && nowMin < range.endMin) {
          isLiveNow = true;
          liveBadgeHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-[9px] animate-pulse border border-emerald-500/30">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              LIVE NOW
            </span>
          `;
        } else if (nowMin < range.startMin && (range.startMin - nowMin) <= 90) {
          const diff = range.startMin - nowMin;
          liveBadgeHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold text-[9px] border border-amber-500/30">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              NEXT (in ${diff}m)
            </span>
          `;
        }
      }
    }

    const editDelBtns = canEditThisSlot ? `
      <div class="flex gap-1 flex-shrink-0">
        <button type="button" onclick="openAddTimetableSlotModal('${escapeHtml(String(slot._id))}')" title="Edit Slot" class="w-8 h-8 rounded-xl bg-[var(--bg-page)] text-[var(--text-sub)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition border border-[var(--border-color)] active:scale-95 shadow-xs">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button type="button" onclick="deleteTimetableSlot('${escapeHtml(String(slot._id))}')" title="Delete Slot" class="w-8 h-8 rounded-xl btn-delete flex items-center justify-center transition active:scale-95 shadow-xs">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>` : '';

    const liveBorderClass = isLiveNow
      ? 'border-emerald-500/60 dark:border-emerald-400/60 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/30'
      : 'border-[var(--border-color)] hover:border-[#245b70]';

    return `
      <div class="bg-[var(--bg-page)] p-3 rounded-2xl border ${liveBorderClass} flex items-center justify-between gap-3 transition shadow-sm cursor-grab active:cursor-grabbing"
        draggable="true"
        data-slot-id="${slot._id}"
        ondragstart="handleTimetableDragStart(event, '${slot._id}')"
        ondragover="handleTimetableDragOver(event)"
        ondrop="handleTimetableDrop(event, '${slot._id}')"
        ondragend="handleTimetableDragEnd(event)">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="cursor-grab text-slate-400 hover:text-[#245b70] flex-shrink-0" title="Drag to reorder slots">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
          </div>
          <div class="flex-shrink-0 w-9 h-9 rounded-xl ${isLiveNow ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-[#245b70]/10 text-[#245b70] dark:text-cyan-400'} flex items-center justify-center">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div class="min-w-0 space-y-1 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-black text-xs text-[var(--text-main)]">${escapeHtml(slot.timeSlot || slot.time || '')}</span>
              ${liveBadgeHtml}
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">${escapeHtml(slot.subject || '')}</span>
              <span class="px-2 py-0.5 rounded-lg bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 font-bold text-[10px]">${escapeHtml(slot.class || '')}</span>
              ${slot.room ? `<span class="text-[10px] text-[var(--text-sub)]">· ${escapeHtml(slot.room)}</span>` : ''}
            </div>
            ${dayBadgesHtml ? `
            <div class="flex items-center gap-1 flex-wrap pt-0.5">
              ${dayBadgesHtml}
            </div>` : ''}
          </div>
        </div>
        ${editDelBtns}
      </div>
    `;
  }).join('');
}

function handleTimetableDragStart(e, slotId) {
  draggedTimetableSlotId = slotId;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('opacity-40');
}

function handleTimetableDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

async function handleTimetableDrop(e, targetSlotId) {
  e.preventDefault();
  if (!draggedTimetableSlotId || String(draggedTimetableSlotId) === String(targetSlotId)) return;

  const fromIndex = cachedCurrentTimetableSlots.findIndex(s => String(s._id) === String(draggedTimetableSlotId));
  const toIndex = cachedCurrentTimetableSlots.findIndex(s => String(s._id) === String(targetSlotId));

  if (fromIndex === -1 || toIndex === -1) return;

  const [movedSlot] = cachedCurrentTimetableSlots.splice(fromIndex, 1);
  cachedCurrentTimetableSlots.splice(toIndex, 0, movedSlot);

  const container = document.getElementById('timetable-slots-container');
  if (container) {
    container.innerHTML = _generateTimetableSlotsHtml(cachedCurrentTimetableSlots);
  }

  try {
    const orderedIds = cachedCurrentTimetableSlots.map(s => s._id);
    await API.reorderTimetable(orderedIds);
  } catch (err) {
    showToast('Failed to save order: ' + err.message, true);
  }
}

function handleTimetableDragEnd(e) {
  if (e && e.currentTarget) e.currentTarget.classList.remove('opacity-40');
  draggedTimetableSlotId = null;
}

// ================= MESSAGE CLICK & HOLD (LONG PRESS) & CLEAR CHAT =================
let msgHoldTimer = null;
let activeSelectedMessage = null;

function handleMsgStartHold(e, msgId) {
  if (msgHoldTimer) clearTimeout(msgHoldTimer);
  const msg = (cachedMessages || []).find(m => String(m._id) === String(msgId));
  if (!msg) return;

  msgHoldTimer = setTimeout(() => {
    openMessageActionsModal(msg);
  }, 450);
}

function handleMsgEndHold(e) {
  if (msgHoldTimer) {
    clearTimeout(msgHoldTimer);
    msgHoldTimer = null;
  }
}

function handleMsgContextMenu(e, msgId) {
  e.preventDefault();
  handleMsgEndHold();
  const msg = (cachedMessages || []).find(m => String(m._id) === String(msgId));
  if (msg) openMessageActionsModal(msg);
}

function openMessageActionsModal(msg) {
  activeSelectedMessage = msg;
  const modal = document.getElementById('modal-message-actions');
  const preview = document.getElementById('message-actions-preview');
  const btnEdit = document.getElementById('btn-msg-action-edit');
  const btnDelete = document.getElementById('btn-msg-action-delete');

  if (preview) preview.textContent = msg.text;

  const myId = currentUser && (currentUser._id || currentUser.id);
  const isAdmin = currentUser && currentUser.role === 'admin';
  const isMine = String(msg.senderId) === String(myId);

  if (btnEdit) btnEdit.style.display = (isMine || isAdmin) ? 'flex' : 'none';
  if (btnDelete) btnDelete.style.display = (isMine || isAdmin) ? 'flex' : 'none';

  if (modal) modal.classList.remove('hidden');
}

function closeMessageActionsModal() {
  const modal = document.getElementById('modal-message-actions');
  if (modal) modal.classList.add('hidden');
  activeSelectedMessage = null;
}

async function promptEditSelectedMessage() {
  if (!activeSelectedMessage) return;
  const currentText = activeSelectedMessage.text;
  const newText = prompt('Edit your message:', currentText);
  if (newText === null || !newText.trim() || newText.trim() === currentText) {
    closeMessageActionsModal();
    return;
  }

  try {
    const res = await API.editMessage(activeSelectedMessage._id, newText.trim());
    if (res.success) {
      showToast('Message updated');
      closeMessageActionsModal();
      await loadMessages();
    }
  } catch (err) {
    showToast(err.message || 'Failed to edit message', true);
  }
}

async function confirmDeleteSelectedMessage() {
  if (!activeSelectedMessage) return;
  if (!confirm('Are you sure you want to delete this message?')) return;
  triggerNavHaptic('delete');

  try {
    const res = await API.deleteMessage(activeSelectedMessage._id);
    if (res.success) {
      showToast('Message deleted');
      closeMessageActionsModal();
      await loadMessages();
    }
  } catch (err) {
    showToast(err.message || 'Failed to delete message', true);
  }
}

async function handleClearAllChat() {
  if (!confirm('Are you sure you want to delete all chat history? This cannot be undone.')) return;
  triggerNavHaptic('delete');
  try {
    const res = await API.clearAllMessages();
    if (res.success) {
      showToast('All chat history cleared');
      await loadMessages();
    }
  } catch (err) {
    showToast(err.message || 'Failed to clear chat', true);
  }
}

// ================= STUDENT DETAILS PRINT & CSV EXPORT =================
function _applyStudentPrintButtonVisibility() {
  const section = document.getElementById('student-export-section');
  if (!section) return;
  const isAllowed = !appSettings || appSettings.allowStudentDetailsPrint !== false;
  section.classList.toggle('hidden', !isAllowed);
}

async function handleAdminToggleStudentPrint(checked) {
  try {
    const res = await API.toggleStudentPrintAccess(checked);
    if (res.success) {
      if (appSettings) appSettings.allowStudentDetailsPrint = res.allowStudentDetailsPrint;
      _applyStudentPrintButtonVisibility();
      showToast(res.allowStudentDetailsPrint ? 'Student Details Print enabled' : 'Student Details Print disabled');
    }
  } catch (err) {
    showToast(err.message || 'Failed to toggle access', true);
  }
}

// ================= PRINT / EXPORT OPTION CHOICE MODAL =================
function openPrintDataChoiceModal() {
  const modal = document.getElementById('modal-print-data-choice');
  if (modal) modal.classList.remove('hidden');
}

function closePrintDataChoiceModal() {
  const modal = document.getElementById('modal-print-data-choice');
  if (modal) modal.classList.add('hidden');
}

function selectPrintOption(type) {
  closePrintDataChoiceModal();
  if (type === 'students') {
    openStudentExportModal();
  } else if (type === 'attendance') {
    openAttendanceExportModal();
  }
}

// ================= STUDENT DETAILS PRINT & CSV EXPORT =================
async function openStudentExportModal() {
  const modal = document.getElementById('modal-student-export');
  if (!modal) return;

  if (!classesList || classesList.length === 0) {
    try { await loadClasses(); } catch(_) {}
  }

  const classSelect = document.getElementById('export-student-class');
  if (classSelect) {
    const currentVal = classSelect.value || 'all';
    classSelect.innerHTML = `<option value="all">All Classes</option>` +
      classesList.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
    classSelect.value = currentVal;
  }

  modal.classList.remove('hidden');
}

function closeStudentExportModal() {
  const modal = document.getElementById('modal-student-export');
  if (modal) modal.classList.add('hidden');
}

function toggleAllExportCheckboxes() {
  const container = document.getElementById('export-fields-container');
  if (!container) return;
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(c => c.checked);
  checkboxes.forEach(c => c.checked = !allChecked);
}

// Exact order: photo, id, name, class, roll no, address, place, district, state, father's name, father's number, mother's name, year joined, rank, previous college
function _getSelectedExportFields() {
  return {
    photo: Boolean(document.getElementById('chk-export-photo')?.checked),
    id: Boolean(document.getElementById('chk-export-id')?.checked),
    name: Boolean(document.getElementById('chk-export-name')?.checked),
    class: Boolean(document.getElementById('chk-export-class')?.checked),
    roll: Boolean(document.getElementById('chk-export-roll')?.checked),
    address: Boolean(document.getElementById('chk-export-address')?.checked),
    place: Boolean(document.getElementById('chk-export-place')?.checked),
    district: Boolean(document.getElementById('chk-export-district')?.checked),
    state: Boolean(document.getElementById('chk-export-state')?.checked),
    father: Boolean(document.getElementById('chk-export-father')?.checked),
    mobile: Boolean(document.getElementById('chk-export-mobile')?.checked),
    mother: Boolean(document.getElementById('chk-export-mother')?.checked),
    year: Boolean(document.getElementById('chk-export-year')?.checked),
    rank: Boolean(document.getElementById('chk-export-rank')?.checked),
    college: Boolean(document.getElementById('chk-export-college')?.checked)
  };
}

async function executeStudentPrintA4() {
  const classFilter = document.getElementById('export-student-class')?.value || 'all';
  const fields = _getSelectedExportFields();

  try {
    showToast('Preparing A4 Printable Sheet...');
    const res = await API.getStudents(classFilter === 'all' ? 'all' : classFilter);
    const students = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

    if (students.length === 0) {
      showToast('No students found for selected class', true);
      return;
    }

    const printableContainer = document.getElementById('printable-student-cards');
    if (!printableContainer) return;

    // Chunk students into pages of 18 cards each (3 columns x 6 rows grid)
    const pageSize = 18;
    const pages = [];
    for (let i = 0; i < students.length; i += pageSize) {
      pages.push(students.slice(i, i + pageSize));
    }

    const schoolTitle = (appSettings && appSettings.schoolName)
      ? appSettings.schoolName
      : (appSettings && appSettings.appName ? appSettings.appName : 'REGISTERLY');

    let html = '';
    pages.forEach((pageStudents, pageIdx) => {
      html += `<div class="a4-page">`;
      pageStudents.forEach(st => {
        const photo = st.photoUrl || DEFAULT_AVATAR;
        const fatherName = (st.familyDetails && st.familyDetails.fatherName) || '-';
        const fatherMobile = (st.familyDetails && st.familyDetails.fatherMobile) || '-';
        const motherName = (st.familyDetails && st.familyDetails.motherName) || '-';
        const address = (st.address && st.address.fullAddress) || '-';
        const place = (st.address && st.address.place) || '-';
        const district = (st.address && st.address.district) || '-';
        const state = (st.address && st.address.state) || '-';
        const roll = st.roll !== undefined ? st.roll : '-';
        const yearJoined = (st.academicStatus && st.academicStatus.yearJoined) || '-';
        const rank = (st.academicStatus && st.academicStatus.rank) || '-';
        const college = (st.academicStatus && st.academicStatus.previousCollege) || '-';

        html += `
          <div class="a4-student-card">
            <!-- Header: Photo + ID & Name -->
            <div style="display:flex;align-items:center;gap:6px;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:2px;">
              ${fields.photo ? `
                <img src="${photo}" alt="" style="width:34px;height:34px;border-radius:6px;object-fit:cover;border:1px solid #cbd5e1;flex-shrink:0;">
              ` : `
                <div style="width:34px;height:34px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11pt;color:#334155;flex-shrink:0;">
                  ${escapeHtml((st.name || 'S')[0].toUpperCase())}
                </div>
              `}
              <div style="min-width:0;flex:1;overflow:hidden;">
                ${fields.name ? `<div style="font-weight:800;font-size:8pt;color:#0f172a;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(st.name)}</div>` : ''}
                <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:1.5px;">
                  ${fields.id ? `<span style="font-weight:700;font-size:6.5pt;color:#475569;">ID: #${st.studentId}</span>` : ''}
                  ${fields.class ? `<span style="font-weight:700;font-size:6.5pt;color:#0284c7;background:#e0f2fe;padding:0.5px 4px;border-radius:3px;">${escapeHtml(st.class)}</span>` : ''}
                  ${fields.roll ? `<span style="font-weight:700;font-size:6.5pt;color:#334155;background:#f1f5f9;padding:0.5px 4px;border-radius:3px;">Roll: ${roll}</span>` : ''}
                </div>
              </div>
            </div>

            <!-- Details Body (Compact, no redundant spacing) -->
            <div style="display:flex;flex-direction:column;gap:1.5px;font-size:6.8pt;color:#334155;line-height:1.25;min-width:0;">
              ${fields.address ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">Address:</strong> ${escapeHtml(address)}</div>` : ''}
              ${fields.place ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">Place:</strong> ${escapeHtml(place)}</div>` : ''}
              ${fields.district ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">District:</strong> ${escapeHtml(district)}</div>` : ''}
              ${fields.state ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">State:</strong> ${escapeHtml(state)}</div>` : ''}
              ${fields.father ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">Father:</strong> ${escapeHtml(fatherName)}</div>` : ''}
              ${fields.mobile ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">Contact:</strong> ${escapeHtml(fatherMobile)}</div>` : ''}
              ${fields.mother ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">Mother:</strong> ${escapeHtml(motherName)}</div>` : ''}
              ${fields.year ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">Year:</strong> ${escapeHtml(yearJoined)}</div>` : ''}
              ${fields.rank ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">Rank:</strong> ${escapeHtml(rank)}</div>` : ''}
              ${fields.college ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#0f172a;font-weight:700;">College:</strong> ${escapeHtml(college)}</div>` : ''}
            </div>

            <!-- Footer Badge -->
            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px dashed #cbd5e1;padding-top:2px;margin-top:auto;font-size:6pt;color:#64748b;">
              <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80%;">${escapeHtml(schoolTitle)}</span>
              <span>P.${pageIdx + 1}</span>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    });

    printableContainer.innerHTML = html;
    closeStudentExportModal();

    const subtitleEl = document.getElementById('a4-preview-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `${students.length} Student${students.length > 1 ? 's' : ''} (${classFilter === 'all' ? 'All Classes' : classFilter}) • 18 Cards per Page (3x6 Grid)`;
    }

    const previewModal = document.getElementById('modal-student-a4-preview');
    if (previewModal) {
      previewModal.classList.remove('hidden');
    }
  } catch (err) {
    showToast('Failed to prepare print: ' + err.message, true);
  }
}

function closeStudentA4Preview() {
  const modal = document.getElementById('modal-student-a4-preview');
  if (modal) modal.classList.add('hidden');
}

function triggerStudentCardsPrint() {
  document.body.classList.add('print-cards-active');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('print-cards-active');
  }, 1000);
}

window.addEventListener('beforeprint', () => {
  const reportView = document.getElementById('view-report');
  const printable = document.getElementById('printable-report');
  if (reportView && !reportView.classList.contains('hidden') && printable && !printable.classList.contains('hidden') && !document.body.classList.contains('print-cards-active')) {
    document.body.classList.add('print-report-active');
  }
});

window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-cards-active');
  document.body.classList.remove('print-report-active');
});

// CSV Export in the exact order requested by user:
// photo, id, name, class, roll no, address, place, district, state, father's name, father's number, mother's name, year joined, rank, previous college
async function executeStudentExportCSV() {
  const classFilter = document.getElementById('export-student-class')?.value || 'all';
  const fields = _getSelectedExportFields();

  try {
    showToast('Generating CSV file...');
    const res = await API.getStudents(classFilter === 'all' ? 'all' : classFilter);
    const students = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

    if (students.length === 0) {
      showToast('No students to export', true);
      return;
    }

    const headers = [];
    if (fields.photo) headers.push('Photo URL');
    if (fields.id) headers.push('Student ID');
    if (fields.name) headers.push('Name');
    if (fields.class) headers.push('Class');
    if (fields.roll) headers.push('Roll No');
    if (fields.address) headers.push('Address');
    if (fields.place) headers.push('Place');
    if (fields.district) headers.push('District');
    if (fields.state) headers.push('State');
    if (fields.father) headers.push("Father's Name");
    if (fields.mobile) headers.push("Father's Number");
    if (fields.mother) headers.push("Mother's Name");
    if (fields.year) headers.push('Year Joined');
    if (fields.rank) headers.push('Rank');
    if (fields.college) headers.push('Previous College');

    const csvRows = [headers.join(',')];

    students.forEach(st => {
      const row = [];
      const fatherName = (st.familyDetails && st.familyDetails.fatherName) || '';
      const fatherMobile = (st.familyDetails && st.familyDetails.fatherMobile) || '';
      const motherName = (st.familyDetails && st.familyDetails.motherName) || '';
      const address = (st.address && st.address.fullAddress) || '';
      const place = (st.address && st.address.place) || '';
      const district = (st.address && st.address.district) || '';
      const state = (st.address && st.address.state) || '';
      const yearJoined = (st.academicStatus && st.academicStatus.yearJoined) || '';
      const rank = (st.academicStatus && st.academicStatus.rank) || '';
      const prevCollege = (st.academicStatus && st.academicStatus.previousCollege) || '';

      if (fields.photo) row.push(`"${(st.photoUrl || '').replace(/"/g, '""')}"`);
      if (fields.id) row.push(`"${st.studentId}"`);
      if (fields.name) row.push(`"${(st.name || '').replace(/"/g, '""')}"`);
      if (fields.class) row.push(`"${(st.class || '').replace(/"/g, '""')}"`);
      if (fields.roll) row.push(`"${st.roll !== undefined ? st.roll : ''}"`);
      if (fields.address) row.push(`"${address.replace(/"/g, '""')}"`);
      if (fields.place) row.push(`"${place.replace(/"/g, '""')}"`);
      if (fields.district) row.push(`"${district.replace(/"/g, '""')}"`);
      if (fields.state) row.push(`"${state.replace(/"/g, '""')}"`);
      if (fields.father) row.push(`"${fatherName.replace(/"/g, '""')}"`);
      if (fields.mobile) row.push(`"${fatherMobile.replace(/"/g, '""')}"`);
      if (fields.mother) row.push(`"${motherName.replace(/"/g, '""')}"`);
      if (fields.year) row.push(`"${yearJoined.replace(/"/g, '""')}"`);
      if (fields.rank) row.push(`"${rank.replace(/"/g, '""')}"`);
      if (fields.college) row.push(`"${prevCollege.replace(/"/g, '""')}"`);

      csvRows.push(row.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
    const downloadAnchor = document.createElement('a');
    const classNameTag = classFilter === 'all' ? 'All_Classes' : classFilter.replace(/\s+/g, '_');
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute("download", `Students_${classNameTag}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('CSV downloaded successfully!');
    closeStudentExportModal();
  } catch (err) {
    showToast('CSV Export failed: ' + err.message, true);
  }
}

// ================= ATTENDANCE RECORD CSV EXPORT =================
async function openAttendanceExportModal() {
  const modal = document.getElementById('modal-attendance-export');
  if (!modal) return;

  if (!classesList || classesList.length === 0) {
    try { await loadClasses(); } catch(_) {}
  }

  const classSelect = document.getElementById('export-att-class');
  if (classSelect) {
    const currentVal = classSelect.value || 'all';
    classSelect.innerHTML = `<option value="all">All Classes</option>` +
      classesList.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
    classSelect.value = currentVal;
  }

  await handleExportAttClassChange();

  const currentYear = new Date().getFullYear();
  const yearSelect = document.getElementById('export-att-year');
  if (yearSelect && !yearSelect.value) {
    yearSelect.value = String(currentYear);
  }

  modal.classList.remove('hidden');
}

function closeAttendanceExportModal() {
  const modal = document.getElementById('modal-attendance-export');
  if (modal) modal.classList.add('hidden');
}

async function handleExportAttClassChange() {
  const classVal = document.getElementById('export-att-class')?.value || 'all';
  const subjectSelect = document.getElementById('export-att-subject');
  if (!subjectSelect) return;

  if (!subjectsList || subjectsList.length === 0) {
    try { await loadSubjects(); } catch(_) {}
  }

  let filteredSubjects = subjectsList || [];
  if (classVal !== 'all') {
    const classSubs = filteredSubjects.filter(s => {
      if (!s.class || s.class === 'all' || s.class === 'All') return true;
      return isClassEqual(s.class, classVal);
    });
    if (classSubs.length > 0) filteredSubjects = classSubs;
  }

  let optionsHtml = `<option value="whole">All Subjects</option>`;
  filteredSubjects.forEach(s => {
    const name = s.name || s;
    optionsHtml += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
  });
  subjectSelect.innerHTML = optionsHtml;
}

async function executeAttendanceExportCSV() {
  const classVal = document.getElementById('export-att-class')?.value || 'all';
  const subjectVal = document.getElementById('export-att-subject')?.value || 'whole';
  const yearVal = document.getElementById('export-att-year')?.value || 'all';
  const monthVal = document.getElementById('export-att-month')?.value || 'all-year';

  try {
    showToast('Fetching attendance data...');
    const res = await API.getClassReport(classVal, yearVal, monthVal, subjectVal);
    const data = (res && res.data) ? res.data : [];

    if (!data || data.length === 0) {
      showToast('No attendance records found for selected filters', true);
      return;
    }

    // Month label mapping
    const monthNames = {
      'all-year': 'All Months',
      '01': 'January', '02': 'February', '03': 'March', '04': 'April',
      '05': 'May', '06': 'June', '07': 'July', '08': 'August',
      '09': 'September', '10': 'October', '11': 'November', '12': 'December',
      '1': 'January', '2': 'February', '3': 'March', '4': 'April',
      '5': 'May', '6': 'June', '7': 'July', '8': 'August',
      '9': 'September'
    };
    const monthDisplay = monthNames[monthVal] || (monthVal === 'all-year' ? 'All Months' : monthVal);
    const subjectDisplay = (subjectVal === 'whole' || subjectVal === 'all') ? 'All Subjects' : subjectVal;
    const classDisplay = (classVal === 'all') ? 'All Classes' : classVal;
    const yearDisplay = (yearVal === 'all') ? 'All Years' : yearVal;

    // Common info at top, then blank row, then headings in exact order:
    // id, name, roll, total, present, absent, leave, percent, status
    const csvRows = [
      `"Class","${classDisplay.replace(/"/g, '""')}"`,
      `"Subject","${subjectDisplay.replace(/"/g, '""')}"`,
      `"Year","${yearDisplay.replace(/"/g, '""')}"`,
      `"Month","${monthDisplay.replace(/"/g, '""')}"`,
      `""`,
      `"Student ID","Name","Roll No","Total Sessions","Present","Absent","Leave","Percentage (%)","Status"`
    ];

    data.forEach(row => {
      const effStatus = row.status || (row.percent >= 90 ? 'Excellent' : row.percent >= 75 ? 'Regular' : row.percent >= 60 ? 'Warning' : 'Critical');
      const csvRow = [
        `"${row.studentId !== undefined ? row.studentId : ''}"`,
        `"${(row.name || '').replace(/"/g, '""')}"`,
        `"${row.roll !== undefined ? row.roll : ''}"`,
        `"${row.sessions !== undefined ? row.sessions : 0}"`,
        `"${row.present !== undefined ? row.present : 0}"`,
        `"${row.absent !== undefined ? row.absent : 0}"`,
        `"${row.leave !== undefined ? row.leave : (row.late !== undefined ? row.late : 0)}"`,
        `"${row.percent !== undefined ? row.percent : 100}%"`,
        `"${effStatus}"`
      ];
      csvRows.push(csvRow.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
    const downloadAnchor = document.createElement('a');
    const classTag = classVal === 'all' ? 'All_Classes' : classVal.replace(/\s+/g, '_');
    const subTag = subjectVal === 'whole' ? 'All_Subjects' : subjectVal.replace(/\s+/g, '_');
    const dateTag = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute("download", `Attendance_${classTag}_${subTag}_${dateTag}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Attendance CSV downloaded successfully!');
    closeAttendanceExportModal();
  } catch (err) {
    showToast('Attendance Export failed: ' + (err.message || 'Unknown error'), true);
  }
}

// ================= TIMETABLE NOTIFICATION SCHEDULER =================
// 1. Daily 6:00 AM summary notification of total timetable subjects for the day with line-by-line format & Snooze/OK
// 2. Notification 5 minutes before every class start time in a small semi-rounded square div & Snooze/OK
let activePreClassSlot = null;

function _parseSlotStartTime(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(/[-–—to]/i);
  let startPart = (parts[0] || '').trim();

  let meridiem = null;
  const matchMeridiem = String(timeStr).match(/(am|pm)/i);
  if (matchMeridiem) {
    const startM = startPart.match(/(am|pm)/i);
    meridiem = startM ? startM[1].toLowerCase() : matchMeridiem[1].toLowerCase();
  }

  const timeMatch = startPart.match(/(\d{1,2})[:.](\d{2})/);
  let hours = 0;
  let minutes = 0;
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
  } else {
    const singleHourMatch = startPart.match(/(\d{1,2})/);
    if (!singleHourMatch) return null;
    hours = parseInt(singleHourMatch[1], 10);
    minutes = 0;
  }

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

async function showAppNotification(title, options = {}) {
  const appName = (appSettings && appSettings.appName && appSettings.appName.trim())
    ? appSettings.appName.trim()
    : (localStorage.getItem('registerly_app_name') || 'REGISTERLY');

  // Always use the App Name as the notification title so the phone notification bar
  // shows only the App Name instead of the render site domain!
  const finalTitle = title || appName;

  const defaultOpts = {
    icon: '/icons/book-modern.svg',
    badge: '/icons/book-modern.svg',
    vibrate: [200, 100, 200],
    renotify: true,
    actions: [
      { action: 'snooze', title: 'Snooze' },
      { action: 'ok', title: 'OK' }
    ],
    ...options
  };

  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch(_) {}
    }
    if (Notification.permission !== 'granted') return;

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          return reg.showNotification(finalTitle, defaultOpts);
        }
      } catch(_) {}
    }
    return new Notification(finalTitle, defaultOpts);
  } catch (err) {
    console.warn('[Notification Error]', err);
  }
}

// Render the Morning Bubble Timetable Modal
function renderBubbleTimetableModal(dayName, slots, isTimetableNotSet = false) {
  const modal = document.getElementById('notif-bubble-timetable-modal');
  const titleEl = document.getElementById('bubble-tt-day-title');
  const subtitleEl = document.getElementById('bubble-tt-subtitle');
  const badgeEl = document.getElementById('bubble-tt-badge');
  const listEl = document.getElementById('bubble-tt-slots-list');
  const actionsEl = document.getElementById('bubble-tt-actions');
  const snoozeBtn = document.getElementById('bubble-tt-snooze-btn');
  const okBtn = document.getElementById('bubble-tt-ok-btn');
  if (!modal || !listEl) return;

  const currentUserName = currentUser ? currentUser.name : '';

  // USER DIRECTIVE:
  // "If no set the account any time table....show at the morning a message to set time table...with not snooze only ok........"
  if (isTimetableNotSet) {
    if (badgeEl) badgeEl.innerHTML = `<span>⚠️ Notice</span>`;
    if (titleEl) titleEl.textContent = 'Set Up Timetable';
    if (subtitleEl) subtitleEl.textContent = currentUserName ? `Schedule not set for ${currentUserName}:` : 'Your timetable is not configured yet:';
    listEl.innerHTML = `
      <div class="p-4 rounded-2xl bg-white/10 border border-white/15 text-center space-y-2.5">
        <div class="text-sm font-extrabold text-amber-300">No Timetable Set for Your Account</div>
        <p class="text-xs text-cyan-100/90 leading-relaxed">
          Please set up your class timetable so you can receive your daily morning schedules and pre-class reminders.
        </p>
      </div>
    `;
    if (actionsEl) {
      actionsEl.className = 'relative pt-2 border-t border-white/15 flex flex-col gap-2 flex-shrink-0';
      actionsEl.innerHTML = `
        <button type="button" onclick="handleQuickSetupTimetable()" class="touch-btn w-full py-2.5 px-4 rounded-xl custom-gradient-btn text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 transition active:scale-95">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Set Up Timetable Now</span>
        </button>
        <button type="button" onclick="dismissTimetableSummary()" class="touch-btn w-full py-2 px-3 rounded-xl bg-white/15 hover:bg-white/20 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1 transition">
          <span>Later / OK</span>
        </button>
      `;
    }
  } else {
    if (badgeEl) badgeEl.innerHTML = `<span>🌅 Morning Timetable</span>`;
    if (titleEl) titleEl.textContent = `${dayName}'s Schedule`;
    if (subtitleEl) subtitleEl.textContent = currentUserName ? `Classes for ${currentUserName}:` : 'Scheduled classes for today:';
    if (snoozeBtn) snoozeBtn.classList.remove('hidden');
    if (okBtn) {
      okBtn.className = 'touch-btn py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition';
    }
    if (actionsEl) {
      actionsEl.className = 'relative pt-2 border-t border-white/15 grid grid-cols-2 gap-2.5 flex-shrink-0';
    }

    if (!slots || slots.length === 0) {
      listEl.innerHTML = `
        <div class="p-3.5 rounded-2xl bg-white/10 border border-white/15 text-center text-xs text-cyan-100">
          No classes scheduled for you today (${escapeHtml(dayName)}). Have a wonderful day!
        </div>
      `;
    } else {
      listEl.innerHTML = slots.map(slot => {
        const timeStr = slot.timeSlot || slot.time || 'Period';
        return `
          <div class="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-between gap-3 transition">
            <div class="min-w-0 flex-1">
              <div class="text-xs font-black text-white flex items-center gap-1.5 flex-wrap">
                <span class="text-amber-300 font-extrabold">${escapeHtml(timeStr)}</span>
                <span>:</span>
                <span class="text-cyan-100">${escapeHtml(slot.subject)}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-white/20 text-white font-bold">[${escapeHtml(slot.class)}]</span>
              </div>
              ${slot.room ? `<div class="text-[10px] text-cyan-200/80 mt-0.5">Room: ${escapeHtml(slot.room)}</div>` : ''}
            </div>
            <div class="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 text-cyan-200">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  modal.classList.remove('hidden');
  const allowVibrate = localStorage.getItem('admin_notif_vibrate') !== 'false';
  if (allowVibrate) {
    try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch(_) {}
  }
}

function snoozeTimetableSummary() {
  const modal = document.getElementById('notif-bubble-timetable-modal');
  if (modal) modal.classList.add('hidden');
  const myKey = currentUser ? (currentUser._id || currentUser.name || 'user') : 'user';
  const snoozeUntil = Date.now() + 15 * 60 * 1000;
  try { localStorage.setItem(`tt_summary_snooze_${myKey}`, String(snoozeUntil)); } catch(_) {}
  showToast('Morning timetable snoozed for 15 mins');
}

function dismissTimetableSummary() {
  const modal = document.getElementById('notif-bubble-timetable-modal');
  if (modal) modal.classList.add('hidden');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const myKey = currentUser ? (currentUser._id || currentUser.name || 'user') : 'user';
  try {
    localStorage.setItem(`tt_summary_${myKey}_${todayStr}`, 'done');
    localStorage.removeItem(`tt_summary_snooze_${myKey}`);
  } catch(_) {}
  showToast('Timetable acknowledged');
}

// Feature 4: Quick setup timetable action from morning reminder
function handleQuickSetupTimetable() {
  dismissTimetableSummary();
  openMyTimetable();
  setTimeout(() => {
    openAddTimetableSlotModal();
  }, 300);
}

// Render the Pre-Class Small Semi-Rounded Square Notification Div
function renderPreClassNotificationCard(slot) {
  activePreClassSlot = slot;
  const card = document.getElementById('notif-preclass-card');
  const subjEl = document.getElementById('preclass-subject-title');
  const timeEl = document.getElementById('preclass-time-badge');
  const classEl = document.getElementById('preclass-class-badge');
  const roomEl = document.getElementById('preclass-room-badge');
  if (!card) return;

  if (subjEl) subjEl.textContent = slot.subject || 'Class';
  if (timeEl) timeEl.textContent = slot.timeSlot || slot.time || 'Starting Soon';
  if (classEl) classEl.textContent = `Class: ${slot.class || '-'}`;
  if (roomEl) {
    if (slot.room) {
      roomEl.textContent = `Room: ${slot.room}`;
      roomEl.classList.remove('hidden');
    } else {
      roomEl.classList.add('hidden');
    }
  }

  card.classList.remove('hidden');
  const allowVibrate = localStorage.getItem('admin_notif_vibrate') !== 'false';
  if (allowVibrate) {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch(_) {}
  }
}

function snoozePreClassAlert() {
  const card = document.getElementById('notif-preclass-card');
  if (card) card.classList.add('hidden');
  if (activePreClassSlot) {
    const slotKey = activePreClassSlot._id || (activePreClassSlot.day + '_' + activePreClassSlot.timeSlot + '_' + activePreClassSlot.subject);
    const myKey = currentUser ? (currentUser._id || currentUser.name || 'user') : 'user';
    const snoozeUntil = Date.now() + 2 * 60 * 1000; // Snooze for 2 minutes
    try { localStorage.setItem(`tt_preclass_snooze_${myKey}_${slotKey}`, String(snoozeUntil)); } catch(_) {}
  }
  showToast('Class reminder snoozed for 2 mins');
}

function dismissPreClassAlert() {
  const card = document.getElementById('notif-preclass-card');
  if (card) card.classList.add('hidden');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const myKey = currentUser ? (currentUser._id || currentUser.name || 'user') : 'user';
  if (activePreClassSlot) {
    const slotKey = activePreClassSlot._id || (activePreClassSlot.day + '_' + activePreClassSlot.timeSlot + '_' + activePreClassSlot.subject);
    try {
      localStorage.setItem(`tt_notif_5m_${myKey}_${slotKey}_${todayStr}`, 'done');
      localStorage.removeItem(`tt_preclass_snooze_${myKey}_${slotKey}`);
    } catch(_) {}
  }
}

async function checkAndTriggerTimetableNotifications() {
  try {
    if (!currentUser) return; // Must have an authenticated user account

    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()];
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const appName = (appSettings && appSettings.appName && appSettings.appName.trim())
      ? appSettings.appName.trim()
      : (localStorage.getItem('registerly_app_name') || 'REGISTERLY');

    const myAccountKey = String(currentUser._id || currentUser.name || 'user');
    const myName = (currentUser.name || '').trim();
    const myId = currentUser._id || currentUser.id || null;

    // Fetch all timetable slots
    const res = await API.getTimetable('', '', '');
    const allSlots = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

    // USER DIRECTIVE:
    // "In time table notification.....all accounts only show their own notification...
    // When Notification....only show each teacher account their own time table which he set from the profile tab...
    // Also show admin time table...what he set in his profile tab
    // Not mix all time tables.."
    const mySlots = allSlots.filter(s => isSlotForTeacher(s, myName, myId));

    const currentHours = now.getHours();
    const summaryNotifKey = `tt_summary_${myAccountKey}_${todayStr}`;
    const snoozeUntil = parseInt(localStorage.getItem(`tt_summary_snooze_${myAccountKey}`) || '0', 10);
    const isSnoozed = Date.now() < snoozeUntil;

    const allowMorning = localStorage.getItem('admin_notif_morning') !== 'false';
    const allowPreclass = localStorage.getItem('admin_notif_preclass') !== 'false';

    // USER DIRECTIVE:
    // "If no set the account any time table....show at the morning a message to set time table...with not snooze only ok........"
    if (mySlots.length === 0) {
      if (allowMorning && currentHours >= 5 && localStorage.getItem(summaryNotifKey) !== 'done' && !isSnoozed) {
        if (!localStorage.getItem(summaryNotifKey)) {
          localStorage.setItem(summaryNotifKey, 'shown');
        }

        // Phone notification with ONLY "OK" (no snooze) and App Name as headline
        showAppNotification(appName, {
          body: 'Please set up your timetable from the Profile tab to receive daily class schedules and 5-minute pre-class reminders.',
          tag: `tt-notset-${myAccountKey}-${todayStr}`,
          actions: [
            { action: 'ok', title: 'OK' }
          ]
        });

        // In-app modal with message to set timetable and ONLY "OK"
        renderBubbleTimetableModal(todayName, [], true);
      }
      return;
    }

    // Filter this account's slots for today (handles multi-day slots, comma-separated, and 'All Days')
    let todaySlots = mySlots.filter(s => {
      const d = (s.day || '').trim().toLowerCase();
      const todayLower = todayName.toLowerCase();
      const days = Array.isArray(s.days) ? s.days.map(x => x.trim().toLowerCase()) : [];
      const splitDays = d.split(',').map(x => x.trim().toLowerCase());
      return d === todayLower || d === 'all days' || splitDays.includes(todayLower) || days.includes(todayLower) || days.includes('all days');
    });

    // Sort today's slots chronologically
    todaySlots.sort((a, b) => {
      const tA = _parseSlotStartTime(a.timeSlot || a.time);
      const tB = _parseSlotStartTime(b.timeSlot || b.time);
      if (!tA && !tB) return 0;
      if (!tA) return 1;
      if (!tB) return -1;
      return (tA.hours * 60 + tA.minutes) - (tB.hours * 60 + tB.minutes);
    });

    // 1. Daily morning summary notification for this account only
    if (allowMorning && currentHours >= 5 && localStorage.getItem(summaryNotifKey) !== 'done' && !isSnoozed) {
      if (!localStorage.getItem(summaryNotifKey)) {
        localStorage.setItem(summaryNotifKey, 'shown');
      }

      // Format line by line: 9.00 am - 10 am : maths [class name]
      const lines = todaySlots.map(s => {
        const timePart = s.timeSlot || s.time || 'Period';
        return `${timePart} : ${s.subject} [${s.class}]`;
      });

      const bodyText = lines.length > 0
        ? `Today's Schedule (${todayName}):\n` + lines.join('\n')
        : `No classes scheduled for you today (${todayName}). Have a wonderful day!`;

      // Trigger phone notification: headline is App Name
      showAppNotification(appName, {
        body: bodyText,
        tag: `tt-summary-${myAccountKey}-${todayStr}`,
        actions: [
          { action: 'snooze', title: 'Snooze' },
          { action: 'ok', title: 'OK' }
        ]
      });

      // Show in-app background bubble notification
      renderBubbleTimetableModal(todayName, todaySlots, false);
    }

    // 2. Notification 5 minutes before every class for this account only
    if (allowPreclass) {
      todaySlots.forEach(slot => {
        const timeInfo = _parseSlotStartTime(slot.timeSlot || slot.time);
        if (!timeInfo) return;

        const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), timeInfo.hours, timeInfo.minutes, 0, 0);
        const diffMs = slotStart.getTime() - now.getTime();
        const diffMinutes = diffMs / (60 * 1000);

        // Trigger if class starts in between 0 and 5.5 minutes
        if (diffMinutes >= 0 && diffMinutes <= 5.5) {
          const slotKey = slot._id || (slot.day + '_' + slot.timeSlot + '_' + slot.subject);
          const slotDoneKey = `tt_notif_5m_${myAccountKey}_${slotKey}_${todayStr}`;
          const slotSnoozeUntil = parseInt(localStorage.getItem(`tt_preclass_snooze_${myAccountKey}_${slotKey}`) || '0', 10);
          const isSlotSnoozed = Date.now() < slotSnoozeUntil;

          if (localStorage.getItem(slotDoneKey) !== 'done' && !isSlotSnoozed) {
            const timePart = slot.timeSlot || `${timeInfo.hours}:${String(timeInfo.minutes).padStart(2, '0')}`;
            const body = `Next Subject\n${slot.subject} (${timePart}) [${slot.class}]${slot.room ? ' • Room ' + slot.room : ''}`;

            // Trigger phone notification with Snooze and OK
            showAppNotification(appName, {
              body,
              tag: `tt-class-${myAccountKey}-${slotKey}`,
              actions: [
                { action: 'snooze', title: 'Snooze' },
                { action: 'ok', title: 'OK' }
              ]
            });

            // Show in-app small semi-rounded square notification
            renderPreClassNotificationCard(slot);
          }
        }
      });
    }
  } catch (err) {
    console.debug('[Timetable Notification Check Failed]', err);
  }
}

function initTimetableNotificationScheduler() {
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      try { Notification.requestPermission(); } catch(_) {}
    }, 2000);
  }

  // Listen for actions from Service Worker notification clicks (Snooze / OK)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data) {
        if (event.data.type === 'NOTIFICATION_SNOOZED') {
          const tag = event.data.tag || '';
          if (tag.startsWith('tt-summary-')) snoozeTimetableSummary();
          else if (tag.startsWith('tt-class-')) snoozePreClassAlert();
        } else if (event.data.type === 'NOTIFICATION_DISMISSED') {
          const tag = event.data.tag || '';
          if (tag.startsWith('tt-summary-') || tag.startsWith('tt-notset-')) dismissTimetableSummary();
          else if (tag.startsWith('tt-class-')) dismissPreClassAlert();
        }
      }
    });
  }

  // Check immediately on load
  checkAndTriggerTimetableNotifications();
  // Check every 30 seconds
  setInterval(checkAndTriggerTimetableNotifications, 30000);
}
