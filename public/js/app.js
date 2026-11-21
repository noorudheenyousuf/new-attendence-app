// Main Application Controller for REGISTERLY
const DEFAULT_AVATAR = "/default_avatar.jpg";

// Check if a photo URL is an uploaded custom image rather than default avatar / placeholder
function isCustomPhoto(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean) return false;
  if (clean === DEFAULT_AVATAR || clean === '/default_avatar.jpg') return false;
  if (clean.includes('default_avatar.jpg')) return false;
  if (clean.includes('unsplash.com')) return false;
  if (clean.includes('gravatar.com')) return false;
  if (clean.startsWith("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'") ||
      clean.startsWith('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"')) return false;
  return true;
}

// Generate theme-colored initials avatar (SVG Data-URI, rounded-square compatible)
// USER DIRECTIVE: Students name default avatar always only show first letter (whether 1 part or 2 parts).
// Teachers avatar shows 1 letter if 1 word, or 2 letters of 2 parts if 2+ words (forTeacher = true).
function getInitialsAvatar(name = '', bgColor = '245b70', textColor = 'ffffff', forTeacher = false) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  let initials = '';
  if (forTeacher && parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length > 0 && parts[0].length > 0) {
    initials = parts[0][0].toUpperCase();
  }

  const cleanBg = (bgColor || '245b70').replace('#', '');
  const cleanText = (textColor || 'ffffff').replace('#', '');

  if (!initials) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#${cleanBg}"/><path d="M50 48c7.18 0 13-5.82 13-13s-5.82-13-13-13-13 5.82-13 13 5.82 13 13 13zm0 8c-9.33 0-28 4.67-28 14v6h56v-6c0-9.33-18.67-14-28-14z" fill="#${cleanText}"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const fontSize = initials.length > 1 ? 40 : 48;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#${cleanBg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#${cleanText}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="${fontSize}">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
let currentUser = null;
let currentRole = 'admin'; // 'admin' or 'teacher'
let isDarkMode = false;

// In-memory active data
let classesList = [];
let subjectsList = [];
let studentsList = [];
let cachedAllStudents = [];
let attendanceRecords = []; // [{ studentId, status, note }]

// ================= DUAL PORTAL ROUTING STATE & HELPERS =================
let authPortalRole = 'staff';

function getRequestedPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const portalParam = (urlParams.get('portal') || '').toLowerCase().trim();
  if (portalParam === 'student' || window.location.pathname.endsWith('/student')) {
    return 'student';
  }
  if (portalParam === 'teacher' || window.location.pathname.endsWith('/teacher')) {
    return 'teacher';
  }
  const sessionPortal = sessionStorage.getItem('registerly_active_portal');
  if (sessionPortal === 'student' || sessionPortal === 'teacher') {
    return sessionPortal;
  }
  if (currentUser && currentUser.role === 'student') {
    return 'student';
  }
  return 'teacher';
}

function isStudentPortalActive() {
  return getRequestedPortal() === 'student';
}

function switchPortal(portal) {
  if (portal === 'teacher') {
    sessionStorage.setItem('registerly_active_portal', 'teacher');
    window.location.href = '/?portal=teacher';
  } else {
    sessionStorage.setItem('registerly_active_portal', 'student');
    window.location.href = '/?portal=student';
  }
}

function updateAuthModalPortalUI() {
  const isStudent = (getRequestedPortal() === 'student' || authPortalRole === 'student');
  const titleEl = document.getElementById('auth-modal-title');
  const subEl = document.getElementById('auth-modal-subtitle');
  const regNoteEl = document.getElementById('auth-modal-reg-note');
  if (isStudent) {
    if (titleEl) titleEl.textContent = 'Student Portal';
    if (subEl) subEl.textContent = 'Sign in to access your timetable, attendance & notices';
    if (regNoteEl) {
      regNoteEl.innerHTML = '<svg class="w-4 h-4 text-teal-600 inline-block mr-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg><span>Enter with your student email or Gmail to self-register your details.</span>';
    }
  } else {
    if (titleEl) titleEl.textContent = 'REGISTERLY';
    if (subEl) subEl.textContent = 'Teacher Portal & Attendance Management';
    if (regNoteEl) {
      regNoteEl.innerHTML = '<svg class="w-4 h-4 text-amber-500 inline-block mr-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg><span>First registered account is granted full <b>Admin</b> privileges automatically.</span>';
    }
  }
}
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

// Helper to get the exact sequence in which subjects appear on the "Add Subject" page
function getSubjectOrderFromAddSubjectPage() {
  const orderedNames = [];
  const seen = new Set();
  const allSubs = [...(subjectsList || []), ...(typeof pwSubjectsList !== 'undefined' && Array.isArray(pwSubjectsList) ? pwSubjectsList : [])];
  const allClasses = [...(classesList || []), ...(typeof pwClassesList !== 'undefined' && Array.isArray(pwClassesList) ? pwClassesList : [])];

  // 1. Grouped by classesList (exact order rendered on Add Subject page / renderSubjectsList)
  allClasses.forEach(cls => {
    const clsName = (cls.name || cls || '').trim();
    const classSubs = allSubs.filter(s =>
      Array.isArray(s.assignedClasses) && s.assignedClasses.some(ac => isClassEqual(ac, clsName))
    );
    classSubs.forEach(s => {
      const n = (s.name || '').trim();
      const k = n.toLowerCase();
      if (n && !seen.has(k)) {
        seen.add(k);
        orderedNames.push(n);
      }
    });
  });

  // 2. Unassigned subjects
  allSubs.forEach(s => {
    const n = (s.name || '').trim();
    const k = n.toLowerCase();
    if (n && !seen.has(k)) {
      seen.add(k);
      orderedNames.push(n);
    }
  });

  return orderedNames;
}

// ================= TEACHER ASSIGNMENTS SINGLE SOURCE OF TRUTH =================
// All assignments are focused via Subject management (Subject has name, teacher, assignedClasses)
function getTeacherAssignments(teacherName, teacherEmail) {
  const normName = String(teacherName || '').trim().toLowerCase();
  const normEmail = String(teacherEmail || '').trim().toLowerCase();

  const allSubs = [...(subjectsList || []), ...(typeof pwSubjectsList !== 'undefined' && Array.isArray(pwSubjectsList) ? pwSubjectsList : [])];
  const allClasses = [...(classesList || []), ...(typeof pwClassesList !== 'undefined' && Array.isArray(pwClassesList) ? pwClassesList : [])];

  const matchedSubjects = allSubs.filter(s => {
    const sTeacher = String(s.teacher || '').trim().toLowerCase();
    const sEmail = String(s.teacherEmail || s.ownerEmail || '').trim().toLowerCase();
    if (sEmail && normEmail) {
      return sEmail === normEmail;
    }
    if (!sEmail && normName && sTeacher === normName) {
      return true;
    }
    return false;
  });

  const seenSub = new Set();
  let assignedSubjects = [];
  matchedSubjects.forEach(s => {
    const n = (s.name || '').trim();
    const k = n.toLowerCase();
    if (n && !seenSub.has(k)) {
      seenSub.add(k);
      assignedSubjects.push(n);
    }
  });

  const seenCls = new Set();
  let assignedClasses = [];
  matchedSubjects.forEach(s => {
    (s.assignedClasses || []).forEach(cName => {
      const cTrim = String(cName || '').trim();
      const k = cTrim.toLowerCase();
      if (cTrim && !seenCls.has(k)) {
        seenCls.add(k);
        assignedClasses.push(cTrim);
      }
    });
  });

  allClasses.forEach(c => {
    const ct = String(c.classTeacher || '').trim().toLowerCase();
    const ctEmail = String(c.classTeacherEmail || '').trim().toLowerCase();
    if (ctEmail && normEmail) {
      if (ctEmail === normEmail) {
        const cTrim = String(c.name || '').trim();
        const k = cTrim.toLowerCase();
        if (cTrim && !seenCls.has(k)) {
          seenCls.add(k);
          assignedClasses.push(cTrim);
        }
      }
      return;
    }
    if (!ctEmail && normName && ct === normName) {
      const cTrim = String(c.name || '').trim();
      const k = cTrim.toLowerCase();
      if (cTrim && !seenCls.has(k)) {
        seenCls.add(k);
        assignedClasses.push(cTrim);
      }
    }
  });

  // Merge from currentUser's explicit assignedSubjects/assignedClasses if available
  if (currentUser && currentUser.email && String(currentUser.email).toLowerCase().trim() === normEmail) {
    (currentUser.assignedSubjects || []).forEach(sName => {
      const n = String(sName || '').trim();
      const k = n.toLowerCase();
      if (n && !seenSub.has(k)) {
        seenSub.add(k);
        assignedSubjects.push(n);
      }
    });
    (currentUser.assignedClasses || []).forEach(cName => {
      const cTrim = String(cName || '').trim();
      const k = cTrim.toLowerCase();
      if (cTrim && !seenCls.has(k)) {
        seenCls.add(k);
        assignedClasses.push(cTrim);
      }
    });
  }

  // Follow exact order of classes and subjects everywhere, in assigned class also
  assignedClasses.sort((a, b) => {
    const idxA = allClasses.findIndex(c => isClassEqual(c.name, a));
    const idxB = allClasses.findIndex(c => isClassEqual(c.name, b));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  // Follow assigned subjects order strictly by the teacher's assigned class categories in Add Subject page order
  const orderedAssignedSubjects = [];
  const seenAssignedSub = new Set();

  assignedClasses.forEach(clsName => {
    // Under this class category on Add Subject page, subjects appear in allSubs order where assignedClasses includes clsName
    const classSubs = allSubs.filter(s =>
      Array.isArray(s.assignedClasses) && s.assignedClasses.some(ac => isClassEqual(ac, clsName))
    );
    classSubs.forEach(s => {
      const sName = (s.name || '').trim();
      const sKey = sName.toLowerCase();
      const isTeacherSub = matchedSubjects.some(ms => ms._id ? String(ms._id) === String(s._id) : (ms.name && s.name && ms.name.trim().toLowerCase() === sKey))
        || (currentUser && currentUser.email && String(currentUser.email).toLowerCase().trim() === normEmail && (currentUser.assignedSubjects || []).some(cs => (cs || '').trim().toLowerCase() === sKey));

      if (isTeacherSub && sName && !seenAssignedSub.has(sKey)) {
        seenAssignedSub.add(sKey);
        orderedAssignedSubjects.push(sName);
      }
    });
  });

  // Append any remaining assigned subjects (e.g. unassigned class subjects or explicit user assignments)
  assignedSubjects.forEach(sName => {
    const sKey = (sName || '').trim().toLowerCase();
    if (sKey && !seenAssignedSub.has(sKey)) {
      seenAssignedSub.add(sKey);
      orderedAssignedSubjects.push(sName);
    }
  });

  assignedSubjects = orderedAssignedSubjects;

  return { assignedSubjects, assignedClasses };
}

function renderProfileAssignments(name, email) {
  const classesContainer = document.getElementById('edit-profile-assigned-classes');
  const subjectsContainer = document.getElementById('edit-profile-assigned-subjects');
  if (!classesContainer || !subjectsContainer) return;

  const assign = getTeacherAssignments(name, email);

  if (assign.assignedClasses.length > 0) {
    classesContainer.innerHTML = assign.assignedClasses.map(c => `
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 border border-[#245b70]/20 font-bold text-xs shadow-2xs select-none">
        <span class="w-1.5 h-1.5 rounded-full bg-[#245b70] dark:bg-cyan-400"></span>
        <span>${escapeHtml(c)}</span>
      </span>
    `).join('');
  } else {
    classesContainer.innerHTML = '<span class="text-xs text-[var(--text-sub)] italic">No classes assigned yet</span>';
  }

  if (assign.assignedSubjects.length > 0) {
    subjectsContainer.innerHTML = assign.assignedSubjects.map(s => `
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-bold text-xs shadow-2xs select-none">
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
        <span>${escapeHtml(s)}</span>
      </span>
    `).join('');
  } else {
    subjectsContainer.innerHTML = '<span class="text-xs text-[var(--text-sub)] italic">No subjects assigned yet</span>';
  }
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

function showSplashLoader(msg = 'Loading application...') {
  const loader = document.getElementById('app-splash-loader');
  if (loader) {
    loader.classList.remove('splash-fade-out');
    loader.style.display = 'flex';
    loader.style.opacity = '1';
    loader.style.visibility = 'visible';
    loader.style.pointerEvents = 'auto';
    const sub = document.getElementById('splash-status-text') || loader.querySelector('p span:last-child');
    if (sub && msg) sub.textContent = msg;
  }
}

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
  if (typeof initI18n === 'function') initI18n();
  initServiceWorker();
  updateDateDisplay();

  const urlParams = new URLSearchParams(window.location.search);
  const portalParam = (urlParams.get('portal') || '').toLowerCase().trim();
  if (portalParam === 'student' || window.location.pathname.endsWith('/student')) {
    sessionStorage.setItem('registerly_active_portal', 'student');
  } else if (portalParam === 'teacher' || window.location.pathname.endsWith('/teacher')) {
    sessionStorage.setItem('registerly_active_portal', 'teacher');
  }

  const isStudentPortal = isStudentPortalActive();
  authPortalRole = isStudentPortal ? 'student' : 'staff';

  if (isStudentPortal) {
    selectTab('student-portal');
  } else {
    selectTab('home');
  }

  try {
    await initGoogleAuth();
    await loadCurrentUser();
    if (currentUser) {
      if (isStudentPortal) {
        selectTab('student-portal');
        await initStudentPortal();
        hideSplashLoader();
        return;
      }

      // If user is a student account trying to open teacher portal:
      if (currentUser.role === 'student') {
        showToast('Student accounts can only access the Student Portal.');
        sessionStorage.setItem('registerly_active_portal', 'student');
        selectTab('student-portal');
        await initStudentPortal();
        hideSplashLoader();
        return;
      }

      await loadAppSettings();
      await loadClasses();
      await loadSubjects();
      await loadTeachersData();
      updateUserUI();
      // Re-render after settings load so canUserEditDelete() uses correct value
      renderClassesList();
      renderSubjectsList();
      renderStudentsDirectory();
      renderTeachersList();
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
      await loadHomeDashboard();
      // Flow sequence: Language -> Guide -> Morning Modal -> Dashboard
      proceedAppWorkflowSequence();
    } else {
      if (isStudentPortal) {
        selectTab('student-portal');
        setAuthPortalRole('student');
        openAuthModal();
      } else {
        await loadHomeDashboard();
        setAuthPortalRole('staff');
        openAuthModal();
      }
      hideSplashLoader();
    }
  } catch (err) {
    console.error('[App Init Error]', err);
    hideSplashLoader();
  } finally {
    applyHeaderButtonPreference();
    // Poll for new messages every 60 seconds
    setInterval(checkUnreadMessages, 60000);
  }
});

// ================= APP ONBOARDING & SEQUENCED WORKFLOW =================
function proceedAppWorkflowSequence() {
  if (!currentUser) {
    hideSplashLoader();
    return;
  }

  const langChosen = localStorage.getItem('app_language_chosen');
  const guideSeen = localStorage.getItem('registerly_guide_seen');

  if (!langChosen) {
    // Step 1: Language selection modal first for user
    hideSplashLoader();
    setTimeout(() => {
      openInitialLanguageModal();
    }, 350);
  } else if (!guideSeen) {
    // Step 2: Language already picked, guide not yet viewed
    hideSplashLoader();
    setTimeout(() => {
      openAppGuideModal();
    }, 350);
  } else {
    // Step 3: All onboarding completed -> Check Morning Modal -> Dashboard
    hideSplashLoader();
    setTimeout(() => {
      checkAndTriggerTimetableNotifications();
    }, 400);
  }
}

function checkInitialOnboarding() {
  proceedAppWorkflowSequence();
}

function openInitialLanguageModal() {
  const modal = document.getElementById('modal-first-language-select');
  if (modal) modal.classList.remove('hidden');
}

function closeInitialLanguageModal() {
  const modal = document.getElementById('modal-first-language-select');
  if (modal) modal.classList.add('hidden');
}

function selectInitialLanguage(lang) {
  if (typeof setAppLanguage === 'function') {
    setAppLanguage(lang);
  } else {
    localStorage.setItem('app_language', lang);
  }
  localStorage.setItem('app_language_chosen', 'true');
  closeInitialLanguageModal();

  // Step 2: Open Morning Guide Modal if first time, else Morning Timetable Modal
  const guideSeen = localStorage.getItem('registerly_guide_seen');
  if (!guideSeen) {
    setTimeout(() => {
      openAppGuideModal();
    }, 300);
  } else {
    setTimeout(() => {
      checkAndTriggerTimetableNotifications();
    }, 350);
  }
}

function openAppGuideModal() {
  const modal = document.getElementById('modal-app-guide');
  if (!modal) return;
  const currentLang = localStorage.getItem('app_language') || 'en';
  renderGuideLanguage(currentLang);
  modal.classList.remove('hidden');
}

function closeAppGuideModal() {
  const modal = document.getElementById('modal-app-guide');
  if (modal) modal.classList.add('hidden');
  localStorage.setItem('registerly_guide_seen', 'true');

  // Step 3: Transition to Morning Timetable Modal -> Dashboard
  setTimeout(() => {
    checkAndTriggerTimetableNotifications();
  }, 350);
}

function switchGuideLanguage(lang) {
  // Only toggle guide language; do not change whole app language
  renderGuideLanguage(lang);
}

function renderGuideLanguage(lang) {
  const isMl = lang === 'ml';
  const mlContent = document.getElementById('guide-content-ml');
  const enContent = document.getElementById('guide-content-en');
  const btnEn = document.getElementById('guide-btn-en');
  const btnMl = document.getElementById('guide-btn-ml');
  const titleEl = document.getElementById('guide-modal-title');
  const btnLabel = document.getElementById('guide-modal-btn-label');

  if (isMl) {
    if (mlContent) mlContent.classList.remove('hidden');
    if (enContent) enContent.classList.add('hidden');
    if (btnMl) btnMl.className = "px-2 py-0.5 rounded-md bg-white text-slate-900 font-bold shadow-sm transition";
    if (btnEn) btnEn.className = "px-2 py-0.5 rounded-md text-white/70 hover:text-white font-semibold transition";
    if (titleEl) titleEl.innerText = "ആപ്പ് നിർദ്ദേശങ്ങൾ (Guide)";
    if (btnLabel) btnLabel.innerText = "ശരി, ആരംഭിക്കാം!";
  } else {
    if (enContent) enContent.classList.remove('hidden');
    if (mlContent) mlContent.classList.add('hidden');
    if (btnEn) btnEn.className = "px-2 py-0.5 rounded-md bg-white text-slate-900 font-bold shadow-sm transition";
    if (btnMl) btnMl.className = "px-2 py-0.5 rounded-md text-white/70 hover:text-white font-semibold transition";
    if (titleEl) titleEl.innerText = "App Guide & Instructions";
    if (btnLabel) btnLabel.innerText = "Got it / Let's Start!";
  }
}

// ================= CUSTOM DIALOG MODAL (CONFIRM / PROMPT / ALERT) =================
// 6:00 AM Morning Modal Gradient & Style: #1e4d5f -> #245b70 -> #123644
window.showCustomConfirm = function(opts) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-custom-dialog');
    if (!modal) {
      resolve(window.confirm(typeof opts === 'string' ? opts : (opts.message || 'Are you sure?')));
      return;
    }
    const titleEl = document.getElementById('custom-dialog-title');
    const badgeEl = document.getElementById('custom-dialog-badge');
    const msgEl = document.getElementById('custom-dialog-message');
    const inputWrap = document.getElementById('custom-dialog-input-wrapper');
    const cancelBtn = document.getElementById('custom-dialog-cancel-btn');
    const confirmBtn = document.getElementById('custom-dialog-confirm-btn');
    const closeBtn = document.getElementById('custom-dialog-close-btn');

    const config = typeof opts === 'string' ? { message: opts } : (opts || {});
    if (titleEl) titleEl.innerText = config.title || 'Please Confirm';
    if (badgeEl) badgeEl.innerHTML = `<span>${config.badge || 'Registerly'}</span>`;
    if (msgEl) msgEl.innerText = config.message || 'Are you sure you want to proceed?';
    if (inputWrap) inputWrap.classList.add('hidden');
    if (cancelBtn) {
      cancelBtn.classList.remove('hidden');
      cancelBtn.innerText = config.cancelText || 'Cancel';
    }
    if (confirmBtn) {
      confirmBtn.innerText = config.confirmText || 'Confirm';
      confirmBtn.className = config.isDanger
        ? 'touch-btn py-2.5 px-5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition'
        : 'touch-btn py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition';
    }

    const cleanup = (res) => {
      modal.classList.add('hidden');
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
      if (closeBtn) closeBtn.onclick = null;
      resolve(res);
    };

    cancelBtn.onclick = () => cleanup(false);
    if (closeBtn) closeBtn.onclick = () => cleanup(false);
    confirmBtn.onclick = () => cleanup(true);

    modal.classList.remove('hidden');
  });
};

window.showCustomPrompt = function(opts) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-custom-dialog');
    if (!modal) {
      const defaultVal = typeof opts === 'object' ? opts.defaultValue : '';
      const promptMsg = typeof opts === 'string' ? opts : (opts.message || 'Enter value:');
      resolve(window.prompt(promptMsg, defaultVal));
      return;
    }
    const titleEl = document.getElementById('custom-dialog-title');
    const badgeEl = document.getElementById('custom-dialog-badge');
    const msgEl = document.getElementById('custom-dialog-message');
    const inputWrap = document.getElementById('custom-dialog-input-wrapper');
    const inputEl = document.getElementById('custom-dialog-input');
    const cancelBtn = document.getElementById('custom-dialog-cancel-btn');
    const confirmBtn = document.getElementById('custom-dialog-confirm-btn');
    const closeBtn = document.getElementById('custom-dialog-close-btn');

    const config = typeof opts === 'string' ? { message: opts } : (opts || {});
    if (titleEl) titleEl.innerText = config.title || 'Edit Value';
    if (badgeEl) badgeEl.innerHTML = `<span>${config.badge || 'Input Required'}</span>`;
    if (msgEl) msgEl.innerText = config.message || 'Please enter details below:';
    if (inputWrap) inputWrap.classList.remove('hidden');
    if (inputEl) {
      inputEl.value = config.defaultValue || '';
      inputEl.placeholder = config.placeholder || 'Type here...';
    }
    if (cancelBtn) {
      cancelBtn.classList.remove('hidden');
      cancelBtn.innerText = config.cancelText || 'Cancel';
    }
    if (confirmBtn) {
      confirmBtn.innerText = config.confirmText || 'Save';
      confirmBtn.className = 'touch-btn py-2.5 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition';
    }

    const cleanup = (res) => {
      modal.classList.add('hidden');
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
      if (closeBtn) closeBtn.onclick = null;
      if (inputEl) inputEl.onkeydown = null;
      resolve(res);
    };

    cancelBtn.onclick = () => cleanup(null);
    if (closeBtn) closeBtn.onclick = () => cleanup(null);
    confirmBtn.onclick = () => cleanup(inputEl ? inputEl.value : '');
    if (inputEl) {
      inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          cleanup(inputEl.value);
        } else if (e.key === 'Escape') {
          cleanup(null);
        }
      };
    }

    modal.classList.remove('hidden');
    if (inputEl) setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);
  });
};

window.showCustomAlert = function(opts) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-custom-dialog');
    if (!modal) {
      window.alert(typeof opts === 'string' ? opts : (opts.message || ''));
      resolve();
      return;
    }
    const titleEl = document.getElementById('custom-dialog-title');
    const badgeEl = document.getElementById('custom-dialog-badge');
    const msgEl = document.getElementById('custom-dialog-message');
    const inputWrap = document.getElementById('custom-dialog-input-wrapper');
    const cancelBtn = document.getElementById('custom-dialog-cancel-btn');
    const confirmBtn = document.getElementById('custom-dialog-confirm-btn');
    const closeBtn = document.getElementById('custom-dialog-close-btn');

    const config = typeof opts === 'string' ? { message: opts } : (opts || {});
    if (titleEl) titleEl.innerText = config.title || 'Notice';
    if (badgeEl) badgeEl.innerHTML = `<span>${config.badge || 'Registerly'}</span>`;
    if (msgEl) msgEl.innerText = config.message || '';
    if (inputWrap) inputWrap.classList.add('hidden');
    if (cancelBtn) cancelBtn.classList.add('hidden');
    if (confirmBtn) {
      confirmBtn.innerText = config.confirmText || 'Got it';
      confirmBtn.className = 'touch-btn py-2.5 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 transition';
    }

    const cleanup = () => {
      modal.classList.add('hidden');
      confirmBtn.onclick = null;
      if (closeBtn) closeBtn.onclick = null;
      resolve();
    };

    if (closeBtn) closeBtn.onclick = cleanup;
    confirmBtn.onclick = cleanup;

    modal.classList.remove('hidden');
  });
};

// ================= DYNAMIC CLASS CATEGORY & STUDENT FORM FIELDS =================
function getClassCategory(className) {
  if (!className || typeof className !== 'string') return 'general';
  const c = className.trim().toLowerCase();
  // Plus One / Plus Two: +1, +2, plus one, plus two, 11, 12, xi, xii
  if (/(plus\s*(one|two|1|2|\+1|\+2)|\+1|\+2|\b11th?\b|\b12th?\b|\bxi\b|\bxii\b)/i.test(c)) {
    return 'plus_two';
  }
  // Degree: degree, ug, ba, bsc, bcom, bca, bba, btech, etc.
  if (/(degree|\bug\b|\bba\b|\bb\.a\b|\bbsc\b|\bb\.sc\b|\bbcom\b|\bb\.com\b|\bbca\b|\bbba\b|\bbtech\b|\bb\.tech\b|\bunder\s*graduate\b)/i.test(c)) {
    return 'degree';
  }
  // Class 5 to 10
  if (/(\b(5|6|7|8|9|10)(th)?\b|\bv\b|\bvi\b|\bvii\b|\bviii\b|\bix\b|\bx\b)/i.test(c)) {
    return 'school_5_10';
  }
  return 'general';
}

function updateDynamicClassFields(mode, className) {
  const cat = getClassCategory(className);
  const streamWrap = document.getElementById(`${mode}-wrap-stream`);
  const degreeWrap = document.getElementById(`${mode}-wrap-degreeYear`);
  
  if (cat === 'plus_two') {
    if (streamWrap) streamWrap.classList.remove('hidden');
    if (degreeWrap) degreeWrap.classList.add('hidden');
  } else if (cat === 'degree') {
    if (streamWrap) streamWrap.classList.add('hidden');
    if (degreeWrap) degreeWrap.classList.remove('hidden');
  } else {
    // 5 to 10 or other general
    if (streamWrap) streamWrap.classList.add('hidden');
    if (degreeWrap) degreeWrap.classList.add('hidden');
  }
}

function checkDuplicateStudentId(mode) {
  const inputEl = document.getElementById(mode === 'new' ? 'auto-student-id' : 'edit-student-id');
  const warnEl = document.getElementById(`warning-${mode}-studentId`);
  if (!inputEl) return false;
  const val = String(inputEl.value).trim().toLowerCase();
  if (!val) {
    if (warnEl) warnEl.classList.add('hidden');
    return false;
  }

  const allStu = (typeof studentsList !== 'undefined' && Array.isArray(studentsList)) ? studentsList : (cachedAllStudents || []);
  const currentObjId = mode === 'edit' ? String(activeEditStudentObjId || '') : '';

  const matched = allStu.find(s => {
    if (mode === 'edit' && String(s._id) === currentObjId) return false;
    return String(s.studentId).trim().toLowerCase() === val;
  });

  if (matched) {
    if (warnEl) {
      warnEl.innerText = `⚠️ Duplicate Warning: ID "${inputEl.value}" is already assigned to "${matched.name}" (Class: ${matched.class}). Please choose a unique ID.`;
      warnEl.classList.remove('hidden');
    }
    return true;
  } else {
    if (warnEl) warnEl.classList.add('hidden');
    return false;
  }
}

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

  const translated = (typeof tPhrase === 'function') ? tPhrase(message) : message;
  toastText.innerText = translated;
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

function updateHeaderAvatar() {
  const headerAvatar = document.getElementById('user-avatar-img');
  if (headerAvatar && currentUser) {
    headerAvatar.src = currentUser.avatarUrl || DEFAULT_AVATAR;
  }
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
    const settingsPhone = document.getElementById('settings-phone-display');
    const settingsMemberSince = document.getElementById('settings-member-since-display');

    if (settingsName) settingsName.innerText = 'Not Signed In';
    if (settingsEmail) settingsEmail.innerText = 'Please sign in to manage school';
    if (settingsPhone) {
      settingsPhone.innerText = '';
      settingsPhone.classList.add('hidden');
    }
    if (settingsMemberSince) settingsMemberSince.innerText = '';
    if (settingsRole) {
      settingsRole.innerText = 'Guest Mode';
      settingsRole.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-slate-500/10 text-slate-500 border border-slate-300 dark:border-slate-700 mx-auto sm:mx-0";
      settingsRole.classList.remove('hidden');
    }
    if (settingsAvatar) settingsAvatar.src = DEFAULT_AVATAR;
    const assignStrip = document.getElementById('settings-assignments-strip');
    if (assignStrip) assignStrip.classList.add('hidden');
    const adminSection = document.getElementById('admin-settings-section');
    if (adminSection) adminSection.classList.add('hidden');
    return;
  }

  // Header Profile
  if (headerName) headerName.innerText = currentUser.name || 'User';
  if (headerRole) headerRole.innerText = currentUser.role === 'admin' ? 'Admin' : 'Teacher';
  if (headerAvatar) headerAvatar.src = currentUser.avatarUrl || DEFAULT_AVATAR;

  // Settings / Profile Card
  const settingsName = document.getElementById('settings-name-display');
  const settingsEmail = document.getElementById('settings-email-display');
  const settingsRole = document.getElementById('settings-role-badge');
  const settingsAvatar = document.getElementById('settings-avatar-img');
  const settingsPhone = document.getElementById('settings-phone-display');
  const settingsMemberSince = document.getElementById('settings-member-since-display');

  if (settingsName) settingsName.innerText = currentUser.name || 'User';
  if (settingsEmail) settingsEmail.innerText = currentUser.email || 'No email linked';

  if (settingsPhone) {
    if (currentUser.phone && currentUser.phone.trim()) {
      settingsPhone.innerText = currentUser.phone.trim();
      settingsPhone.classList.remove('hidden');
    } else {
      settingsPhone.innerText = '';
      settingsPhone.classList.add('hidden');
    }
  }

  if (settingsMemberSince) {
    if (currentUser.createdAt) {
      try {
        const d = new Date(currentUser.createdAt);
        settingsMemberSince.innerText = 'Member since ' + d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      } catch (_) {
        settingsMemberSince.innerText = '';
      }
    } else {
      settingsMemberSince.innerText = '';
    }
  }

  if (settingsAvatar) settingsAvatar.src = currentUser.avatarUrl || DEFAULT_AVATAR;

  // USER DIRECTIVE:
  // "only show in profile card....plus two class teacher badge .......not teacher/administr badge"
  // "if admin profile....show above of plus two class teacher.... administartor badge very very small... with diferent color"
  const isAdmin = currentUser.role === 'admin';
  const ctBadge = document.getElementById('settings-classteacher-badge');
  const ctText = document.getElementById('settings-classteacher-text');
  const myCT = (currentUser.classTeacherOf || (classesList.find(c => isClassEqual(c.classTeacher, currentUser.name))?.name) || '').trim();

  if (myCT) {
    // User is a Class Teacher
    if (ctBadge && ctText) {
      ctText.textContent = `${myCT.toUpperCase()} CLASS TEACHER`;
      ctBadge.classList.remove('hidden');
    }
    if (isAdmin) {
      // Admin: show administrator badge ABOVE the class teacher badge, very very small with distinct purple/indigo styling
      if (settingsRole) {
        settingsRole.innerText = 'Administrator';
        settingsRole.className = "inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-black tracking-widest uppercase bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-2xs";
        settingsRole.classList.remove('hidden');
      }
    } else {
      // Regular Teacher: DO NOT SHOW teacher badge, ONLY show class teacher badge
      if (settingsRole) {
        settingsRole.classList.add('hidden');
      }
    }
  } else {
    // Not a Class Teacher: normal role badge
    if (ctBadge) ctBadge.classList.add('hidden');
    if (settingsRole) {
      settingsRole.innerText = isAdmin ? 'Administrator' : 'Teacher';
      if (isAdmin) {
        settingsRole.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30";
      } else {
        settingsRole.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-[#245b70]/15 text-[#245b70] dark:text-cyan-300 border border-[#245b70]/20";
      }
      settingsRole.classList.remove('hidden');
    }
  }

  // Render assigned classes & subjects in profile card
  const assignStrip = document.getElementById('settings-assignments-strip');
  const clsPills = document.getElementById('settings-classes-pills');
  const subPills = document.getElementById('settings-subjects-pills');
  if (assignStrip) assignStrip.classList.remove('hidden');

  const myAssign = getTeacherAssignments(currentUser.name, currentUser.email);
  if (clsPills) {
    clsPills.innerHTML = myAssign.assignedClasses.length > 0
      ? myAssign.assignedClasses.map(c => `<span class="px-2.5 py-1 rounded-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xs text-[#245b70] dark:text-cyan-300 border border-[#245b70]/30 font-bold text-xs shadow-2xs">${escapeHtml(c)}</span>`).join(' ')
      : '<span class="text-[11px] text-[var(--text-sub)] italic">None assigned</span>';
  }
  if (subPills) {
    subPills.innerHTML = myAssign.assignedSubjects.length > 0
      ? myAssign.assignedSubjects.map(s => `<span class="px-2.5 py-1 rounded-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xs text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-bold text-xs shadow-2xs">${escapeHtml(s)}</span>`).join(' ')
      : '<span class="text-[11px] text-[var(--text-sub)] italic">None assigned</span>';
  }

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
  if (currentUser.role !== 'student') {
    updateOutcomersBadges();
  }
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

function updateDeviceIcons(logoUrl) {
  const ts = Date.now();
  const effectiveUrl = logoUrl ? logoUrl : '/manifest-icon-192.png';
  const cacheBustUrl = effectiveUrl + (effectiveUrl.includes('?') ? '&' : '?') + 'v=' + ts;

  // 1. Live Refresh Favicon by replacing element to force browser to update
  const existingFavs = document.querySelectorAll("link[rel*='icon']");
  existingFavs.forEach(el => el.parentNode && el.parentNode.removeChild(el));

  const newFav = document.createElement('link');
  newFav.id = 'dynamic-favicon';
  newFav.rel = 'icon';
  newFav.href = cacheBustUrl;
  document.head.appendChild(newFav);

  // 2. Live Refresh Apple Touch Icon for mobile home screens
  const existingApples = document.querySelectorAll("link[rel='apple-touch-icon']");
  existingApples.forEach(el => el.parentNode && el.parentNode.removeChild(el));

  const newApple = document.createElement('link');
  newApple.id = 'dynamic-apple-icon';
  newApple.rel = 'apple-touch-icon';
  newApple.href = cacheBustUrl;
  document.head.appendChild(newApple);

  // 3. Update PWA Manifest link so mobile devices re-query the manifest
  const manifestLink = document.querySelector("link[rel='manifest']");
  if (manifestLink) {
    manifestLink.href = '/manifest.json?v=' + ts;
  }
}

// ================= APP SETTINGS (App Name & School Name & App Logo) =================
function updateAdminLogoPreview(logoUrl, letter = 'R') {
  const box = document.getElementById('admin-logo-preview-box');
  const resetBtn = document.getElementById('btn-admin-reset-logo');
  if (!box) return;

  const activeLogo = (logoUrl && logoUrl.trim()) ? logoUrl.trim() : '/icons/logo.png';
  box.innerHTML = `<img src="${escapeHtml(activeLogo)}" class="w-full h-full object-cover rounded-2xl" alt="App Icon">`;
  if (resetBtn) {
    if (logoUrl && logoUrl.trim() && logoUrl.trim() !== '/icons/logo.png') {
      resetBtn.classList.remove('hidden');
    } else {
      resetBtn.classList.add('hidden');
    }
  }
}

function updateHeaderBranding(appName, schoolName, appLogo) {
  const appEl = document.getElementById('header-app-name');
  const schoolEl = document.getElementById('school-name-display');
  const rawApp = (appName !== undefined && appName !== null ? String(appName) : '').trim();
  const rawSchool = (schoolName !== undefined && schoolName !== null ? String(schoolName) : '').trim();
  const rawLogo = (appLogo !== undefined && appLogo !== null ? String(appLogo) : (appSettings && appSettings.appLogo ? appSettings.appLogo : '')).trim();

  const firstLetter = (rawApp ? rawApp.trim()[0] : 'R').toUpperCase();
  const activeLogo = rawLogo || '/icons/logo.png';

  // 1. Keep localStorage cached for instantaneous launch display
  try {
    localStorage.setItem('registerly_app_name', rawApp || 'REGISTERLY');
    if (rawLogo) {
      localStorage.setItem('registerly_app_logo', rawLogo);
    } else {
      localStorage.removeItem('registerly_app_logo');
    }
  } catch (e) {}

  // 2. Place 1: Top-Left Header Brand Icon
  const brandIcon = document.getElementById('header-brand-icon');
  if (brandIcon) {
    brandIcon.innerHTML = `<img src="${escapeHtml(activeLogo)}" class="w-full h-full object-cover rounded-2xl" alt="App Logo">`;
    brandIcon.className = "w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white font-black text-xl shadow-inner flex-shrink-0 overflow-hidden";
  }

  // 3. Place 2: Opening App Launch Animation (Splash Screen)
  const splashName = document.getElementById('splash-app-name');
  const splashLetter = document.getElementById('splash-icon-letter');
  if (splashName) splashName.textContent = rawApp || 'REGISTERLY';
  if (splashLetter) {
    splashLetter.innerHTML = `<img src="${escapeHtml(activeLogo)}" class="w-full h-full object-cover rounded-2xl" alt="App Logo">`;
    splashLetter.className = "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg splash-icon-pulse overflow-hidden bg-white/10";
  }

  // 4. Place 3: Mobile & Devices App Icon (Favicon & Apple Touch Icon & PWA Manifest)
  updateDeviceIcons(activeLogo);

  // 5. Update Admin Panel preview if open
  updateAdminLogoPreview(rawLogo, firstLetter);

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

// Admin App Logo Select & Upload Handler
async function handleAdminAppLogoSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showToast('Please select a valid image file (PNG, JPG, WebP)', true);
    e.target.value = '';
    return;
  }

  if (file.size > 15 * 1024 * 1024) {
    showToast('Image file size must be less than 15MB', true);
    e.target.value = '';
    return;
  }

  const spinner = document.getElementById('admin-logo-upload-spinner');
  if (spinner) spinner.classList.remove('hidden');

  try {
    const uploadRes = await API.uploadPhoto(file, 'branding');
    if (!uploadRes.success || !uploadRes.url) {
      throw new Error(uploadRes.message || 'Failed to upload photo');
    }

    const newLogoUrl = uploadRes.url;
    const saveRes = await API.updateAdminSettings({ appLogo: newLogoUrl });
    if (!saveRes.success) {
      throw new Error(saveRes.message || 'Failed to save app logo');
    }

    if (appSettings) {
      appSettings.appLogo = newLogoUrl;
    } else {
      appSettings = saveRes.data || { appLogo: newLogoUrl };
    }

    updateHeaderBranding(appSettings.appName, appSettings.schoolName, newLogoUrl);
    showToast('App icon and photo updated across devices, header & splash!');
  } catch (err) {
    console.error('[Admin Logo Upload Error]', err);
    showToast('Error uploading photo: ' + (err.message || 'Upload failed'), true);
  } finally {
    if (spinner) spinner.classList.add('hidden');
    e.target.value = '';
  }
}

// Admin Reset App Logo to Default Handler
async function handleAdminResetAppLogo() {
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Reset App Logo',
        badge: 'Branding',
        message: 'Reset app icon and photo to the default icon?',
        isDanger: true
      })
    : confirm('Reset app icon and photo to the default icon?');
  if (!confirmed) return;

  const spinner = document.getElementById('admin-logo-upload-spinner');
  if (spinner) spinner.classList.remove('hidden');

  try {
    const saveRes = await API.updateAdminSettings({ appLogo: '' });
    if (!saveRes.success) {
      throw new Error(saveRes.message || 'Failed to reset app logo');
    }

    if (appSettings) {
      appSettings.appLogo = '';
    }

    updateHeaderBranding(appSettings ? appSettings.appName : '', appSettings ? appSettings.schoolName : '', '');
    showToast('App icon and photo reset to default!');
  } catch (err) {
    console.error('[Admin Reset Logo Error]', err);
    showToast('Error resetting logo: ' + (err.message || 'Failed'), true);
  } finally {
    if (spinner) spinner.classList.add('hidden');
  }
}

async function loadAppSettings() {
  try {
    const res = await API.getAdminSettings();
    if (res.success && res.data) {
      appSettings = res.data;
      const appName = 'REGISTERLY';
      const schoolName = res.data.schoolName !== undefined ? res.data.schoolName : '';
      const appLogo = '/icons/logo.png';
      updateHeaderBranding(appName, schoolName, appLogo);

      const adminAppInput = document.getElementById('admin-input-app-name');
      const adminSchoolInput = document.getElementById('admin-input-school-name');
      if (adminAppInput) adminAppInput.value = 'REGISTERLY';
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
      applyDashboardSectionVisibility();
      applyHeaderButtonPreference();

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

function applyHeaderButtonPreference() {
  const isStudent = (typeof isStudentPortalActive === 'function' && isStudentPortalActive()) || (currentUser && currentUser.role === 'student') || currentActiveTab === 'student-portal';
  const btnGuide = document.getElementById('header-guide-btn');
  const btnTheme = document.getElementById('dark-mode-btn');
  const btnLang = document.getElementById('header-language-btn');
  const btnNotif = document.getElementById('header-notif-btn');

  if (isStudent) {
    if (btnGuide) btnGuide.classList.add('hidden');
    if (btnNotif) btnNotif.classList.add('hidden');
    if (btnLang) btnLang.classList.add('hidden');
    return;
  }
  const pref = (appSettings && appSettings.headerActionButton) ? appSettings.headerActionButton : 'guide';

  if (btnGuide) btnGuide.classList.add('hidden');
  if (btnTheme) btnTheme.classList.add('hidden');
  if (btnLang) btnLang.classList.add('hidden');

  if (pref === 'theme') {
    if (btnTheme) btnTheme.classList.remove('hidden');
  } else if (pref === 'language') {
    if (btnLang) {
      btnLang.classList.remove('hidden');
      const headerLangText = document.getElementById('header-language-text');
      if (headerLangText) {
        const curLang = localStorage.getItem('app_language') || 'en';
        headerLangText.textContent = curLang === 'ml' ? 'മല' : 'EN';
      }
    }
  } else {
    if (btnGuide) btnGuide.classList.remove('hidden');
  }

  const selectEl = document.getElementById('admin-select-header-button');
  if (selectEl) selectEl.value = pref;
}

async function handleAdminHeaderButtonChange(val) {
  if (!appSettings) appSettings = {};
  appSettings.headerActionButton = val;
  applyHeaderButtonPreference();
  try {
    await API.updateAdminSettings('REGISTERLY', appSettings.schoolName || '', { headerActionButton: val });
    showToast('Header button preference updated!');
  } catch (e) {
    showToast(e.message || 'Error updating setting', true);
  }
}

function _applyTeachersTabVisibility() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  const canSee = canViewTeachersTab();
  const btn = document.getElementById('bottom-tab-teachers');
  if (btn) btn.style.display = (isAdmin || canSee) ? '' : 'none';

  const shortcutTeachers = document.getElementById('dash-shortcut-teachers');
  if (shortcutTeachers) shortcutTeachers.style.display = (isAdmin || canSee) ? '' : 'none';

  const statTeachers = document.getElementById('dash-stat-card-teachers');
  if (statTeachers) statTeachers.style.display = (isAdmin || canSee) ? '' : 'none';

  // If currently on teachers tab but no longer allowed, redirect to home
  if (!canSee && !isAdmin) {
    const teacherView = document.getElementById('view-teachers');
    if (teacherView && !teacherView.classList.contains('hidden')) {
      selectTab('home');
    }
  }
}

async function handleAdminToggleTeachersTab(enabled) {
  try {
    const res = await API.updateAdminSettings(
      'REGISTERLY',
      appSettings ? appSettings.schoolName : '',
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
    const schoolInput = document.getElementById('admin-input-school-name');
    const schoolName = (schoolInput ? schoolInput.value : '').trim();
    const res = await API.updateAdminSettings('REGISTERLY', schoolName);
    if (res.success) {
      showToast('Campus Name updated!');
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
      updateUserUI();
    }
  } catch (error) {
    console.log('[Classes Load]', error);
  }
}

function getTeacherAllowedClasses() {
  if (!currentUser || currentUser.role === 'admin') {
    return classesList || [];
  }
  const myAssign = getTeacherAssignments(currentUser.name, currentUser.email);
  const allowedSet = new Set(myAssign.assignedClasses.map(c => (c || '').trim().toLowerCase()));
  if (currentUser.classTeacherOf) {
    allowedSet.add(currentUser.classTeacherOf.trim().toLowerCase());
  }
  (classesList || []).forEach(c => {
    if (isClassEqual(c.classTeacher, currentUser.name)) {
      allowedSet.add((c.name || '').trim().toLowerCase());
    }
  });
  return (classesList || []).filter(c => allowedSet.has((c.name || '').trim().toLowerCase()));
}

function getTeacherAllowedSubjectsForClass(className) {
  const allForClass = getAppropriateSubjectsForClass(className);
  if (!currentUser || currentUser.role === 'admin') {
    return { teacherSubs: allForClass, isCT: true };
  }
  const normName = (currentUser.name || '').trim().toLowerCase();
  const normEmail = (currentUser.email || '').trim().toLowerCase();
  const isCT = (currentUser.classTeacherOf && isClassEqual(currentUser.classTeacherOf, className)) ||
               (classesList || []).some(c => isClassEqual(c.name, className) && isClassEqual(c.classTeacher, currentUser.name));

  const teacherSubs = allForClass.filter(s => {
    const st = (s.teacher || '').trim().toLowerCase();
    const se = (s.teacherEmail || s.ownerEmail || '').trim().toLowerCase();
    return (normName && st === normName) || (normEmail && se === normEmail);
  });

  return { teacherSubs, isCT };
}

function populateClassDropdowns() {
  const selClass = document.getElementById('sel-class');
  const repClass = document.getElementById('report-class');
  const studentFilter = document.getElementById('student-class-filter');
  const editStudentClass = document.getElementById('edit-student-class');
  const newStudentClass = document.getElementById('new-student-class');

  const optionsHtml = classesList.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

  if (selClass) {
    const isTeacher = currentUser && currentUser.role !== 'admin';
    const allowedClasses = isTeacher ? getTeacherAllowedClasses() : classesList;
    const placeholderOpt = `<option value="" disabled selected>Select Class</option>`;
    if (isTeacher && allowedClasses.length === 0) {
      selClass.innerHTML = `<option value="" disabled selected>No classes assigned to you</option>`;
    } else {
      selClass.innerHTML = placeholderOpt + allowedClasses.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }
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
  populateQuickAttendanceDropdowns();
}

// Drag & Drop Sorting for Classes (Only active after long press / hold)
let draggedClassIndex = null;
let touchDraggedClassIndex = null;
let touchClassElement = null;
let recentlyPlacedClassId = null;
let classHoldTimer = null;
let classHoldActive = false;
let classHoldStartX = 0;
let classHoldStartY = 0;

function handleClassPointerDown(e, index) {
  if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
  const card = e.currentTarget;
  classHoldActive = false;
  classHoldStartX = e.clientX || 0;
  classHoldStartY = e.clientY || 0;

  if (classHoldTimer) clearTimeout(classHoldTimer);
  classHoldTimer = setTimeout(() => {
    classHoldActive = true;
    card.setAttribute('draggable', 'true');
    card.classList.add('drag-activated');
    triggerNavHaptic('medium');
  }, 250);
}

function handleClassPointerMove(e) {
  if (!classHoldTimer && !classHoldActive) return;
  const currentX = e.clientX || 0;
  const currentY = e.clientY || 0;
  const diffX = Math.abs(currentX - classHoldStartX);
  const diffY = Math.abs(currentY - classHoldStartY);

  if (!classHoldActive && (diffX > 8 || diffY > 8)) {
    if (classHoldTimer) {
      clearTimeout(classHoldTimer);
      classHoldTimer = null;
    }
  }
}

function handleClassPointerUp(e) {
  if (classHoldTimer) {
    clearTimeout(classHoldTimer);
    classHoldTimer = null;
  }
  classHoldActive = false;
  const card = e.currentTarget;
  if (card) {
    card.classList.remove('drag-activated');
    card.setAttribute('draggable', 'false');
  }
}

function handleClassDragStart(e, index) {
  const fromHandle = Boolean(e.target.closest('.drag-handle'));
  if (!classHoldActive && !fromHandle) {
    e.preventDefault();
    return;
  }
  draggedClassIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  try {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'class', index }));
  } catch (_) {}
  e.currentTarget.classList.add('dragging');
  triggerNavHaptic('light');
}

function handleClassDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.currentTarget;
  if (!item.classList.contains('drag-over') && draggedClassIndex !== index) {
    item.classList.add('drag-over');
  }
}

function handleClassDragLeave(e) {
  const item = e.currentTarget;
  if (!item.contains(e.relatedTarget)) {
    item.classList.remove('drag-over');
  }
}

function handleClassDragEnd(e) {
  if (classHoldTimer) {
    clearTimeout(classHoldTimer);
    classHoldTimer = null;
  }
  classHoldActive = false;
  draggedClassIndex = null;
  document.querySelectorAll('#class-cards-container .drag-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over', 'drag-activated');
    el.setAttribute('draggable', 'false');
  });
}

async function handleClassDrop(e, targetIndex) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  let sourceIndex = draggedClassIndex;
  if (sourceIndex === null) {
    const rawData = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
    if (rawData !== null && rawData !== '') {
      sourceIndex = parseInt(rawData, 10);
    }
  }

  handleClassDragEnd(e);

  if (sourceIndex === null || isNaN(sourceIndex) || sourceIndex === targetIndex) return;

  const movedClass = classesList.splice(sourceIndex, 1)[0];
  if (!movedClass) return;
  classesList.splice(targetIndex, 0, movedClass);

  recentlyPlacedClassId = movedClass._id;
  triggerNavHaptic('strong');

  renderClassesList();
  populateClassDropdowns();
  renderStudentsDirectory();
  renderSubjectsList();

  setTimeout(() => {
    if (recentlyPlacedClassId === movedClass._id) {
      recentlyPlacedClassId = null;
      document.querySelectorAll('#class-cards-container .drag-item-placed').forEach(el => {
        el.classList.remove('drag-item-placed');
      });
    }
  }, 600);

  try {
    const orderedIds = classesList.map(c => c._id);
    await API.reorderClasses(orderedIds);
    showToast('Class order updated!');
  } catch (err) {
    console.error('[Reorder Classes Error]', err);
  }
}

function handleClassContainerDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleClassContainerDrop(e) {
  if (e.target.closest('.drag-item')) return;
  e.preventDefault();
  if (draggedClassIndex === null) return;
  handleClassDrop(e, Math.max(0, classesList.length - 1));
}

// Mobile & Tablet Touch Long-Press Hold-to-Drag for Classes
function handleClassTouchStart(e, index) {
  if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
  const touch = e.touches[0];
  classHoldStartX = touch.clientX;
  classHoldStartY = touch.clientY;
  classHoldActive = false;
  touchDraggedClassIndex = null;
  touchClassElement = e.currentTarget;

  if (classHoldTimer) clearTimeout(classHoldTimer);
  classHoldTimer = setTimeout(() => {
    classHoldActive = true;
    touchDraggedClassIndex = index;
    if (touchClassElement) {
      touchClassElement.classList.add('drag-activated', 'dragging');
    }
    triggerNavHaptic('medium');
  }, 250);
}

function handleClassTouchMove(e) {
  const touch = e.touches[0];
  const diffX = Math.abs(touch.clientX - classHoldStartX);
  const diffY = Math.abs(touch.clientY - classHoldStartY);

  if (!classHoldActive) {
    if (diffX > 8 || diffY > 8) {
      if (classHoldTimer) {
        clearTimeout(classHoldTimer);
        classHoldTimer = null;
      }
    }
    return; // Allow native page scroll
  }

  // Active dragging after hold: prevent page scroll
  e.preventDefault();
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const card = target ? target.closest('#class-cards-container .drag-item') : null;

  document.querySelectorAll('#class-cards-container .drag-item').forEach(el => el.classList.remove('drag-over'));
  if (card && card !== touchClassElement) {
    card.classList.add('drag-over');
  }
}

async function handleClassTouchEnd(e) {
  if (classHoldTimer) {
    clearTimeout(classHoldTimer);
    classHoldTimer = null;
  }

  if (!classHoldActive || touchDraggedClassIndex === null) {
    classHoldActive = false;
    touchDraggedClassIndex = null;
    if (touchClassElement) {
      touchClassElement.classList.remove('drag-activated', 'dragging');
      touchClassElement = null;
    }
    return;
  }

  classHoldActive = false;
  const touch = e.changedTouches[0];
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const card = target ? target.closest('#class-cards-container .drag-item') : null;

  const sourceIndex = touchDraggedClassIndex;
  touchDraggedClassIndex = null;
  if (touchClassElement) {
    touchClassElement.classList.remove('drag-activated', 'dragging');
    touchClassElement = null;
  }

  document.querySelectorAll('#class-cards-container .drag-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over', 'drag-activated');
  });

  if (card) {
    const targetIdx = parseInt(card.getAttribute('data-index'), 10);
    if (!isNaN(targetIdx) && targetIdx !== sourceIndex) {
      const movedClass = classesList.splice(sourceIndex, 1)[0];
      if (!movedClass) return;
      classesList.splice(targetIdx, 0, movedClass);

      recentlyPlacedClassId = movedClass._id;
      triggerNavHaptic('strong');

      renderClassesList();
      populateClassDropdowns();
      renderStudentsDirectory();
      renderSubjectsList();

      setTimeout(() => {
        if (recentlyPlacedClassId === movedClass._id) {
          recentlyPlacedClassId = null;
          document.querySelectorAll('#class-cards-container .drag-item-placed').forEach(el => {
            el.classList.remove('drag-item-placed');
          });
        }
      }, 600);

      try {
        const orderedIds = classesList.map(c => c._id);
        await API.reorderClasses(orderedIds);
        showToast('Class order updated!');
      } catch (err) {
        console.error('[Reorder Classes Error]', err);
      }
    }
  }
}

async function renderClassesList() {
  const container = document.getElementById('class-cards-container');
  if (!container) return;

  const countEl = document.getElementById('classes-count-total');
  if (countEl) countEl.innerText = classesList.length;

  if (classesList.length === 0) {
    container.innerHTML = `<div class="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] text-center text-xs text-[var(--text-sub)]">No classes added yet. Click "Add Class" above to create one.</div>`;
    return;
  }

  // Load students for count if not already cached
  if (!cachedAllStudents || cachedAllStudents.length === 0) {
    try {
      const stRes = await API.getStudents('all');
      if (stRes && stRes.success && Array.isArray(stRes.data)) {
        cachedAllStudents = stRes.data;
      }
    } catch (_) {}
  }

  const palette = [
    { bg: 'bg-teal-500/10 dark:bg-teal-400/15', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-500/25', dot: 'bg-teal-500' },
    { bg: 'bg-indigo-500/10 dark:bg-indigo-400/15', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-500/25', dot: 'bg-indigo-500' },
    { bg: 'bg-blue-500/10 dark:bg-blue-400/15', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/25', dot: 'bg-blue-500' },
    { bg: 'bg-cyan-500/10 dark:bg-cyan-400/15', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-500/25', dot: 'bg-cyan-500' },
    { bg: 'bg-amber-500/10 dark:bg-amber-400/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/25', dot: 'bg-amber-500' },
    { bg: 'bg-emerald-500/10 dark:bg-emerald-400/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/25', dot: 'bg-emerald-500' }
  ];

  container.innerHTML = classesList.map((c, index) => {
    const isPlaced = recentlyPlacedClassId && String(recentlyPlacedClassId) === String(c._id);
    const placedClass = isPlaced ? ' drag-item-placed' : '';

    const studentCount = (cachedAllStudents || []).filter(s => isClassEqual(s.class, c.name)).length;
    const classSubjects = (subjectsList || []).filter(s => (s.assignedClasses || []).some(ac => isClassEqual(ac, c.name)));
    const uniqueClassSubjects = [];
    const seenSub = new Set();
    classSubjects.forEach(s => {
      const n = (s.name || '').trim();
      const k = n.toLowerCase();
      if (n && !seenSub.has(k)) {
        seenSub.add(k);
        uniqueClassSubjects.push(n);
      }
    });
    const subjectCount = uniqueClassSubjects.length;
    const subjectPills = subjectCount > 0
      ? uniqueClassSubjects.map((sub, sIdx) => {
          const col = palette[sIdx % palette.length];
          return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${col.bg} ${col.text} border ${col.border} shadow-2xs select-none transition hover:scale-105" title="${escapeHtml(sub)}">
            <span class="w-1.5 h-1.5 rounded-full ${col.dot} flex-shrink-0"></span>
            <span>${escapeHtml(sub)}</span>
          </span>`;
        }).join('')
      : `<span class="text-xs text-[var(--text-sub)] italic">No subjects assigned</span>`;

    const actionBtns = canUserEditDelete() ? `
      <div class="flex items-center gap-1.5 flex-shrink-0 ml-auto pl-2">
        <button onclick="openEditClassModal('${c._id}')" title="Edit Class" class="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 flex items-center justify-center transition shadow-xs active:scale-95">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button onclick="deleteClass('${c._id}', '${escapeQuotes(c.name)}')" title="Delete Class" class="w-8 h-8 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-100 border border-rose-300/30 flex items-center justify-center transition shadow-xs active:scale-95">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>` : '';

    return `
    <div class="drag-item bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col ${placedClass}"
         data-index="${index}"
         data-id="${c._id}"
         draggable="false"
         onmousedown="handleClassPointerDown(event, ${index})"
         onmousemove="handleClassPointerMove(event)"
         onmouseup="handleClassPointerUp(event)"
         onmouseleave="handleClassPointerUp(event)"
         ontouchstart="handleClassTouchStart(event, ${index})"
         ontouchmove="handleClassTouchMove(event)"
         ontouchend="handleClassTouchEnd(event)"
         ontouchcancel="handleClassTouchEnd(event)"
         ondragstart="handleClassDragStart(event, ${index})"
         ondragover="handleClassDragOver(event, ${index})"
         ondragleave="handleClassDragLeave(event)"
         ondragend="handleClassDragEnd(event)"
         ondrop="handleClassDrop(event, ${index})">

      <!-- Heading Div with Brand Gradient Header -->
      <div class="custom-gradient-header text-white p-3.5 sm:p-4 rounded-t-2xl flex justify-between items-center shadow-xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="drag-handle text-white/60 hover:text-white p-1 flex-shrink-0 cursor-grab active:cursor-grabbing transition" title="Hold card or drag handle to reorder">
            <svg class="w-4 h-4 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
            </svg>
          </div>
          <div class="min-w-0">
            <h3 class="text-sm sm:text-base font-black text-white truncate">${c.isPrivate ? '<svg style=\"display:inline;width:11px;height:11px;color:#db2777;vertical-align:middle;margin-right:3px\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"></path></svg>' : ''}${escapeHtml(c.name)}</h3>
            <div class="text-[10px] sm:text-xs text-teal-100 dark:text-teal-200 flex items-center gap-1 mt-0.5 truncate select-none">
              <svg class="w-3.5 h-3.5 opacity-80 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span class="truncate">${c.classTeacher ? 'Teacher: ' + escapeHtml(c.classTeacher) : '<span class="text-teal-200/60 font-normal italic">No Teacher Assigned</span>'}</span>
            </div>
          </div>
        </div>
        ${actionBtns}
      </div>

      <!-- Stats Row & Assigned Subjects Div -->
      <div class="p-3 sm:p-3.5 bg-[var(--card-bg)] space-y-3">
        <!-- Total Students & Subjects Row with modern standard SVGs (no emojis) -->
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 dark:bg-blue-400/15 border border-blue-500/20 text-xs font-bold text-blue-700 dark:text-blue-300 select-none shadow-2xs">
            <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
            <span><strong class="font-black">${studentCount}</strong> Students</span>
          </div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/15 border border-indigo-500/20 text-xs font-bold text-indigo-700 dark:text-indigo-300 select-none shadow-2xs">
            <svg class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            <span><strong class="font-black">${subjectCount}</strong> Subjects</span>
          </div>
        </div>

        <!-- Assigned Subjects Div -->
        <div class="pt-2 border-t border-[var(--border-color)]/70 space-y-1.5">
          <div class="text-[10px] font-black uppercase tracking-wider text-[var(--text-sub)] select-none flex items-center gap-1">
            <svg class="w-3 h-3 text-[var(--text-sub)] opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            <span>ASSIGNED SUBJECTS</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            ${subjectPills}
          </div>
        </div>
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
  const teacherEl = document.getElementById('edit-class-teacher');
  const classTeacher = teacherEl ? teacherEl.value.trim() : '';
  const selOpt = teacherEl && teacherEl.selectedIndex >= 0 ? teacherEl.options[teacherEl.selectedIndex] : null;
  const classTeacherEmail = selOpt ? (selOpt.getAttribute('data-email') || '') : '';
  try {
    const res = await API.updateClass(activeEditClassId, name, classTeacher, [], classTeacherEmail);
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
  const teacherEl = document.getElementById('input-class-teacher');
  const classTeacher = teacherEl ? teacherEl.value.trim() : '';
  const selOpt = teacherEl && teacherEl.selectedIndex >= 0 ? teacherEl.options[teacherEl.selectedIndex] : null;
  const classTeacherEmail = selOpt ? (selOpt.getAttribute('data-email') || '') : '';
  try {
    const res = await API.addClass(name, classTeacher, [], false, classTeacherEmail);
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
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Delete Class',
        badge: 'Class Management',
        message: `Are you sure you want to delete "${name}"?`,
        isDanger: true
      })
    : confirm(`Are you sure you want to delete "${name}"?`);
  if (!confirmed) return;
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
      updateUserUI();
    }
  } catch (error) {
    console.log('[Subjects Load]', error);
  }
}

function getAppropriateSubjectsForClass(className) {
  if (!className) return [];
  const allSubs = [...(subjectsList || []), ...(typeof pwSubjectsList !== 'undefined' && Array.isArray(pwSubjectsList) ? pwSubjectsList : [])];
  if (allSubs.length === 0) return [];
  const matched = allSubs.filter(s => (s.assignedClasses || []).some(ac => isClassEqual(ac, className)));
  const unique = [];
  const seen = new Set();
  matched.forEach(s => {
    const n = (s.name || '').trim();
    const k = n.toLowerCase();
    if (n && !seen.has(k)) {
      seen.add(k);
      unique.push(s);
    }
  });
  return unique;
}

function updateAttendanceSubjectsDropdown(selectedClass, preferredSubject) {
  const selSubject = document.getElementById('sel-subject');
  if (!selSubject) return;

  // Show placeholder if attendance is not ready (initial load)
  if (!attendanceReadyToLoad) {
    selSubject.innerHTML = `<option value="" disabled selected>Select Subject</option>`;
    return;
  }

  const targetSub = (preferredSubject !== undefined && preferredSubject !== null && preferredSubject !== '')
    ? String(preferredSubject).trim()
    : String(currentSubject || '').trim();

  const isTeacher = currentUser && currentUser.role !== 'admin';
  if (isTeacher) {
    const { teacherSubs, isCT } = getTeacherAllowedSubjectsForClass(selectedClass);
    if (teacherSubs.length > 0) {
      selSubject.innerHTML = teacherSubs.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');

      let match = null;
      if (targetSub && targetSub !== 'all') {
        match = teacherSubs.find(s => (s.name || '').trim().toLowerCase() === targetSub.toLowerCase());
      }

      if (match) {
        currentSubject = match.name;
        selSubject.value = currentSubject;
      } else if (targetSub && targetSub !== 'all') {
        const newOpt = document.createElement('option');
        newOpt.value = targetSub;
        newOpt.textContent = targetSub;
        selSubject.appendChild(newOpt);
        currentSubject = targetSub;
        selSubject.value = targetSub;
      } else {
        currentSubject = teacherSubs[0].name;
        selSubject.value = currentSubject;
      }
    } else if (isCT) {
      selSubject.innerHTML = `<option value="General">General (Class Teacher)</option>`;
      currentSubject = 'General';
      selSubject.value = 'General';
    } else {
      if (targetSub && targetSub !== 'all') {
        selSubject.innerHTML = `<option value="${escapeHtml(targetSub)}">${escapeHtml(targetSub)}</option>`;
        currentSubject = targetSub;
        selSubject.value = targetSub;
      } else {
        selSubject.innerHTML = `<option value="" disabled selected>No subjects assigned to you</option>`;
        currentSubject = '';
      }
    }
  } else {
    const validSubjects = getAppropriateSubjectsForClass(selectedClass);
    if (validSubjects.length > 0) {
      selSubject.innerHTML = validSubjects.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');

      let match = null;
      if (targetSub && targetSub !== 'all') {
        match = validSubjects.find(s => (s.name || '').trim().toLowerCase() === targetSub.toLowerCase());
      }

      if (match) {
        currentSubject = match.name;
        selSubject.value = currentSubject;
      } else if (targetSub && targetSub !== 'all') {
        const newOpt = document.createElement('option');
        newOpt.value = targetSub;
        newOpt.textContent = targetSub;
        selSubject.appendChild(newOpt);
        currentSubject = targetSub;
        selSubject.value = targetSub;
      } else {
        currentSubject = validSubjects[0].name;
        selSubject.value = currentSubject;
      }
    } else {
      if (targetSub && targetSub !== 'all') {
        selSubject.innerHTML = `<option value="${escapeHtml(targetSub)}">${escapeHtml(targetSub)}</option>`;
        currentSubject = targetSub;
        selSubject.value = targetSub;
      } else {
        selSubject.innerHTML = `<option value="General">General</option>`;
        currentSubject = 'General';
      }
    }
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

  const seenReportNames = new Set();
  const uniqueRelevant = [];
  relevantSubjects.forEach(s => {
    const sName = String(s.name || s || '').trim();
    const k = sName.toLowerCase();
    if (sName && !seenReportNames.has(k)) {
      seenReportNames.add(k);
      uniqueRelevant.push(sName);
    }
  });
  const optionsHtml = uniqueRelevant.map(sName => `<option value="${escapeHtml(sName)}">${escapeHtml(sName)}</option>`).join('');
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

// Drag & Drop Sorting for Subjects (Only active after long press / hold)
let draggedSubjectIndex = null;
let touchDraggedSubjectIndex = null;
let touchSubjectElement = null;
let recentlyPlacedSubjectId = null;
let subjectHoldTimer = null;
let subjectHoldActive = false;
let subjectHoldStartX = 0;
let subjectHoldStartY = 0;

function handleSubjectPointerDown(e, index) {
  if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
  const card = e.currentTarget;
  subjectHoldActive = false;
  subjectHoldStartX = e.clientX || 0;
  subjectHoldStartY = e.clientY || 0;

  if (subjectHoldTimer) clearTimeout(subjectHoldTimer);
  subjectHoldTimer = setTimeout(() => {
    subjectHoldActive = true;
    card.setAttribute('draggable', 'true');
    card.classList.add('drag-activated');
    triggerNavHaptic('medium');
  }, 250);
}

function handleSubjectPointerMove(e) {
  if (!subjectHoldTimer && !subjectHoldActive) return;
  const currentX = e.clientX || 0;
  const currentY = e.clientY || 0;
  const diffX = Math.abs(currentX - subjectHoldStartX);
  const diffY = Math.abs(currentY - subjectHoldStartY);

  if (!subjectHoldActive && (diffX > 8 || diffY > 8)) {
    if (subjectHoldTimer) {
      clearTimeout(subjectHoldTimer);
      subjectHoldTimer = null;
    }
  }
}

function handleSubjectPointerUp(e) {
  if (subjectHoldTimer) {
    clearTimeout(subjectHoldTimer);
    subjectHoldTimer = null;
  }
  subjectHoldActive = false;
  const card = e.currentTarget;
  if (card) {
    card.classList.remove('drag-activated');
    card.setAttribute('draggable', 'false');
  }
}

function handleSubjectDragStart(e, index) {
  const fromHandle = Boolean(e.target.closest('.drag-handle'));
  if (!subjectHoldActive && !fromHandle) {
    e.preventDefault();
    return;
  }
  draggedSubjectIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  try {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'subject', index }));
  } catch (_) {}
  e.currentTarget.classList.add('dragging');
  triggerNavHaptic('light');
}

function handleSubjectDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.currentTarget;
  if (!item.classList.contains('drag-over') && draggedSubjectIndex !== index) {
    item.classList.add('drag-over');
  }
}

function handleSubjectDragLeave(e) {
  const item = e.currentTarget;
  if (!item.contains(e.relatedTarget)) {
    item.classList.remove('drag-over');
  }
}

function handleSubjectDragEnd(e) {
  if (subjectHoldTimer) {
    clearTimeout(subjectHoldTimer);
    subjectHoldTimer = null;
  }
  subjectHoldActive = false;
  draggedSubjectIndex = null;
  document.querySelectorAll('#subject-cards-container .drag-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over', 'drag-activated');
    el.setAttribute('draggable', 'false');
  });
}

async function handleSubjectDrop(e, targetIndex) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  let sourceIndex = draggedSubjectIndex;
  if (sourceIndex === null) {
    const rawData = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
    if (rawData !== null && rawData !== '') {
      sourceIndex = parseInt(rawData, 10);
    }
  }

  handleSubjectDragEnd(e);

  if (sourceIndex === null || isNaN(sourceIndex) || sourceIndex === targetIndex) return;

  const movedSubject = subjectsList.splice(sourceIndex, 1)[0];
  if (!movedSubject) return;
  subjectsList.splice(targetIndex, 0, movedSubject);

  recentlyPlacedSubjectId = movedSubject._id;
  triggerNavHaptic('medium');

  renderSubjectsList();
  populateSubjectDropdowns();
  updateUserUI();

  setTimeout(() => {
    if (recentlyPlacedSubjectId === movedSubject._id) {
      recentlyPlacedSubjectId = null;
      document.querySelectorAll('#subject-cards-container .drag-item-placed').forEach(el => {
        el.classList.remove('drag-item-placed');
      });
    }
  }, 600);

  try {
    const orderedIds = subjectsList.map(s => s._id);
    await API.reorderSubjects(orderedIds);
    showToast('Subject order updated!');
  } catch (err) {
    console.error('[Reorder Subjects Error]', err);
  }
}

function handleSubjectContainerDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleSubjectContainerDrop(e) {
  if (e.target.closest('.drag-item')) return;
  e.preventDefault();
  if (draggedSubjectIndex === null) return;
  handleSubjectDrop(e, Math.max(0, subjectsList.length - 1));
}

// Touch Support for Subjects on Mobile & Tablets
function handleSubjectTouchStart(e, index) {
  if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
  const touch = e.touches[0];
  subjectHoldStartX = touch.clientX;
  subjectHoldStartY = touch.clientY;
  subjectHoldActive = false;
  touchDraggedSubjectIndex = null;
  touchSubjectElement = e.currentTarget;

  if (subjectHoldTimer) clearTimeout(subjectHoldTimer);
  subjectHoldTimer = setTimeout(() => {
    subjectHoldActive = true;
    touchDraggedSubjectIndex = index;
    if (touchSubjectElement) {
      touchSubjectElement.classList.add('drag-activated', 'dragging');
    }
    triggerNavHaptic('medium');
  }, 250);
}

function handleSubjectTouchMove(e) {
  const touch = e.touches[0];
  const diffX = Math.abs(touch.clientX - subjectHoldStartX);
  const diffY = Math.abs(touch.clientY - subjectHoldStartY);

  if (!subjectHoldActive) {
    if (diffX > 8 || diffY > 8) {
      if (subjectHoldTimer) {
        clearTimeout(subjectHoldTimer);
        subjectHoldTimer = null;
      }
    }
    return; // Allow native scroll
  }

  // Active dragging after hold
  e.preventDefault();
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const card = target ? target.closest('#subject-cards-container .drag-item') : null;

  document.querySelectorAll('#subject-cards-container .drag-item').forEach(el => el.classList.remove('drag-over'));
  if (card && card !== touchSubjectElement) {
    card.classList.add('drag-over');
  }
}

async function handleSubjectTouchEnd(e) {
  if (subjectHoldTimer) {
    clearTimeout(subjectHoldTimer);
    subjectHoldTimer = null;
  }

  if (!subjectHoldActive || touchDraggedSubjectIndex === null) {
    subjectHoldActive = false;
    touchDraggedSubjectIndex = null;
    if (touchSubjectElement) {
      touchSubjectElement.classList.remove('drag-activated', 'dragging');
      touchSubjectElement = null;
    }
    return;
  }

  subjectHoldActive = false;
  const touch = e.changedTouches[0];
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const card = target ? target.closest('#subject-cards-container .drag-item') : null;

  const sourceIndex = touchDraggedSubjectIndex;
  touchDraggedSubjectIndex = null;
  if (touchSubjectElement) {
    touchSubjectElement.classList.remove('drag-activated');
    touchSubjectElement = null;
  }

  document.querySelectorAll('#subject-cards-container .drag-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over', 'drag-activated');
  });

  if (card) {
    const targetIdx = parseInt(card.getAttribute('data-index'), 10);
    if (!isNaN(targetIdx) && targetIdx !== sourceIndex) {
      const movedSubject = subjectsList.splice(sourceIndex, 1)[0];
      if (!movedSubject) return;
      subjectsList.splice(targetIdx, 0, movedSubject);

      recentlyPlacedSubjectId = movedSubject._id;
      triggerNavHaptic('strong');

      renderSubjectsList();
      populateSubjectDropdowns();
      updateUserUI();

      setTimeout(() => {
        if (recentlyPlacedSubjectId === movedSubject._id) {
          recentlyPlacedSubjectId = null;
          document.querySelectorAll('#subject-cards-container .drag-item-placed').forEach(el => {
            el.classList.remove('drag-item-placed');
          });
        }
      }, 600);

      try {
        const orderedIds = subjectsList.map(s => s._id);
        await API.reorderSubjects(orderedIds);
        showToast('Subject order updated!');
      } catch (err) {
        console.error('[Reorder Subjects Error]', err);
      }
    }
  }
}

function _generateSubjectCardHtml(s, index, categoryContext = '') {
  const isPlaced = recentlyPlacedSubjectId && String(recentlyPlacedSubjectId) === String(s._id);
  const placedClass = isPlaced ? ' drag-item-placed' : '';

  return `
  <div class="drag-item bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center justify-between transition-all${placedClass}"
       data-index="${index}"
       data-id="${s._id}"
       data-category="${escapeHtml(categoryContext)}"
       draggable="false"
       onmousedown="handleSubjectPointerDown(event, ${index})"
       onmousemove="handleSubjectPointerMove(event)"
       onmouseup="handleSubjectPointerUp(event)"
       onmouseleave="handleSubjectPointerUp(event)"
       ontouchstart="handleSubjectTouchStart(event, ${index})"
       ontouchmove="handleSubjectTouchMove(event)"
       ontouchend="handleSubjectTouchEnd(event)"
       ontouchcancel="handleSubjectTouchEnd(event)"
       ondragstart="handleSubjectDragStart(event, ${index})"
       ondragover="handleSubjectDragOver(event, ${index})"
       ondragleave="handleSubjectDragLeave(event)"
       ondragend="handleSubjectDragEnd(event)"
       ondrop="handleSubjectDrop(event, ${index})">
    <div class="flex items-center gap-3">
      <!-- Drag Handle Icon -->
      <div class="drag-handle text-[var(--text-sub)] hover:text-[#245b70] p-1 flex-shrink-0 cursor-grab active:cursor-grabbing" title="Hold card or drag handle to reorder">
        <svg class="w-4 h-4 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-[var(--text-main)] text-sm select-none">${s.isPrivate ? '<svg style="display:inline;width:11px;height:11px;color:#db2777;vertical-align:middle;margin-right:3px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : ''}${escapeHtml(s.name)}</h3>
          <span class="text-[10px] font-black px-1.5 py-0.2 rounded bg-[#245b70]/10 text-[#245b70] dark:bg-cyan-400/10 dark:text-cyan-400 select-none">${escapeHtml(s.subjectCode)}</span>
        </div>
        ${s.teacher ? `<p class="text-xs text-[var(--text-sub)] mt-0.5 select-none">Teacher: ${escapeHtml(s.teacher)}</p>` : ''}
      </div>
    </div>
    ${canUserEditDelete() ? `
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <button onclick="openEditSubjectModal('${s._id}', '${escapeQuotes(s.name)}', '${escapeQuotes(s.subjectCode)}', '${escapeQuotes(s.teacher || '')}')" title="Edit Subject" class="w-8 h-8 rounded-xl bg-[var(--bg-page)] text-[var(--text-main)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      </button>
      <button onclick="deleteSubject('${s._id}', '${escapeQuotes(s.name)}')" title="Delete Subject" class="w-8 h-8 rounded-xl btn-delete flex items-center justify-center transition">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
    ` : ''}
  </div>
  `;
}

function renderSubjectsList() {
  const container = document.getElementById('subject-cards-container');
  if (!container) return;

  if (subjectsList.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No subjects added yet.</div>`;
    return;
  }

  // Group subjects by class according to classesList order (from Add Class tab)
  let html = '';
  const renderedSubjectIds = new Set();

  (classesList || []).forEach(cls => {
    const clsName = (cls.name || cls || '').trim();
    // Match subjects assigned to this class
    const classSubs = subjectsList.filter(s =>
      Array.isArray(s.assignedClasses) && s.assignedClasses.some(ac => isClassEqual(ac, clsName))
    );

    if (classSubs.length > 0) {
      classSubs.forEach(s => renderedSubjectIds.add(String(s._id)));
      html += `
        <div class="space-y-2.5 pt-1 pb-1">
          <div class="flex items-center justify-between pt-2 pb-1 select-none">
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-[#245b70] via-[#2a6880] to-[#1e4e60] text-white shadow-sm border border-[#245b70]/40">
              <svg class="w-3.5 h-3.5 text-white/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <span class="text-xs font-black tracking-wider uppercase">${escapeHtml(clsName)}</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-xl bg-white/20 text-white font-black text-[11px] shadow-2xs">
                TOTAL: ${classSubs.length}
              </span>
            </div>
            <div class="h-[2px] flex-1 bg-gradient-to-r from-[#245b70]/30 via-[#245b70]/15 to-transparent rounded-full ml-3"></div>
          </div>
          <div class="space-y-2.5">
            ${classSubs.map(s => {
              const globalIndex = subjectsList.findIndex(item => String(item._id) === String(s._id));
              return _generateSubjectCardHtml(s, globalIndex >= 0 ? globalIndex : 0, clsName);
            }).join('')}
          </div>
        </div>
      `;
    }
  });

  // Subjects not assigned to any class
  const unassignedSubs = subjectsList.filter(s => !renderedSubjectIds.has(String(s._id)));
  if (unassignedSubs.length > 0) {
    html += `
      <div class="space-y-2.5 pt-1 pb-1">
        <div class="flex items-center justify-between pt-2 pb-1 select-none">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-slate-600 via-slate-700 to-slate-800 text-white shadow-sm border border-slate-500/40">
            <svg class="w-3.5 h-3.5 text-white/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span class="text-xs font-black tracking-wider uppercase">GENERAL / UNASSIGNED</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-xl bg-white/20 text-white font-black text-[11px] shadow-2xs">
              TOTAL: ${unassignedSubs.length}
            </span>
          </div>
          <div class="h-[2px] flex-1 bg-gradient-to-r from-slate-400/30 via-slate-400/15 to-transparent rounded-full ml-3"></div>
        </div>
        <div class="space-y-2.5">
          ${unassignedSubs.map(s => {
            const globalIndex = subjectsList.findIndex(item => String(item._id) === String(s._id));
            return _generateSubjectCardHtml(s, globalIndex >= 0 ? globalIndex : 0, 'unassigned');
          }).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html || `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No subjects found.</div>`;
}



async function openSubjectModal() {
  document.getElementById('input-sub-name').value = '';
  document.getElementById('input-sub-code').value = '';
  await populateTeacherDropdowns('input-sub-teacher', '');
  const dl = document.getElementById('sub-names-datalist');
  if (dl) {
    const uniqueNames = Array.from(new Set((subjectsList || []).map(s => s.name).filter(Boolean)));
    dl.innerHTML = uniqueNames.map(n => `<option value="${escapeHtml(n)}">`).join('');
  }
  // Populate class dropdown — public (main) classes only, one class per entry
  const _addSubSel = document.getElementById('add-sub-class-select');
  if (_addSubSel) {
    _addSubSel.innerHTML = '<option value="">— No class (optional) —</option>'
      + (classesList || []).filter(function(c) { return !c.isPrivate; })
          .map(function(c) { return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>'; }).join('');
  }
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
  const selOpt = teacherEl && teacherEl.selectedIndex >= 0 ? teacherEl.options[teacherEl.selectedIndex] : null;
  const teacherEmail = selOpt ? (selOpt.getAttribute('data-email') || '') : '';
  const _cls = document.getElementById('add-sub-class-select') ? document.getElementById('add-sub-class-select').value : '';

  const assignedClasses = _cls ? [_cls] : [];

  try {
    const res = await API.addSubject({ name, subjectCode, teacher, teacherEmail, assignedClasses });
    if (res.success) {
      showToast(`Subject "${name}" added!`);
      closeSubjectModal();
      // Reload both — class.assignedSubjects is updated on the backend
      await Promise.all([loadSubjects(), loadClasses()]);
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

let activeEditSubjectId = null;
let activeEditSubjectName = null; // track original name so backend can find all siblings
async function openEditSubjectModal(id, name, code, teacher) {
  activeEditSubjectId = id;
  activeEditSubjectName = name; // store original name
  document.getElementById('edit-sub-name').value = name;
  document.getElementById('edit-sub-code').value = code || '';
  await populateTeacherDropdowns('edit-sub-teacher', teacher || '');

  // Find this exact subject doc and pre-select its single assigned class
  const _editSubDoc = (subjectsList || []).find(function(s) { return String(s._id) === String(id); });
  const _editCurClass = (_editSubDoc && _editSubDoc.assignedClasses && _editSubDoc.assignedClasses[0]) || '';
  const _editSubSel = document.getElementById('edit-sub-class-select');
  if (_editSubSel) {
    _editSubSel.innerHTML = '<option value="">— No class —</option>'
      + (classesList || []).filter(function(c) { return !c.isPrivate; })
          .map(function(c) { return '<option value="' + escapeHtml(c.name) + '"' + (c.name === _editCurClass ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>'; }).join('');
  }

  document.getElementById('modal-edit-subject').classList.remove('hidden');
}

function closeEditSubjectModal() {
  document.getElementById('modal-edit-subject').classList.add('hidden');
  activeEditSubjectId = null;
  activeEditSubjectName = null;
}

async function handleUpdateSubject(e) {
  e.preventDefault();
  if (!activeEditSubjectId) return;

  const name = document.getElementById('edit-sub-name').value.trim();
  const subjectCode = document.getElementById('edit-sub-code').value.trim();
  const teacherEl = document.getElementById('edit-sub-teacher');
  const teacher = teacherEl ? teacherEl.value.trim() : '';
  const selOpt = teacherEl && teacherEl.selectedIndex >= 0 ? teacherEl.options[teacherEl.selectedIndex] : null;
  const teacherEmail = selOpt ? (selOpt.getAttribute('data-email') || '') : '';
  const _editCls = document.getElementById('edit-sub-class-select') ? document.getElementById('edit-sub-class-select').value : '';

  const assignedClasses = _editCls ? [_editCls] : [];

  try {
    const res = await API.updateSubject(activeEditSubjectId, { name, subjectCode, teacher, teacherEmail, assignedClasses });
    if (res.success) {
      showToast(`Subject "${name}" updated!`);
      closeEditSubjectModal();
      // Reload both subjects AND classes — class.assignedSubjects may have changed
      await Promise.all([loadSubjects(), loadClasses()]);
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteSubject(id, name) {
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Delete Subject',
        badge: 'Subject Management',
        message: `Delete subject "${name}"?`,
        isDanger: true
      })
    : confirm(`Delete subject "${name}"?`);
  if (!confirmed) return;
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

  const isMl = (typeof getAppLanguage === 'function' ? getAppLanguage() : (localStorage.getItem('app_language') || 'en')) === 'ml';
  const title = isMl ? 'ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക' : 'Select Class & Subject';
  const desc = isMl ? 'വിദ്യാർത്ഥികളുടെ പട്ടിക ലഭ്യമാക്കാനും ഹാജർ രേഖപ്പെടുത്താനും മുകളിലുള്ള ഫിൽട്ടറുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക.' : 'Choose a class and subject from the filters above to load the student roster and take attendance.';
  const badge = isMl ? 'മുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക' : 'Choose class & subject above';

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 px-6 bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] text-center shadow-xs my-1 relative overflow-hidden transition-all duration-300">
      <!-- Standard Crisp Clipboard-Check Badge with Ambient Ring -->
      <div class="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#245b70]/10 dark:bg-cyan-500/10 border border-[#245b70]/20 dark:border-cyan-400/20 ring-8 ring-[#245b70]/5 dark:ring-cyan-500/5 shadow-inner mb-4 transition-transform hover:scale-105 duration-300">
        <svg class="w-8 h-8 sm:w-9 sm:h-9 text-[#245b70] dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          <path d="m9 14 2 2 4-4"></path>
        </svg>
      </div>
      <h3 class="text-base sm:text-lg font-black text-[var(--text-main)] tracking-tight mb-1.5" data-i18n="placeholder_select_class_subject">${title}</h3>
      <p class="text-xs sm:text-sm text-[var(--text-sub)] font-medium max-w-xs leading-relaxed mx-auto" data-i18n="placeholder_att_desc">
        ${desc}
      </p>
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[11px] font-bold text-[var(--text-sub)] mt-4 select-none">
        <span class="w-1.5 h-1.5 rounded-full bg-[#245b70] dark:bg-cyan-400 animate-pulse"></span>
        <span data-i18n="placeholder_choose_badge">${badge}</span>
      </div>
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

  const isMl = (typeof getAppLanguage === 'function' ? getAppLanguage() : (localStorage.getItem('app_language') || 'en')) === 'ml';
  const title = isMl ? 'ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക' : 'Select Class & Subject';
  const desc = isMl ? 'സമ്പൂർണ്ണ ഹാജർ വിശകലനങ്ങളും ഷീറ്റുകളും തയ്യാറാക്കാൻ മുകളിലുള്ള ഫിൽട്ടറുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക.' : 'Choose a class and subject from the filters above to generate full attendance analytics and sheets.';
  const badge = isMl ? 'മുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക' : 'Choose class & subject above';

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 px-6 bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] text-center shadow-xs my-1 relative overflow-hidden transition-all duration-300">
      <!-- Standard Crisp Analytics / Bar-Chart Badge with Ambient Ring -->
      <div class="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#245b70]/10 dark:bg-cyan-500/10 border border-[#245b70]/20 dark:border-cyan-400/20 ring-8 ring-[#245b70]/5 dark:ring-cyan-500/5 shadow-inner mb-4 transition-transform hover:scale-105 duration-300">
        <svg class="w-8 h-8 sm:w-9 sm:h-9 text-[#245b70] dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
          <path d="M3 20h18"></path>
        </svg>
      </div>
      <h3 class="text-base sm:text-lg font-black text-[var(--text-main)] tracking-tight mb-1.5" data-i18n="placeholder_select_class_subject">${title}</h3>
      <p class="text-xs sm:text-sm text-[var(--text-sub)] font-medium max-w-xs leading-relaxed mx-auto" data-i18n="placeholder_rep_desc">
        ${desc}
      </p>
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[11px] font-bold text-[var(--text-sub)] mt-4 select-none">
        <span class="w-1.5 h-1.5 rounded-full bg-[#245b70] dark:bg-cyan-400 animate-pulse"></span>
        <span data-i18n="placeholder_choose_badge">${badge}</span>
      </div>
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
    const record = attendanceRecords.find(r => String(r.studentId) === String(st.studentId)) || { status: 'P', note: '' };
    const isP = record.status === 'P';
    const isA = record.status === 'A';
    const isL = record.status === 'L';

    return `
      <div class="bg-[var(--card-bg)] p-3 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center justify-between gap-2.5 transition-all">
        <!-- Student Info: Photo & Name ONLY (No ID and No Roll) - Click Photo to View Details -->
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative flex-shrink-0 cursor-pointer group" onclick="openStudentDetailsModal('${escapeQuotes(String(st.studentId))}')" title="Click to view student details">
            <img src="${isCustomPhoto(st.photoUrl) ? st.photoUrl : getInitialsAvatar(st.name, '245b70')}" alt="${escapeHtml(st.name)}" class="w-11 h-11 rounded-2xl object-cover border border-[#245b70] group-hover:scale-105 transition shadow-sm">
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
          <button onclick="setStudentStatus('${escapeQuotes(String(st.studentId))}', 'P')" class="w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center transition-all ${
            isP ? 'bg-emerald-600 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700'
          }">P</button>
          
          <button onclick="setStudentStatus('${escapeQuotes(String(st.studentId))}', 'A')" class="w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center transition-all ${
            isA ? 'bg-rose-600 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-50 hover:text-rose-700'
          }">A</button>

          <button onclick="setStudentStatus('${escapeQuotes(String(st.studentId))}', 'L')" title="Mark Leave" class="w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center transition-all ${
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
  let record = attendanceRecords.find(r => String(r.studentId) === String(studentId));
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
      updateProfileDashboardKPIs();
      await loadActivityLogs();
      await loadReport();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteCurrentAttendance() {
  const promptMsg = `Are you sure you want to delete the recorded attendance for ${currentClass} on ${currentDateStr}${currentSubject ? ' (' + currentSubject + ')' : ''}?`;
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Delete Attendance Session',
        badge: 'Attendance',
        message: promptMsg,
        confirmText: 'Delete Record',
        isDanger: true
      })
    : confirm(promptMsg);
  if (!confirmed) {
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
      updateProfileDashboardKPIs();
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
          <img src="${isCustomPhoto(row.photoUrl) ? row.photoUrl : getInitialsAvatar(row.name, '245b70')}" class="w-7 h-7 rounded-lg object-cover border border-[#245b70] shadow-sm">
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

async function printReport() {
  const printable = document.getElementById('printable-report');
  if (!printable || printable.classList.contains('hidden')) {
    showToast('Please select a class and subject to load a report first.', true);
    return;
  }

  const repClass = document.getElementById('report-class')?.value || (currentClass || 'all');
  const repYear = document.getElementById('report-year')?.value || 'all';
  const repPeriod = document.getElementById('report-period')?.value || 'all-year';
  const repSubject = document.getElementById('report-subject')?.value || 'whole';

  await generateAndPrintAttendanceSheet({
    classVal: repClass,
    subjectVal: repSubject,
    yearVal: repYear,
    monthVal: repPeriod
  });
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
    // When a class is selected, undisplay Total and show CLASS : COUNT (e.g. PLUS ONE : 6)
    const totalCountContainerEl = document.getElementById('students-count-total-container');
    const totalCountEl = document.getElementById('students-count-total');
    const classCountEl = document.getElementById('students-count-class');
    const classNameEl = document.getElementById('students-count-class-name');
    const classContainerEl = document.getElementById('students-count-class-container');

    if (totalCountEl) totalCountEl.innerText = allStudents.length;

    if (filterClass === 'all') {
      if (totalCountContainerEl) {
        totalCountContainerEl.classList.remove('hidden');
        totalCountContainerEl.classList.add('inline-flex');
      }
      if (classContainerEl) {
        classContainerEl.classList.add('hidden');
        classContainerEl.classList.remove('inline-flex', 'flex');
      }
    } else {
      if (totalCountContainerEl) {
        totalCountContainerEl.classList.add('hidden');
        totalCountContainerEl.classList.remove('inline-flex', 'flex');
      }
      if (classContainerEl) {
        classContainerEl.classList.remove('hidden');
        classContainerEl.classList.add('inline-flex');
      }
      if (classNameEl) classNameEl.innerText = String(filterClass).toUpperCase();
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

    // Sort order handling
    const sortSelect = document.getElementById('student-sort-order');
    const savedSort = localStorage.getItem('student_sort_order') || 'roll-asc';
    if (sortSelect) {
      if (!sortSelect.dataset.initialized) {
        sortSelect.value = savedSort;
        sortSelect.dataset.initialized = 'true';
      }
      localStorage.setItem('student_sort_order', sortSelect.value);
    }
    const currentSort = sortSelect ? sortSelect.value : savedSort;

    const sortStudentsList = (list) => {
      return [...list].sort((a, b) => {
        switch (currentSort) {
          case 'roll-desc':
            return (Number(b.roll) || 0) - (Number(a.roll) || 0);
          case 'name-asc':
            return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
          case 'name-desc':
            return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
          case 'id-asc':
            return (Number(a.studentId) || 0) - (Number(b.studentId) || 0);
          case 'id-desc':
            return (Number(b.studentId) || 0) - (Number(a.studentId) || 0);
          case 'roll-asc':
          default:
            return (Number(a.roll) || 0) - (Number(b.roll) || 0);
        }
      });
    };

    if (!container) return;

    if (students.length === 0) {
      container.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No students found.</div>`;
      return;
    }

    const renderStudentCardItem = (st) => `
      <div id="student-card-${st.studentId}" class="bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border-color)] shadow-sm space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5 min-w-0 select-none">
            <img src="${isCustomPhoto(st.photoUrl) ? st.photoUrl : getInitialsAvatar(st.name, '245b70')}" alt="${escapeHtml(st.name)}" class="w-11 h-11 rounded-2xl object-cover border border-[#245b70] flex-shrink-0 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition" onclick="openStudentDetailsModal('${escapeQuotes(String(st.studentId))}')" title="Click to view full student details">
            <div class="truncate">
              <div class="flex items-center gap-1.5">
                <span class="font-extrabold text-[var(--text-main)] text-sm truncate">${st.isPrivate ? '<svg style="display:inline;width:11px;height:11px;color:#db2777;vertical-align:middle;margin-right:3px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : ''}${st.name}</span>
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
    `;

    // USER DIRECTIVE:
    // Categorize students with class when filter is 'all classes'.
    // Class name with bold theme font: "PLUS ONE : 13", followed by student cards.
    // Order strictly follows the order of classes in Add Class tab (classesList).
    // If a specific class is selected, show without category headers.
    if (filterClass === 'all') {
      const groupsHtml = [];
      const accountedFor = new Set();

      classesList.forEach(cls => {
        const clsName = cls.name || cls;
        let clsStudents = students.filter(s => isClassEqual(s.class, clsName));
        clsStudents = sortStudentsList(clsStudents);
        if (clsStudents.length > 0) {
          clsStudents.forEach(s => accountedFor.add(String(s._id || s.studentId)));
          groupsHtml.push(`
            <div class="class-student-group space-y-2.5">
              <div class="flex items-center justify-between pt-3 pb-1 select-none">
                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-[#245b70] via-[#2a6880] to-[#1e4e60] text-white shadow-sm border border-[#245b70]/40">
                  <svg class="w-3.5 h-3.5 text-white/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                  <span class="text-xs font-black tracking-wider uppercase">${escapeHtml(clsName)}</span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-xl bg-white/20 text-white font-black text-[11px] shadow-2xs">
                    TOTAL: ${clsStudents.length}
                  </span>
                </div>
                <div class="h-[2px] flex-1 bg-gradient-to-r from-[#245b70]/30 via-[#245b70]/15 to-transparent rounded-full ml-3"></div>
              </div>
              <div class="space-y-2">
                ${clsStudents.map(st => renderStudentCardItem(st)).join('')}
              </div>
            </div>
          `);
        }
      });

      // Any students whose class is not in classesList
      let remainingStudents = students.filter(s => !accountedFor.has(String(s._id || s.studentId)));
      remainingStudents = sortStudentsList(remainingStudents);
      if (remainingStudents.length > 0) {
        groupsHtml.push(`
          <div class="class-student-group space-y-2.5">
            <div class="flex items-center justify-between pt-3 pb-1 select-none">
              <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-slate-600 via-slate-700 to-slate-800 text-white shadow-sm border border-slate-500/40">
                <svg class="w-3.5 h-3.5 text-white/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span class="text-xs font-black tracking-wider uppercase">OTHER / UNASSIGNED</span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-xl bg-white/20 text-white font-black text-[11px] shadow-2xs">
                  TOTAL: ${remainingStudents.length}
                </span>
              </div>
              <div class="h-[2px] flex-1 bg-gradient-to-r from-slate-400/30 via-slate-400/15 to-transparent rounded-full ml-3"></div>
            </div>
            <div class="space-y-2">
              ${remainingStudents.map(st => renderStudentCardItem(st)).join('')}
            </div>
          </div>
        `);
      }

      container.innerHTML = groupsHtml.length > 0 ? groupsHtml.join('') : students.map(st => renderStudentCardItem(st)).join('');
    } else {
      students = sortStudentsList(students);
      container.innerHTML = students.map(st => renderStudentCardItem(st)).join('');
    }
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

// ================= ONE CENTRALIZED USER PROFILE EDITING SYSTEM =================
// ================= ONE CENTRALIZED EDIT PROFILE PAGE =================
let activeEditProfileUserId = null;
let editProfileCurrentAvatarUrl = '';
let editProfileInitialState = {
  name: '',
  email: '',
  phone: '',
  avatarUrl: '',
  subjects: []
};

async function openProfileEditPage(targetUserId = null) {
  if (!currentUser) {
    showToast('Please sign in first', true);
    openAuthModal();
    return;
  }

  // Switch to Edit Profile page immediately
  selectTab('edit-profile');
  const mainViewport = document.querySelector('main');
  if (mainViewport) mainViewport.scrollTop = 0;

  // Ensure subjects list is loaded for checkboxes
  if (!subjectsList || subjectsList.length === 0) {
    try {
      const sRes = await API.getSubjects();
      if (sRes.success && sRes.data) subjectsList = sRes.data;
    } catch (_) {}
  }

  const titleEl = document.getElementById('edit-profile-page-title');
  const subtitleEl = document.getElementById('edit-profile-page-subtitle');
  const preview = document.getElementById('edit-profile-avatar-preview');
  const nameInput = document.getElementById('edit-profile-name');
  const emailInput = document.getElementById('edit-profile-email');
  const emailBadge = document.getElementById('edit-profile-email-badge');
  const phoneInput = document.getElementById('edit-profile-phone');
  const errorEl = document.getElementById('edit-profile-photo-error');

  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  const isEditingOtherTeacher = Boolean(targetUserId && targetUserId !== (currentUser._id || currentUser.id));

  if (isEditingOtherTeacher) {
    activeEditProfileUserId = targetUserId;
    let teacher = (cachedTeachersList || []).find(t => t._id === targetUserId);
    if (!teacher) {
      try {
        const res = await API.getTeachers();
        if (res.success && res.data) {
          cachedTeachersList = res.data;
          teacher = cachedTeachersList.find(t => t._id === targetUserId);
        }
      } catch (_) {}
    }

    if (!teacher) {
      showToast('Teacher not found', true);
      return;
    }

    if (titleEl) titleEl.textContent = `Edit Teacher: ${teacher.name}`;
    if (subtitleEl) subtitleEl.textContent = 'Update profile, contact & assigned subjects';

    editProfileCurrentAvatarUrl = isCustomPhoto(teacher.avatarUrl) ? teacher.avatarUrl : '';
    if (preview) {
      preview.src = isCustomPhoto(teacher.avatarUrl) ? teacher.avatarUrl : getEmailAvatarPreview(teacher.email, teacher.name);
    }

    if (nameInput) nameInput.value = teacher.name || '';
    if (emailInput) {
      emailInput.value = teacher.email || '';
      emailInput.readOnly = false;
      emailInput.className = "touch-input w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#245b70] focus:border-transparent transition";
    }
    if (emailBadge) {
      emailBadge.textContent = 'Admin Editable';
      emailBadge.className = 'text-[10px] font-bold text-amber-600 dark:text-amber-400';
    }
    if (phoneInput) phoneInput.value = teacher.phone || '';

    renderProfileAssignments(teacher.name, teacher.email);
    const ctSelTeacher = document.getElementById('edit-profile-class-teacher');
    if (ctSelTeacher) {
      ctSelTeacher.innerHTML = '<option value="">— Not a Class Teacher —</option>' +
        (classesList || []).map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
      ctSelTeacher.value = teacher.classTeacherOf || (classesList.find(c => isClassEqual(c.classTeacher, teacher.name))?.name) || '';
    }

    editProfileInitialState = {
      name: (teacher.name || '').trim(),
      email: (teacher.email || '').trim(),
      phone: (teacher.phone || '').trim(),
      avatarUrl: teacher.avatarUrl || '',
      subjects: [...(teacher.assignedSubjects || [])]
    };
  } else {
    // Editing own profile
    activeEditProfileUserId = null;

    if (titleEl) titleEl.textContent = 'Edit Profile';
    if (subtitleEl) subtitleEl.textContent = 'Manage personal details & assigned subjects';

    editProfileCurrentAvatarUrl = currentUser.avatarUrl || '';
    if (preview) {
      preview.src = currentUser.avatarUrl || '/icons/logo.png';
    }

    if (nameInput) nameInput.value = currentUser.name || '';
    if (emailInput) {
      emailInput.value = currentUser.email || '';
      const isAdmin = currentUser.role === 'admin';
      emailInput.readOnly = !isAdmin;
      if (isAdmin) {
        emailInput.className = "touch-input w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[#245b70] focus:border-transparent transition";
        if (emailBadge) {
          emailBadge.textContent = 'Admin Editable';
          emailBadge.className = 'text-[10px] font-bold text-amber-600 dark:text-amber-400';
        }
      } else {
        emailInput.className = "w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-page)]/60 border border-[var(--border-color)] text-xs font-medium text-[var(--text-sub)] cursor-not-allowed select-none";
        if (emailBadge) {
          emailBadge.textContent = 'Read-only';
          emailBadge.className = 'text-[10px] font-bold text-slate-400';
        }
      }
    }
    if (phoneInput) phoneInput.value = currentUser.phone || '';

    renderProfileAssignments(currentUser.name, currentUser.email);
    const ctSelUser = document.getElementById('edit-profile-class-teacher');
    if (ctSelUser) {
      ctSelUser.innerHTML = '<option value="">— Not a Class Teacher —</option>' +
        (classesList || []).map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
      ctSelUser.value = currentUser.classTeacherOf || (classesList.find(c => isClassEqual(c.classTeacher, currentUser.name))?.name) || '';
    }

    editProfileInitialState = {
      name: (currentUser.name || '').trim(),
      email: (currentUser.email || '').trim(),
      phone: (currentUser.phone || '').trim(),
      avatarUrl: currentUser.avatarUrl || '',
      subjects: [...(currentUser.assignedSubjects || [])]
    };
  }

}

// Aliases for backward compatibility
function openProfileEditModal(targetUserId = null) {
  openProfileEditPage(targetUserId);
}
function openEditTeacherModal(targetUserId) {
  openProfileEditPage(targetUserId);
}

function onProfileImageFileSelectedDirect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const errorEl = document.getElementById('edit-profile-photo-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  // Validate File Type: JPG, JPEG, PNG, WebP
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = file.name.split('.').pop().toLowerCase();
  const validExts = ['jpg', 'jpeg', 'png', 'webp'];
  if (!validTypes.includes(file.type.toLowerCase()) && !validExts.includes(ext)) {
    if (errorEl) {
      errorEl.textContent = 'Invalid format. Please upload JPG, PNG, or WebP.';
      errorEl.classList.remove('hidden');
    }
    showToast('Invalid format. Please upload JPG, PNG, or WebP.', true);
    event.target.value = '';
    return;
  }

  // Validate File Size: Max 5MB
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    if (errorEl) {
      errorEl.textContent = 'Image is too large. Maximum file size is 5MB.';
      errorEl.classList.remove('hidden');
    }
    showToast('File too large. Max 5MB allowed.', true);
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    editProfileCurrentAvatarUrl = dataUrl;
    const preview = document.getElementById('edit-profile-avatar-preview');
    if (preview) preview.src = dataUrl;
    showToast('Photo selected! Save Changes to apply.');
  };
  reader.onerror = function() {
    showToast('Error reading image file', true);
  };
  reader.readAsDataURL(file);
}

// Unsaved changes detection
function hasUnsavedProfileChanges() {
  const curName = (document.getElementById('edit-profile-name')?.value || '').trim();
  const curEmail = (document.getElementById('edit-profile-email')?.value || '').trim();
  const curPhone = (document.getElementById('edit-profile-phone')?.value || '').trim();
  const curAvatar = editProfileCurrentAvatarUrl || '';
  return (curName !== editProfileInitialState.name) ||
         (curEmail !== editProfileInitialState.email) ||
         (curPhone !== editProfileInitialState.phone) ||
         (curAvatar !== editProfileInitialState.avatarUrl);
}

function handleCloseProfilePageWithCheck() {
  const fallback = activeEditProfileUserId ? 'teachers' : 'settings';
  goBackFromSubPage(fallback);
}

function handleCloseProfileModalWithCheck() {
  handleCloseProfilePageWithCheck();
}
function closeProfileEditModal() {
  handleCloseProfilePageWithCheck();
}

async function handleSaveProfile(event) {
  if (event) event.preventDefault();

  const nameInput = document.getElementById('edit-profile-name');
  const name = nameInput ? nameInput.value.trim() : '';

  if (!name) {
    showToast('Please enter full name', true);
    if (nameInput) nameInput.focus();
    return;
  }

  const emailInput = document.getElementById('edit-profile-email');
  const email = emailInput ? emailInput.value.trim() : '';

  const phoneInput = document.getElementById('edit-profile-phone');
  const phone = phoneInput ? phoneInput.value.trim() : '';

  
  const saveBtn = document.getElementById('btn-save-profile');
  const spinner = document.getElementById('btn-save-profile-spinner');
  const btnText = document.getElementById('btn-save-profile-text');

  if (saveBtn) saveBtn.disabled = true;
  if (spinner) spinner.classList.remove('hidden');
  if (btnText) btnText.textContent = 'Saving...';

  try {
    if (activeEditProfileUserId) {
      // Admin editing a teacher
      const classTeacherOf = document.getElementById('edit-profile-class-teacher')?.value || '';
      const res = await API.editTeacher(activeEditProfileUserId, {
        name,
        email,
        phone,
        classTeacherOf,
        avatarUrl: editProfileCurrentAvatarUrl
      });

      if (res && res.success) {
        showToast(res.message || `Teacher "${name}" updated!`);
        try {
          await Promise.all([loadClasses(), loadTeachersData(), loadSubjects()]);
        } catch (_) {}
        await renderTeachersList();
        selectTab('teachers');
      } else {
        throw new Error((res && res.message) || 'Failed to update teacher');
      }
    } else {
      // User editing own profile
      const classTeacherOf = document.getElementById('edit-profile-class-teacher')?.value || '';
      const res = await API.updateProfile({
        name,
        email,
        phone,
        classTeacherOf,
        avatarUrl: editProfileCurrentAvatarUrl
      });

      if (res && res.success && res.user) {
        currentUser.name = res.user.name;
        if (res.user.email) currentUser.email = res.user.email;
        currentUser.phone = res.user.phone || '';
        currentUser.avatarUrl = res.user.avatarUrl || '';
        currentUser.assignedSubjects = res.user.assignedSubjects || [];
        localStorage.setItem('user', JSON.stringify(currentUser));

        updateUserUI();
        updateHeaderAvatar();
        updateWelcomeGreeting();

        editProfileInitialState = {
          name: (currentUser.name || '').trim(),
          email: (currentUser.email || '').trim(),
          phone: (currentUser.phone || '').trim(),
          avatarUrl: currentUser.avatarUrl || '',
          subjects: [...(currentUser.assignedSubjects || [])]
        };

        showToast('Profile updated successfully!');
        try {
          await Promise.all([loadClasses(), loadTeachersData(), loadSubjects()]);
        } catch (_) {}
        updateProfileDashboardKPIs();
        selectTab('settings');
      } else {
        throw new Error((res && res.message) || 'Failed to update profile');
      }
    }
  } catch (error) {
    console.error('[Profile Save Error]', error);
    showToast(error.message || 'Failed to save changes', true);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Save Changes';
  }
}

// Quick Tools: Open personal attendance & session logs in teacher log modal
function openCurrentUserLogs() {
  if (!currentUser) {
    showToast('Please sign in first', true);
    openAuthModal();
    return;
  }
  const teacherId = currentUser._id || currentUser.id;
  if (!teacherId) {
    showToast('Profile ID not found', true);
    return;
  }
  openTeacherLogModal(teacherId);
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

async function deleteCurrentCustomField() {
  if (activeEditingFieldIdx === null || !appStudentFormFields[activeEditingFieldIdx]) return;
  const name = appStudentFormFields[activeEditingFieldIdx].label;
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Delete Custom Field',
        badge: 'Form Builder',
        message: `Delete custom field "${name}"?`,
        isDanger: true
      })
    : confirm(`Delete custom field "${name}"?`);
  if (confirmed) {
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

async function promptAddCustomStudentField() {
  const label = typeof showCustomPrompt === 'function'
    ? await showCustomPrompt({
        title: 'Add Custom Field',
        badge: 'Form Builder',
        message: 'Enter label for new custom field (e.g. Blood Group, Bus Stop, DOB):',
        placeholder: 'e.g. Bus Stop, Blood Group'
      })
    : prompt('Enter label for new custom field (e.g. Blood Group, Bus Stop, DOB):');
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

async function deleteAdminStudentCustomField(index) {
  if (!appStudentFormFields[index]) return;
  const name = appStudentFormFields[index].label;
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Delete Custom Field',
        badge: 'Form Builder',
        message: `Delete custom field "${name}"?`,
        isDanger: true
      })
    : confirm(`Delete custom field "${name}"?`);
  if (confirmed) {
    appStudentFormFields.splice(index, 1);
    renderDynamicStudentInputs('new');
    triggerNavHaptic('strong');
  }
}

async function resetAdminStudentFieldsConfig() {
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Reset Form Layout',
        badge: 'Form Builder',
        message: 'Reset student form inputs and layout to default?',
        isDanger: true
      })
    : confirm('Reset student form inputs and layout to default?');
  if (confirmed) {
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

// Live student name typing avatar preview
function handleStudentNameInput(type) {
  const nameInput = document.getElementById(`${type}-student-name`);
  const preview = document.getElementById(`${type}-preview-photo`);
  if (!nameInput || !preview) return;

  if (type === 'new' && (newStudentPhotoUrl || newStudentBase64Photo)) return;
  if (type === 'edit' && editStudentPhotoUrl) return;

  const nameVal = nameInput.value.trim();
  preview.src = getInitialsAvatar(nameVal, '245b70');
}

// Auto-suggest next roll number in ascending order for chosen class
function handleNewStudentClassChanged() {
  const classSelect = document.getElementById('new-student-class');
  const rollInput = document.getElementById('new-student-roll');
  if (!classSelect) return;
  const selClass = classSelect.value || '';
  updateDynamicClassFields('new', selClass);
  if (!rollInput || !selClass) return;

  const inClass = (cachedAllStudents || []).filter(s => isClassEqual(s.class, selClass));
  const maxRoll = inClass.reduce((max, s) => {
    const r = parseInt(s.roll, 10);
    return (!isNaN(r) && r > max) ? r : max;
  }, 0);
  rollInput.value = maxRoll > 0 ? (maxRoll + 1) : 1;
}

function handleEditStudentClassChanged() {
  const classSelect = document.getElementById('edit-student-class');
  if (!classSelect) return;
  const selClass = classSelect.value || '';
  updateDynamicClassFields('edit', selClass);
}

// ================= STUDENT MODAL HELPERS (AGE, GUARDIAN, VALIDATION, DISCARD, REMARKS) =================
let studentModalInitialSnapshot = { new: '', edit: '' };

function calculateAgeFromDob(dobStr) {
  if (!dobStr) return '';
  const b = new Date(dobStr);
  if (isNaN(b.getTime())) return '';
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) {
    a--;
  }
  return a >= 0 ? `${a} years` : '';
}

function handleStudentDobChange(prefix) {
  const dobEl = document.getElementById(`${prefix}-student-dob`);
  const ageEl = document.getElementById(`${prefix}-student-age`);
  if (!dobEl || !ageEl) return;
  ageEl.value = calculateAgeFromDob(dobEl.value);
}

function handleGuardianChange(prefix) {
  const sel = document.getElementById(`${prefix}-student-guardian`);
  const box = document.getElementById(`${prefix}-guardian-other-box`);
  if (!sel || !box) return;
  if (sel.value === 'Other') {
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }
}

function getSelectedStudentGender(prefix) {
  const checked = document.querySelector(`input[name="${prefix}-student-gender"]:checked`);
  return checked ? checked.value : '';
}

function setSelectedStudentGender(prefix, val) {
  const radios = document.querySelectorAll(`input[name="${prefix}-student-gender"]`);
  radios.forEach(r => {
    r.checked = Boolean(val && r.value.toLowerCase() === String(val).toLowerCase());
  });
}

function clearFieldError(prefix, field) {
  const errEl = document.getElementById(`err-${prefix}-${field}`);
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }
}

function showFieldError(prefix, field, msg) {
  const errEl = document.getElementById(`err-${prefix}-${field}`);
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
}

function clearAllStudentModalErrors(prefix) {
  ['name', 'studentId', 'roll', 'class', 'studentEmail', 'pinCode', 'fatherMobile', 'motherNumber', 'guardianNumber'].forEach(f => {
    clearFieldError(prefix, f);
  });
}

function validateStudentModalForm(prefix) {
  clearAllStudentModalErrors(prefix);
  let isValid = true;

  const name = getStudentInputValue(prefix, 'name');
  const studentIdEl = document.getElementById(prefix === 'new' ? 'auto-student-id' : 'edit-student-id');
  const studentIdVal = studentIdEl ? studentIdEl.value.trim() : '';
  const roll = getStudentInputValue(prefix, 'roll');
  const studentClass = getStudentInputValue(prefix, 'class');

  if (!name) {
    showFieldError(prefix, 'name', 'Full Name is required');
    isValid = false;
  }
  if (!studentIdVal) {
    showFieldError(prefix, 'studentId', 'Student ID is required');
    isValid = false;
  }
  if (!roll || isNaN(Number(roll))) {
    showFieldError(prefix, 'roll', 'Valid Roll No. is required');
    isValid = false;
  }
  if (!studentClass) {
    showFieldError(prefix, 'class', 'Class is required');
    isValid = false;
  }

  // Optional fields: validate ONLY when filled
  const email = getStudentInputValue(prefix, 'studentEmail');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError(prefix, 'studentEmail', 'Enter a valid email address');
    isValid = false;
  }

  const pin = getStudentInputValue(prefix, 'pinCode');
  if (pin && !/^\d{6}$/.test(pin)) {
    showFieldError(prefix, 'pinCode', 'PIN Code must be 6 digits');
    isValid = false;
  }

  const mobile = getStudentInputValue(prefix, 'fatherMobile');
  if (mobile && !/^\d{10}$/.test(mobile)) {
    showFieldError(prefix, 'fatherMobile', 'Mobile must be 10 digits');
    isValid = false;
  }

  const motherNum = getStudentInputValue(prefix, 'motherNumber');
  if (motherNum && !/^\d{10}$/.test(motherNum)) {
    showFieldError(prefix, 'motherNumber', "Mother's number must be 10 digits");
    isValid = false;
  }

  const guardian = getStudentInputValue(prefix, 'guardian');
  const guardianNum = getStudentInputValue(prefix, 'guardianNumber');
  if (guardian === 'Other' && guardianNum && !/^\d{10}$/.test(guardianNum)) {
    showFieldError(prefix, 'guardianNumber', 'Guardian number must be 10 digits');
    isValid = false;
  }

  return isValid;
}

function getStudentFormStateSerialized(prefix) {
  const keys = [
    'name', 'class', 'roll', 'dob', 'bloodGroup', 'studentEmail',
    'address', 'place', 'district', 'state', 'pinCode',
    'fatherName', 'motherName', 'fatherMobile', 'motherNumber',
    'guardian', 'guardianName', 'guardianNumber', 'guardianRelation', 'guardianOccupation',
    'admissionNo', 'admissionDate', 'rank', 'previousCollege', 'initialRemark'
  ];
  const state = {};
  keys.forEach(k => {
    state[k] = getStudentInputValue(prefix, k);
  });
  state.gender = getSelectedStudentGender(prefix);
  state.photo = prefix === 'new' ? (newStudentPhotoUrl || newStudentBase64Photo || '') : (editStudentPhotoUrl || editStudentBase64Photo || '');
  return JSON.stringify(state);
}

function captureStudentFormSnapshot(prefix) {
  studentModalInitialSnapshot[prefix] = getStudentFormStateSerialized(prefix);
}

function isStudentFormDirty(prefix) {
  const current = getStudentFormStateSerialized(prefix);
  return Boolean(studentModalInitialSnapshot[prefix] && current !== studentModalInitialSnapshot[prefix]);
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
  if (preview) preview.src = getInitialsAvatar('', '245b70');

  clearAllStudentModalErrors('new');

  // Clear all inputs
  const clearIds = [
    'new-student-name', 'new-student-roll',
    'new-student-stream', 'new-student-degreeYear',
    'new-student-dob', 'new-student-age', 'new-student-bloodGroup', 'new-student-studentEmail',
    'new-student-address', 'new-student-place', 'new-student-district', 'new-student-state', 'new-student-pinCode',
    'new-student-fatherName', 'new-student-motherName', 'new-student-fatherMobile', 'new-student-motherNumber',
    'new-student-guardian', 'new-student-guardianName', 'new-student-guardianNumber', 'new-student-guardianRelation', 'new-student-guardianOccupation',
    'new-student-admissionNo', 'new-student-admissionDate', 'new-student-rank', 'new-student-previousCollege',
    'new-student-initialRemark'
  ];
  clearIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const warnEl = document.getElementById('warning-new-studentId');
  if (warnEl) warnEl.classList.add('hidden');

  // Pre-select Male in Add Student form only
  setSelectedStudentGender('new', 'Male');
  handleGuardianChange('new');

  const attEl = document.getElementById('new-student-attendancePercent');
  if (attEl) attEl.value = 'Auto from app report';

  // Populate classes dropdown
  const classSelect = document.getElementById('new-student-class');
  if (classSelect) {
    classSelect.innerHTML = (classesList || []).map(c => {
      const cName = c.name || c;
      return `<option value="${escapeHtml(cName)}">${escapeHtml(cName)}</option>`;
    }).join('');
  }

  await updateModalStudentCounts();
  handleNewStudentClassChanged();

  const autoIdEl = document.getElementById('auto-student-id');
  const isAdmin = currentUser && currentUser.role === 'admin';
  if (autoIdEl) {
    if (isAdmin) {
      autoIdEl.removeAttribute('readonly');
      autoIdEl.classList.remove('cursor-not-allowed', 'opacity-70');
      autoIdEl.classList.add('cursor-text');
      autoIdEl.title = 'Admin: Custom Student ID (Editable)';
    } else {
      autoIdEl.setAttribute('readonly', 'true');
      autoIdEl.classList.add('cursor-not-allowed');
      autoIdEl.classList.remove('cursor-text');
      autoIdEl.title = 'Auto-assigned by system';
    }
  }

  try {
    const res = await API.getNextStudentId();
    if (res.success && autoIdEl) {
      autoIdEl.value = res.nextId;
    }
  } catch (e) {
    if (autoIdEl) autoIdEl.value = 2000;
  }

  captureStudentFormSnapshot('new');
  document.getElementById('modal-add-student').classList.remove('hidden');
}

async function closeStudentModal(force = false) {
  if (!force && isStudentFormDirty('new')) {
    const confirmed = typeof showCustomConfirm === 'function'
      ? await showCustomConfirm({ title: 'Discard Changes?', badge: 'Students', message: 'You have unsaved changes. Discard changes?', isDanger: true })
      : confirm('Discard changes?');
    if (!confirmed) return;
  }
  document.getElementById('modal-add-student').classList.add('hidden');
  clearAllStudentModalErrors('new');
  newStudentPhotoUrl = '';
  newStudentBase64Photo = '';
}

async function handleSaveNewStudent(e) {
  e.preventDefault();
  if (!validateStudentModalForm('new')) {
    return;
  }

  if (checkDuplicateStudentId('new')) {
    showToast('Student ID is already assigned. Please choose a unique ID.', true);
    return;
  }

  const customStudentId = document.getElementById('auto-student-id')?.value.trim();
  const name = getStudentInputValue('new', 'name');
  const studentClass = getStudentInputValue('new', 'class') || (classesList[0]?.name || '');
  const roll = getStudentInputValue('new', 'roll');
  const stream = getStudentInputValue('new', 'stream');
  const degreeYear = getStudentInputValue('new', 'degreeYear');

  const dob = getStudentInputValue('new', 'dob');
  const gender = getSelectedStudentGender('new');
  const bloodGroup = getStudentInputValue('new', 'bloodGroup');
  const studentEmail = getStudentInputValue('new', 'studentEmail');

  const fullAddress = getStudentInputValue('new', 'address');
  const place = getStudentInputValue('new', 'place');
  const district = getStudentInputValue('new', 'district');
  const state = getStudentInputValue('new', 'state');
  const pinCode = getStudentInputValue('new', 'pinCode');

  const fatherName = getStudentInputValue('new', 'fatherName');
  const motherName = getStudentInputValue('new', 'motherName');
  const fatherMobile = getStudentInputValue('new', 'fatherMobile');
  const motherNumber = getStudentInputValue('new', 'motherNumber');
  const guardian = getStudentInputValue('new', 'guardian');
  const guardianName = guardian === 'Other' ? getStudentInputValue('new', 'guardianName') : '';
  const guardianNumber = guardian === 'Other' ? getStudentInputValue('new', 'guardianNumber') : '';
  const guardianRelation = guardian === 'Other' ? getStudentInputValue('new', 'guardianRelation') : '';
  const guardianOccupation = getStudentInputValue('new', 'guardianOccupation');

  const admissionNo = getStudentInputValue('new', 'admissionNo');
  const admissionDate = getStudentInputValue('new', 'admissionDate');
  const rank = getStudentInputValue('new', 'rank');
  const previousCollege = getStudentInputValue('new', 'previousCollege');
  const initialRemark = getStudentInputValue('new', 'initialRemark');
  const customFields = collectStudentCustomFields('new');

  const photoUrl = newStudentPhotoUrl || newStudentBase64Photo || DEFAULT_AVATAR;

  const payload = {
    name,
    class: studentClass,
    roll,
    studentId: customStudentId || undefined,
    stream,
    degreeYear,
    photoUrl,
    personalDetails: { dob, gender, bloodGroup, studentEmail },
    address: { fullAddress, place, district, state, pinCode },
    familyDetails: {
      fatherName,
      motherName,
      fatherMobile,
      motherNumber,
      guardian,
      guardianName,
      guardianNumber,
      guardianRelation,
      guardianOccupation
    },
    academicStatus: { admissionNo, admissionDate, rank, previousCollege, stream, degreeYear },
    initialRemark,
    customFields
  };

  try {
    const res = await API.addStudent(payload);
    if (res.success) {
      showToast(`Student "${name}" enrolled with ID ${res.data.studentId}!`);
      closeStudentModal(true);
      await renderStudentsDirectory();
      await loadAttendanceRoster();
      await loadReport();
    }
  } catch (error) {
    if (error.message && error.message.toLowerCase().includes('email')) {
      showFieldError('new', 'studentEmail', error.message);
    } else if (error.message && error.message.toLowerCase().includes('pin')) {
      showFieldError('new', 'pinCode', error.message);
    } else if (error.message && error.message.toLowerCase().includes('mobile')) {
      showFieldError('new', 'fatherMobile', error.message);
    }
    showToast(error.message, true);
  }
}

// USER DIRECTIVE: "when update student show the all inputs to edit"
let activeEditStudentObjId = null;
let activeEditStudentRecord = null;

function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = (val !== undefined && val !== null) ? val : '';
}

function handleEditProfileFromDetailsModal() {
  if (!currentDetailsStudent) return;
  const st = currentDetailsStudent;
  closeStudentDetailsModal();
  if (st.isPrivate && typeof pwEditStudent === 'function') {
    pwEditStudent(st._id);
  } else {
    openEditStudentModal(st._id || st.studentId);
  }
}

async function openEditStudentModal(id) {
  activeEditStudentObjId = id;
  clearAllStudentModalErrors('edit');
  try {
    let student = null;
    const targetStr = String(id);

    // 1. Check currently active student in details modal
    if (typeof currentDetailsStudent !== 'undefined' && currentDetailsStudent && (String(currentDetailsStudent._id) === targetStr || String(currentDetailsStudent.studentId) === targetStr)) {
      student = currentDetailsStudent;
    }
    // 2. Check in-memory arrays for fast instant load
    if (!student && Array.isArray(studentsList)) {
      student = studentsList.find(s => String(s._id) === targetStr || String(s.studentId) === targetStr);
    }
    if (!student && Array.isArray(cachedAllStudents)) {
      student = cachedAllStudents.find(s => String(s._id) === targetStr || String(s.studentId) === targetStr);
    }
    if (!student && typeof pwStudentsList !== 'undefined' && Array.isArray(pwStudentsList)) {
      student = pwStudentsList.find(s => String(s._id) === targetStr || String(s.studentId) === targetStr);
    }
    // 3. API lookup
    if (!student) {
      try {
        const singleRes = await API.getStudentById(id);
        if (singleRes && singleRes.success && singleRes.data) {
          student = singleRes.data;
        }
      } catch (_) {}
    }
    if (!student) {
      try {
        const res = await API.getStudents('all');
        student = (res.data || []).find(s => String(s._id) === targetStr || String(s.studentId) === targetStr);
      } catch (_) {}
    }
    if (!student) {
      showToast('Student information not found', true);
      return;
    }

    activeEditStudentObjId = student._id || id;
    activeEditStudentRecord = student;
    editStudentPhotoUrl = student.photoUrl || '';
    editStudentBase64Photo = student.photoUrl || '';
    document.getElementById('edit-student-modal-title').innerText = `Edit Student: ${student.name}`;
    document.getElementById('edit-student-id').value = student.studentId;
    document.getElementById('edit-preview-photo').src = isCustomPhoto(student.photoUrl) ? student.photoUrl : getInitialsAvatar(student.name, '245b70');

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

    const editIdInput = document.getElementById('edit-student-id');
    const isAdmin = currentUser && currentUser.role === 'admin';
    if (editIdInput) {
      if (isAdmin) {
        editIdInput.removeAttribute('readonly');
        editIdInput.classList.remove('cursor-not-allowed', 'opacity-70');
        editIdInput.classList.add('cursor-text');
        editIdInput.title = 'Admin: Custom Student ID (Editable)';
      } else {
        editIdInput.setAttribute('readonly', 'true');
        editIdInput.classList.add('cursor-not-allowed');
        editIdInput.classList.remove('cursor-text');
        editIdInput.title = 'Assigned ID';
      }
    }

    setVal('edit-student-name', student.name);
    setVal('edit-student-class', student.class);
    setVal('edit-student-roll', student.roll);
    setVal('edit-student-stream', student.academicStatus?.stream || student.stream || '');
    setVal('edit-student-degreeYear', student.academicStatus?.degreeYear || student.degreeYear || '');
    updateDynamicClassFields('edit', student.class);

    const warnEl = document.getElementById('warning-edit-studentId');
    if (warnEl) warnEl.classList.add('hidden');

    // Personal Details (never force Male on old records if missing)
    const dob = student.personalDetails?.dob || '';
    setVal('edit-student-dob', dob);
    setVal('edit-student-age', calculateAgeFromDob(dob));
    setSelectedStudentGender('edit', student.personalDetails?.gender || '');
    setVal('edit-student-bloodGroup', student.personalDetails?.bloodGroup || '');
    setVal('edit-student-studentEmail', student.personalDetails?.studentEmail || '');

    // Address Details
    setVal('edit-student-address', student.address?.fullAddress);
    setVal('edit-student-place', student.address?.place);
    setVal('edit-student-district', student.address?.district);
    setVal('edit-student-state', student.address?.state);
    setVal('edit-student-pinCode', student.address?.pinCode);

    // Family Details (motherNumber is separate from fatherWhatsapp)
    setVal('edit-student-fatherName', student.familyDetails?.fatherName);
    setVal('edit-student-motherName', student.familyDetails?.motherName);
    setVal('edit-student-fatherMobile', student.familyDetails?.fatherMobile);
    setVal('edit-student-motherNumber', student.familyDetails?.motherNumber);
    setVal('edit-student-guardian', student.familyDetails?.guardian || '');
    setVal('edit-student-guardianName', student.familyDetails?.guardianName);
    setVal('edit-student-guardianNumber', student.familyDetails?.guardianNumber);
    setVal('edit-student-guardianRelation', student.familyDetails?.guardianRelation);
    setVal('edit-student-guardianOccupation', student.familyDetails?.guardianOccupation);
    handleGuardianChange('edit');

    // Academic Status
    setVal('edit-student-admissionNo', student.academicStatus?.admissionNo);
    setVal('edit-student-admissionDate', student.academicStatus?.admissionDate);
    setVal('edit-student-rank', student.academicStatus?.rank);
    setVal('edit-student-previousCollege', student.academicStatus?.previousCollege);

    const attPct = student.attendancePercentage !== undefined && student.attendancePercentage !== null
      ? `${student.attendancePercentage}% (${student.attendancePresent || 0}/${student.attendanceSessions || 0} sessions)`
      : 'No sessions recorded yet';
    setVal('edit-student-attendancePercent', attPct);

    const newRemInput = document.getElementById('edit-student-new-remark');
    if (newRemInput) newRemInput.value = '';
    renderStudentRemarksList(student, 'edit-student-remarks-list');

    captureStudentFormSnapshot('edit');
    document.getElementById('modal-edit-student').classList.remove('hidden');
  } catch (error) {
    console.error('Error opening edit student modal:', error);
    showToast('Failed to load student details', true);
  }
}

async function closeEditStudentModal(force = false) {
  if (!force && isStudentFormDirty('edit')) {
    const confirmed = typeof showCustomConfirm === 'function'
      ? await showCustomConfirm({ title: 'Discard Changes?', badge: 'Students', message: 'You have unsaved changes. Discard changes?', isDanger: true })
      : confirm('Discard changes?');
    if (!confirmed) return;
  }
  document.getElementById('modal-edit-student').classList.add('hidden');
  clearAllStudentModalErrors('edit');
  activeEditStudentObjId = null;
  activeEditStudentRecord = null;
  editStudentPhotoUrl = '';
  editStudentBase64Photo = '';
}

async function handleSaveEditedStudent(e) {
  e.preventDefault();
  if (!activeEditStudentObjId) return;
  if (!validateStudentModalForm('edit')) {
    return;
  }

  if (checkDuplicateStudentId('edit')) {
    showToast('Student ID is already assigned. Please choose a unique ID.', true);
    return;
  }

  const customStudentId = document.getElementById('edit-student-id')?.value.trim();
  const name = getStudentInputValue('edit', 'name');
  const studentClass = getStudentInputValue('edit', 'class');
  const roll = getStudentInputValue('edit', 'roll');
  const stream = getStudentInputValue('edit', 'stream');
  const degreeYear = getStudentInputValue('edit', 'degreeYear');

  const dob = getStudentInputValue('edit', 'dob');
  const gender = getSelectedStudentGender('edit');
  const bloodGroup = getStudentInputValue('edit', 'bloodGroup');
  const studentEmail = getStudentInputValue('edit', 'studentEmail');

  const fullAddress = getStudentInputValue('edit', 'address');
  const place = getStudentInputValue('edit', 'place');
  const district = getStudentInputValue('edit', 'district');
  const state = getStudentInputValue('edit', 'state');
  const pinCode = getStudentInputValue('edit', 'pinCode');

  const fatherName = getStudentInputValue('edit', 'fatherName');
  const motherName = getStudentInputValue('edit', 'motherName');
  const fatherMobile = getStudentInputValue('edit', 'fatherMobile');
  const motherNumber = getStudentInputValue('edit', 'motherNumber');
  const guardian = getStudentInputValue('edit', 'guardian');
  const guardianName = guardian === 'Other' ? getStudentInputValue('edit', 'guardianName') : '';
  const guardianNumber = guardian === 'Other' ? getStudentInputValue('edit', 'guardianNumber') : '';
  const guardianRelation = guardian === 'Other' ? getStudentInputValue('edit', 'guardianRelation') : '';
  const guardianOccupation = getStudentInputValue('edit', 'guardianOccupation');

  const admissionNo = getStudentInputValue('edit', 'admissionNo');
  const admissionDate = getStudentInputValue('edit', 'admissionDate');
  const rank = getStudentInputValue('edit', 'rank');
  const previousCollege = getStudentInputValue('edit', 'previousCollege');
  const customFields = collectStudentCustomFields('edit');

  const payload = {
    name,
    class: studentClass,
    roll,
    studentId: customStudentId || undefined,
    stream,
    degreeYear,
    photoUrl: editStudentPhotoUrl || editStudentBase64Photo,
    personalDetails: { dob, gender, bloodGroup, studentEmail },
    address: { fullAddress, place, district, state, pinCode },
    familyDetails: {
      fatherName,
      motherName,
      fatherMobile,
      motherNumber,
      guardian,
      guardianName,
      guardianNumber,
      guardianRelation,
      guardianOccupation
    },
    academicStatus: {
      admissionNo,
      admissionDate,
      rank,
      previousCollege,
      stream,
      degreeYear
    },
    customFields
  };

  try {
    const res = await API.updateStudent(activeEditStudentObjId, payload);
    if (res.success) {
      showToast(`Student "${name}" details updated!`);
      closeEditStudentModal(true);
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
let currentDetailsStudent = null;
let activeEnlargedStudent = null;

// Utility to resolve full native camera-quality / original resolution image URL
function getHighClarityPhotoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let cleanUrl = url.trim();

  // 1. Cloudinary: strip any downscaling/transformations from URL path
  if (cleanUrl.includes('cloudinary.com') && cleanUrl.includes('/image/upload/')) {
    cleanUrl = cleanUrl.replace(/\/image\/upload\/(?:[a-zA-Z0-9_-]+:[a-zA-Z0-9_.-]+,?|[a-zA-Z0-9_-]+_[a-zA-Z0-9_.-]+,?)+\//i, '/image/upload/');
  }
  // 2. Unsplash: upgrade low resolution thumbnails to high resolution
  else if (cleanUrl.includes('images.unsplash.com')) {
    try {
      const u = new URL(cleanUrl);
      u.searchParams.set('w', '1600');
      u.searchParams.set('q', '95');
      u.searchParams.delete('crop');
      cleanUrl = u.toString();
    } catch (_) {}
  }

  return cleanUrl;
}

function formatRemarkDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderStudentRemarksList(student, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const remarks = Array.isArray(student?.remarks) ? [...student.remarks] : [];
  remarks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (remarks.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-[var(--text-sub)] italic py-1">No teacher remarks added yet.</p>`;
    return;
  }

  const isAdmin = currentUser && currentUser.role === 'admin';
  const myEmail = (currentUser && currentUser.email) ? currentUser.email.toLowerCase().trim() : '';
  const myId = currentUser ? String(currentUser._id || currentUser.id || '') : '';

  container.innerHTML = remarks.map(rem => {
    const tName = rem.teacherName || 'Teacher';
    const tSub = rem.teacherSubject || 'Faculty';
    const dateStr = formatRemarkDate(rem.createdAt);
    const avatarSrc = isCustomPhoto(rem.teacherAvatar)
      ? rem.teacherAvatar
      : getInitialsAvatar(tName, '245b70', 'ffffff', true);

    const isOwner = (rem.teacherId && myId && String(rem.teacherId) === myId) ||
                    (rem.teacherEmail && myEmail && rem.teacherEmail.toLowerCase().trim() === myEmail);
    const canModify = Boolean(isAdmin || isOwner);

    const actionsHtml = canModify ? `
      <div class="flex items-center gap-1 ml-auto flex-shrink-0">
        <button type="button" onclick="handleEditStudentRemark('${student._id}', '${rem._id}')" title="Edit Remark" class="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 text-[10px] font-bold text-[var(--text-main)] hover:bg-[#245b70] hover:text-white transition">Edit</button>
        <button type="button" onclick="handleDeleteStudentRemark('${student._id}', '${rem._id}')" title="Delete Remark" class="px-1.5 py-0.5 rounded bg-rose-500/10 text-[10px] font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition">Delete</button>
      </div>
    ` : '';

    return `
      <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
        <img src="${avatarSrc}" alt="${escapeHtml(tName)}" class="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-[#245b70]/30">
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <h5 class="text-xs font-extrabold text-[var(--text-main)] truncate">${escapeHtml(tName)}</h5>
            ${actionsHtml}
          </div>
          <p class="text-[10px] text-[var(--text-sub)] font-semibold">${dateStr ? escapeHtml(dateStr) : ''}</p>
          <p class="text-xs text-[var(--text-main)] mt-1 leading-relaxed break-words">${escapeHtml(rem.text || '')}</p>
        </div>
      </div>
    `;
  }).join('');
}

async function handleAddRemarkFromDetailsModal() {
  if (!currentDetailsStudent || !currentDetailsStudent._id) return;
  const input = document.getElementById('details-new-remark-text');
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    showToast('Please write a remark first', true);
    return;
  }
  try {
    const res = await API.addStudentRemark(currentDetailsStudent._id, text);
    if (res && res.success && res.data) {
      input.value = '';
      currentDetailsStudent = res.data;
      renderStudentRemarksList(currentDetailsStudent, 'details-student-remarks-list');
      await renderStudentsDirectory();
      showToast('Remark added!');
    }
  } catch (err) {
    showToast(err.message || 'Failed to add remark', true);
  }
}

async function handleAddRemarkFromEditModal() {
  if (!activeEditStudentObjId) return;
  const input = document.getElementById('edit-student-new-remark');
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    showToast('Please write a remark first', true);
    return;
  }
  try {
    const res = await API.addStudentRemark(activeEditStudentObjId, text);
    if (res && res.success && res.data) {
      input.value = '';
      activeEditStudentRecord = res.data;
      renderStudentRemarksList(activeEditStudentRecord, 'edit-student-remarks-list');
      await renderStudentsDirectory();
      showToast('Remark added!');
    }
  } catch (err) {
    showToast(err.message || 'Failed to add remark', true);
  }
}

async function handleEditStudentRemark(studentId, remarkId) {
  const targetStudent = (currentDetailsStudent && String(currentDetailsStudent._id) === String(studentId))
    ? currentDetailsStudent
    : activeEditStudentRecord;
  const rem = (targetStudent?.remarks || []).find(r => String(r._id) === String(remarkId));
  const nextText = typeof showCustomPrompt === 'function'
    ? await showCustomPrompt({
        title: 'Edit Remark',
        badge: 'Teacher Remark',
        message: 'Edit your remark below:',
        defaultValue: rem ? rem.text : ''
      })
    : prompt('Edit your remark:', rem ? rem.text : '');
  if (nextText === null) return;
  if (!nextText.trim()) {
    showToast('Remark text cannot be empty', true);
    return;
  }
  try {
    const res = await API.editStudentRemark(studentId, remarkId, nextText.trim());
    if (res && res.success && res.data) {
      if (currentDetailsStudent && String(currentDetailsStudent._id) === String(studentId)) {
        currentDetailsStudent = res.data;
        renderStudentRemarksList(currentDetailsStudent, 'details-student-remarks-list');
      }
      if (activeEditStudentRecord && String(activeEditStudentRecord._id) === String(studentId)) {
        activeEditStudentRecord = res.data;
        renderStudentRemarksList(activeEditStudentRecord, 'edit-student-remarks-list');
      }
      await renderStudentsDirectory();
      showToast('Remark updated!');
    }
  } catch (err) {
    showToast(err.message || 'Failed to update remark', true);
  }
}

async function handleDeleteStudentRemark(studentId, remarkId) {
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Delete Remark',
        badge: 'Teacher Remark',
        message: 'Delete this remark? This cannot be undone.',
        isDanger: true
      })
    : confirm('Delete this remark?');
  if (!confirmed) return;
  try {
    const res = await API.deleteStudentRemark(studentId, remarkId);
    if (res && res.success && res.data) {
      if (currentDetailsStudent && String(currentDetailsStudent._id) === String(studentId)) {
        currentDetailsStudent = res.data;
        renderStudentRemarksList(currentDetailsStudent, 'details-student-remarks-list');
      }
      if (activeEditStudentRecord && String(activeEditStudentRecord._id) === String(studentId)) {
        activeEditStudentRecord = res.data;
        renderStudentRemarksList(activeEditStudentRecord, 'edit-student-remarks-list');
      }
      await renderStudentsDirectory();
      showToast('Remark deleted');
    }
  } catch (err) {
    showToast(err.message || 'Failed to delete remark', true);
  }
}

function setDetailsFieldVisibility(wrapId, valId, value) {
  const wrap = document.getElementById(wrapId);
  const valEl = document.getElementById(valId);
  const clean = value !== undefined && value !== null ? String(value).trim() : '';
  if (clean && clean !== '-') {
    if (valEl) valEl.innerText = clean;
    if (wrap) wrap.classList.remove('hidden');
    return true;
  } else {
    if (valEl) valEl.innerText = '';
    if (wrap) wrap.classList.add('hidden');
    return false;
  }
}

async function openStudentDetailsModal(studentId) {
  const targetId = String(studentId);
  let student = null;

  try {
    const singleRes = await API.getStudentById(targetId);
    if (singleRes && singleRes.success && singleRes.data) {
      student = singleRes.data;
    }
  } catch (_) {}

  if (!student) {
    student = (studentsList || []).find(s => String(s.studentId) === targetId || String(s._id) === targetId);
  }
  if (!student && typeof pwStudentsList !== 'undefined' && Array.isArray(pwStudentsList)) {
    student = pwStudentsList.find(s => String(s.studentId) === targetId || String(s._id) === targetId);
  }
  if (!student) {
    try {
      const res = await API.getStudents('all');
      if (res && res.data) {
        student = res.data.find(s => String(s.studentId) === targetId || String(s._id) === targetId);
      }
    } catch (e) {}
  }
  if (!student) {
    showToast('Student information not found', true);
    return;
  }

  currentDetailsStudent = student;

  const photo = isCustomPhoto(student.photoUrl) ? student.photoUrl : getInitialsAvatar(student.name, '245b70');
  document.getElementById('details-student-photo').src = photo;
  document.getElementById('details-student-name').innerText = student.name;
  document.getElementById('details-student-id').innerText = `ID: ${student.studentId}`;
  document.getElementById('details-student-class').innerText = `Class: ${student.class}`;
  document.getElementById('details-student-roll').innerText = `Roll #${student.roll}`;

  // Personal Details (show section only if at least one field is non-empty)
  const dob = student.personalDetails?.dob || '';
  const age = calculateAgeFromDob(dob);
  const hasDob = setDetailsFieldVisibility('details-wrap-dob', 'details-student-dob', dob);
  const hasAge = setDetailsFieldVisibility('details-wrap-age', 'details-student-age', age);
  const hasGender = setDetailsFieldVisibility('details-wrap-gender', 'details-student-gender', student.personalDetails?.gender);
  const hasBlood = setDetailsFieldVisibility('details-wrap-blood', 'details-student-blood', student.personalDetails?.bloodGroup);
  const hasEmail = setDetailsFieldVisibility('details-wrap-email', 'details-student-email', student.personalDetails?.studentEmail);
  const personalSec = document.getElementById('details-personal-section');
  if (personalSec) {
    if (hasDob || hasAge || hasGender || hasBlood || hasEmail) {
      personalSec.classList.remove('hidden');
    } else {
      personalSec.classList.add('hidden');
    }
  }

  // Address Details
  document.getElementById('details-student-address').innerText = (student.address && student.address.fullAddress) || '-';
  document.getElementById('details-student-place').innerText = (student.address && student.address.place) || '-';
  document.getElementById('details-student-district').innerText = (student.address && student.address.district) || '-';
  document.getElementById('details-student-state').innerText = (student.address && student.address.state) || '-';
  setDetailsFieldVisibility('details-wrap-pin', 'details-student-pin', student.address?.pinCode);

  // Family Details
  document.getElementById('details-student-father').innerText = (student.familyDetails && student.familyDetails.fatherName) || '-';
  document.getElementById('details-student-mother').innerText = (student.familyDetails && student.familyDetails.motherName) || '-';
  document.getElementById('details-student-mobile').innerText = (student.familyDetails && student.familyDetails.fatherMobile) || '-';
  setDetailsFieldVisibility('details-wrap-motherNumber', 'details-student-motherNumber', student.familyDetails?.motherNumber);
  // Show legacy WhatsApp only if old student has it and motherNumber is empty
  if (!student.familyDetails?.motherNumber && student.familyDetails?.fatherWhatsapp) {
    setDetailsFieldVisibility('details-wrap-wa', 'details-student-wa', student.familyDetails.fatherWhatsapp);
  } else {
    setDetailsFieldVisibility('details-wrap-wa', 'details-student-wa', '');
  }

  const hasGType = setDetailsFieldVisibility('details-wrap-guardianType', 'details-student-guardian', student.familyDetails?.guardian);
  const hasGOcc = setDetailsFieldVisibility('details-wrap-guardianOcc', 'details-student-guardianOcc', student.familyDetails?.guardianOccupation);
  const isGOther = student.familyDetails?.guardian === 'Other';
  const hasGName = setDetailsFieldVisibility('details-wrap-guardianName', 'details-student-guardianName', isGOther ? student.familyDetails?.guardianName : '');
  const hasGNum = setDetailsFieldVisibility('details-wrap-guardianNum', 'details-student-guardianNum', isGOther ? student.familyDetails?.guardianNumber : '');
  const hasGRel = setDetailsFieldVisibility('details-wrap-guardianRel', 'details-student-guardianRel', isGOther ? student.familyDetails?.guardianRelation : '');
  const gWrap = document.getElementById('details-wrap-guardian');
  if (gWrap) {
    if (hasGType || hasGOcc || hasGName || hasGNum || hasGRel) {
      gWrap.classList.remove('hidden');
    } else {
      gWrap.classList.add('hidden');
    }
  }

  // Academic Status
  setDetailsFieldVisibility('details-wrap-admNo', 'details-student-admNo', student.academicStatus?.admissionNo);
  setDetailsFieldVisibility('details-wrap-admDate', 'details-student-admDate', student.academicStatus?.admissionDate);
  const yr = student.academicStatus?.yearJoined || '';
  setDetailsFieldVisibility('details-wrap-year', 'details-student-year', yr);
  document.getElementById('details-student-rank').innerText = (student.academicStatus && student.academicStatus.rank) || '-';
  document.getElementById('details-student-college').innerText = (student.academicStatus && student.academicStatus.previousCollege) || '-';

  const attEl = document.getElementById('details-student-attendance');
  if (attEl) {
    if (student.attendancePercentage !== undefined && student.attendancePercentage !== null) {
      attEl.innerText = `${student.attendancePercentage}%`;
    } else {
      attEl.innerText = 'N/A';
    }
  }

  // 5 Scannable Colored Metric Cards
  const totalSessions = student.attendanceSessions !== undefined ? student.attendanceSessions : 0;
  const presentSessions = student.attendancePresent !== undefined ? student.attendancePresent : 0;
  const absentSessions = student.attendanceAbsent !== undefined ? student.attendanceAbsent : 0;
  const leaveSessions = student.attendanceLeave !== undefined ? student.attendanceLeave : 0;
  const rateSessions = (student.attendancePercentage !== undefined && student.attendancePercentage !== null)
    ? `${student.attendancePercentage}%`
    : (totalSessions > 0 ? `${Math.round((presentSessions / totalSessions) * 100)}%` : '0%');

  const setCardVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = String(val);
  };
  setCardVal('details-stat-sessions', totalSessions);
  setCardVal('details-stat-present', presentSessions);
  setCardVal('details-stat-absent', absentSessions);
  setCardVal('details-stat-leave', leaveSessions);
  setCardVal('details-stat-percent', rateSessions);

  // Dynamic Class Badges & Academic Status Fields
  const cat = getClassCategory(student.class);
  const streamBadge = document.getElementById('details-student-stream-badge');
  const yearBadge = document.getElementById('details-student-year-badge');
  const streamVal = student.academicStatus?.stream || student.stream || '';
  const degreeYearVal = student.academicStatus?.degreeYear || student.degreeYear || '';

  if (cat === 'plus_two' && streamVal) {
    if (streamBadge) {
      streamBadge.innerText = `Stream: ${streamVal}`;
      streamBadge.classList.remove('hidden');
    }
    if (yearBadge) yearBadge.classList.add('hidden');
  } else if (cat === 'degree' && degreeYearVal) {
    if (streamBadge) streamBadge.classList.add('hidden');
    if (yearBadge) {
      yearBadge.innerText = `Year: ${degreeYearVal}`;
      yearBadge.classList.remove('hidden');
    }
  } else {
    if (streamBadge) streamBadge.classList.add('hidden');
    if (yearBadge) yearBadge.classList.add('hidden');
  }

  setDetailsFieldVisibility('details-wrap-stream', 'details-student-stream', cat === 'plus_two' ? streamVal : '');
  setDetailsFieldVisibility('details-wrap-degreeYear', 'details-student-degreeYear', cat === 'degree' ? degreeYearVal : '');

  // Remarks
  const remInput = document.getElementById('details-new-remark-text');
  if (remInput) remInput.value = '';
  renderStudentRemarksList(student, 'details-student-remarks-list');

  document.getElementById('modal-student-details').classList.remove('hidden');
}

function closeStudentDetailsModal() {
  document.getElementById('modal-student-details').classList.add('hidden');
}

// Triggered when teacher taps photo in the Details Modal
function triggerEnlargeFromDetails() {
  if (currentDetailsStudent) {
    openEnlargedPhoto(currentDetailsStudent.photoUrl, currentDetailsStudent.name, currentDetailsStudent);
  } else {
    const photoSrc = document.getElementById('details-student-photo').src;
    const name = document.getElementById('details-student-name').innerText;
    openEnlargedPhoto(photoSrc, name);
  }
}

// Lightbox: Enlarges photo in high clarity and displays download SVG button
function openEnlargedPhoto(photoUrl, name, studentObj = null) {
  const modal = document.getElementById('modal-photo-enlarged');
  const img = document.getElementById('enlarged-photo-img');
  const nameEl = document.getElementById('enlarged-photo-name');
  const metaEl = document.getElementById('enlarged-photo-meta');
  const spinner = document.getElementById('enlarged-photo-spinner');

  // Match or build student record
  let student = studentObj || currentDetailsStudent;
  if (!student && name) {
    student = (studentsList || []).find(s => s.name === name);
  }
  if (!student) {
    student = {
      name: name || 'Student Photo',
      photoUrl: photoUrl || '',
      studentId: '',
      class: '',
      roll: ''
    };
  }

  activeEnlargedStudent = student;

  if (nameEl) nameEl.innerText = student.name || 'Student Photo';
  if (metaEl) {
    const metaParts = [];
    if (student.class) metaParts.push(`Class: ${student.class}`);
    if (student.roll) metaParts.push(`Roll #${student.roll}`);
    if (student.studentId) metaParts.push(`ID: ${student.studentId}`);
    metaEl.innerText = metaParts.join(' · ');
  }

  const hasCustom = isCustomPhoto(student.photoUrl || photoUrl);
  const highClarityUrl = hasCustom
    ? getHighClarityPhotoUrl(student.photoUrl || photoUrl)
    : getInitialsAvatar(student.name || 'S', '245b70');

  if (spinner) spinner.classList.remove('hidden');
  if (img) {
    img.onload = () => { if (spinner) spinner.classList.add('hidden'); };
    img.onerror = () => { if (spinner) spinner.classList.add('hidden'); };
    img.src = highClarityUrl;
  }

  if (modal) modal.classList.remove('hidden');
}

function closeEnlargedPhoto() {
  const modal = document.getElementById('modal-photo-enlarged');
  if (modal) modal.classList.add('hidden');
}

// Downloads the currently enlarged student photo with maximum clarity
async function downloadCurrentEnlargedPhoto() {
  if (!activeEnlargedStudent) {
    showToast(typeof t === 'function' ? (t('photo_download_failed') || 'Failed to download photo') : 'Failed to download photo', true);
    return;
  }

  const st = activeEnlargedStudent;
  const studentName = (st.name || 'Student').trim();
  const cleanName = studentName.replace(/[^a-zA-Z0-9_\u0D00-\u0D7F-]/g, '_');
  const studentId = st.studentId ? `_ID${st.studentId}` : '';
  const className = st.class ? `_${String(st.class).replace(/[^a-zA-Z0-9_\u0D00-\u0D7F-]/g, '_')}` : '';
  const filename = `${cleanName}${studentId}${className}.jpg`;

  const hasCustom = isCustomPhoto(st.photoUrl);
  const photoUrl = hasCustom ? getHighClarityPhotoUrl(st.photoUrl) : getInitialsAvatar(st.name || 'S', '245b70');

  const downloadingMsg = typeof t === 'function' ? (t('downloading_photo') || 'Downloading photo in full clarity...') : 'Downloading photo in full clarity...';
  const successMsg = typeof t === 'function' ? (t('photo_downloaded') || 'Photo downloaded in full clarity!') : 'Photo downloaded in full clarity!';
  const failMsg = typeof t === 'function' ? (t('photo_download_failed') || 'Failed to download photo') : 'Failed to download photo';

  showToast(downloadingMsg);

  // 1. If SVG initials avatar, render onto high-resolution 1024x1024 canvas
  if (photoUrl.startsWith('data:image/svg+xml')) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 1024, 1024);
        canvas.toBlob((blob) => {
          if (!blob) {
            showToast(failMsg, true);
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
          showToast(successMsg);
        }, 'image/jpeg', 0.95);
      };
      img.onerror = () => {
        showToast(failMsg, true);
      };
      img.src = photoUrl;
      return;
    } catch (err) {
      console.warn('[Avatar Canvas Download Error]', err);
    }
  }

  // 2. Direct client-side fetch (fastest & full native clarity)
  try {
    const res = await fetch(photoUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      showToast(successMsg);
      return;
    }
  } catch (fetchErr) {
    console.log('[Direct Download Fallback to Server Proxy]', fetchErr);
  }

  // 3. Robust Server Download Proxy (bypasses browser CORS restrictions completely)
  try {
    const proxyUrl = `/api/upload/download-proxy?url=${encodeURIComponent(photoUrl)}&name=${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(successMsg);
  } catch (proxyErr) {
    console.error('[Download Proxy Failed]', proxyErr);
    showToast(failMsg, true);
  }
}

async function confirmDeleteStudent(id, name, studentId) {
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Delete Student',
        badge: 'Students',
        message: `Are you sure you want to delete "${name}" (ID: ${studentId})?`,
        isDanger: true
      })
    : confirm(`Are you sure you want to delete "${name}" (ID: ${studentId})?`);
  if (!confirmed) return;
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
  window._activityLogFilterUserSet = true;
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

function formatActivityLogDetails(log) {
  const details = log.details || '';
  const actionLower = (log.action || '').toLowerCase();
  const isAttendance = actionLower.includes('attendance') || log.entityType === 'attendance';

  if (isAttendance) {
    let p = log.counts && typeof log.counts.present === 'number' ? log.counts.present : null;
    let a = log.counts && typeof log.counts.absent === 'number' ? log.counts.absent : null;
    let l = log.counts && typeof log.counts.leave === 'number' ? log.counts.leave : (log.counts && typeof log.counts.late === 'number' ? log.counts.late : null);

    if (p === null) {
      const pm = details.match(/(\d+)\s*Present/i);
      if (pm) p = parseInt(pm[1], 10);
    }
    if (a === null) {
      const am = details.match(/(\d+)\s*Absent/i);
      if (am) a = parseInt(am[1], 10);
    }
    if (l === null) {
      const lm = details.match(/(\d+)\s*Leave/i) || details.match(/(\d+)\s*Late/i);
      if (lm) l = parseInt(lm[1], 10);
    }

    let pct = '';
    const pctMatch = details.match(/\((\d+(?:\.\d+)?%)\)/);
    if (pctMatch) {
      pct = pctMatch[1];
    } else if (p !== null && a !== null) {
      const total = p + a + (l || 0);
      pct = total > 0 ? Math.round((p / total) * 100) + '%' : '0%';
    }

    if (p !== null || a !== null) {
      return `
        <div class="flex items-center gap-1.5 flex-wrap text-[11px] leading-tight">
          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>${p !== null ? p : 0} Present
          </span>
          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>${a !== null ? a : 0} Absent
          </span>
          ${l !== null && l > 0 ? `
          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>${l} Leave
          </span>` : (l !== null ? `
          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[var(--text-sub)] font-semibold border border-[var(--border-color)]">
            0 Leave
          </span>` : '')}
          ${pct ? `
          <span class="px-1.5 py-0.5 rounded-md bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 font-black border border-[#245b70]/20 text-[10px]">
            ${pct}
          </span>` : ''}
        </div>
      `;
    }
  }

  if (!details) return '';
  return `<div class="text-[11px] text-[var(--text-sub)] line-clamp-2 leading-tight">${escapeHtml(details)}</div>`;
}

function renderActivityLogsList() {
  const container = document.getElementById('activity-logs-container');
  if (!container) return;

  const logs = cachedActivityLogs || [];
  const myName = (currentUser && currentUser.name) ? currentUser.name.trim().toLowerCase() : '';

  let filteredLogs = logs;
  const myEmail = (currentUser && currentUser.email) ? currentUser.email.trim().toLowerCase() : '';
  if (currentActivityLogFilter === 'mine' && (myName || myEmail)) {
    filteredLogs = logs.filter(log => {
      const logEmail = (log.performedByEmail || '').trim().toLowerCase();
      const performed = (log.performedBy || '').trim().toLowerCase();
      const details = (log.details || '').trim().toLowerCase();
      // Prefer email match for new logs; fall back to name match for old logs without email
      if (myEmail && logEmail) return logEmail === myEmail;
      return performed === myName || performed.includes(myName) || details.includes(myName);
    });
  }

  if (filteredLogs.length === 0) {
    container.innerHTML = `
      <div class="py-4 px-3 text-center rounded-xl bg-[var(--bg-page)]/60 border border-dashed border-[var(--border-color)]">
        <svg class="w-6 h-6 mx-auto mb-1 text-[var(--text-sub)] opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        <p class="text-xs font-bold text-[var(--text-main)]">${currentActivityLogFilter === 'mine' ? 'No Actions Yet' : 'No Activity Logs'}</p>
        <p class="text-[10px] text-[var(--text-sub)] mt-0.5">${currentActivityLogFilter === 'mine' ? 'Your attendance marks and updates will show here.' : 'Recent attendance actions will appear here.'}</p>
      </div>
    `;
    return;
  }

  const isAdmin = currentUser && currentUser.role === 'admin';

  container.innerHTML = filteredLogs.map(log => {
    const actionLower = (log.action || '').toLowerCase();
    let dotColor = 'bg-[#245b70]';
    let dotBorder = 'ring-[#245b70]/30';
    if (log.isUndone) {
      dotColor = 'bg-slate-400';
      dotBorder = 'ring-slate-400/30';
    } else if (actionLower.includes('attendance')) {
      dotColor = 'bg-emerald-500';
      dotBorder = 'ring-emerald-500/30';
    } else if (actionLower.includes('delete') || actionLower.includes('remove')) {
      dotColor = 'bg-rose-500';
      dotBorder = 'ring-rose-500/30';
    } else if (actionLower.includes('edit') || actionLower.includes('update') || actionLower.includes('change')) {
      dotColor = 'bg-amber-500';
      dotBorder = 'ring-amber-500/30';
    } else if (actionLower.includes('add') || actionLower.includes('create') || actionLower.includes('new')) {
      dotColor = 'bg-blue-500';
      dotBorder = 'ring-blue-500/30';
    }

    let dateTimeStr = '';
    if (log.createdAt) {
      const logDate = new Date(log.createdAt);
      const dateFormatted = logDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeFormatted = logDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      dateTimeStr = `${dateFormatted} • ${timeFormatted}`;
    }

    const _le = (log.performedByEmail || '').toLowerCase();
    let _dn = log.performedBy || 'Teacher';
    if (_le) {
      if (currentUser && (currentUser.email || '').toLowerCase() === _le) {
        _dn = currentUser.name || _dn;
      } else if (cachedTeachersList) {
        const _f = cachedTeachersList.find(t => (t.email || '').toLowerCase() === _le);
        if (_f && _f.name) _dn = _f.name;
      }
    }

    const formattedDetails = formatActivityLogDetails(log);

    return `
      <div id="log-item-${log._id}" class="p-2.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-start justify-between gap-2.5 ${log.isUndone ? 'opacity-50' : ''} hover:border-[#245b70]/40 transition shadow-2xs">
        <div class="flex items-start gap-2.5 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full ${dotColor} mt-0.5 flex-shrink-0 ring-2 ${dotBorder}"></span>
          <div class="flex flex-col gap-1 min-w-0 flex-1">
            <!-- Line 1: Heading -->
            <div class="font-extrabold text-[var(--text-main)] text-xs leading-tight">
              ${escapeHtml(log.action)}
            </div>

            <!-- Line 2: 2 Present, 2 Absent / Details -->
            ${formattedDetails}

            <!-- Line 3: Date • Time -->
            ${dateTimeStr ? `
            <div class="text-[10px] text-[var(--text-sub)] font-medium leading-tight flex items-center gap-1 opacity-80">
              <svg class="w-2.5 h-2.5 opacity-60 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>${dateTimeStr}</span>
            </div>` : ''}

            <!-- Line 4: by Teacher -->
            <div class="text-[10.5px] font-bold text-[#245b70] dark:text-cyan-400 leading-tight">
              by ${escapeHtml(_dn)}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
          ${log.isUndone ? `
            <span class="text-[9.5px] font-bold px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Reverted</span>
          ` : (isAdmin && log.canUndo ? `
            <!-- UNDO BUTTON: ONLY shown for Admin accounts as explicitly requested! -->
            <button onclick="undoLog('${log._id}')" class="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-white border border-amber-500/30 active:scale-95 transition flex items-center gap-1 shadow-2xs">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
              <span>Undo</span>
            </button>
          ` : '')}
        </div>
      </div>
    `;
  }).join('');
}

async function loadActivityLogs() {
  const container = document.getElementById('activity-logs-container');
  if (!container) return;

  try {
    const res = await API.getLogs();
    if (res.success && res.data) {
      cachedActivityLogs = res.data;
      if (currentUser && currentUser.role === 'teacher' && !window._activityLogFilterUserSet) {
        currentActivityLogFilter = 'mine';
        const btnAll = document.getElementById('btn-log-filter-all');
        const btnMine = document.getElementById('btn-log-filter-mine');
        if (btnAll && btnMine) {
          btnMine.className = 'px-2 py-0.5 rounded-lg bg-[#245b70] text-white shadow-xs font-bold transition';
          btnAll.className = 'px-2 py-0.5 rounded-lg text-[var(--text-sub)] hover:text-[var(--text-main)] font-semibold transition';
        }
      }
      renderActivityLogsList();
      updateProfileDashboardKPIs();
    }
  } catch (error) {
    console.log('[Logs Load]', error);
  }
}

// Teacher Daily Summary & Today's Status (Profile Card & Merged Dashboard Card)
function isAttendanceMarkedByCurrentUser(att, user) {
  if (!att || !user) return false;
  const myEmail = String(user.email || '').trim().toLowerCase();
  const myName = String(user.name || '').trim().toLowerCase();

  const markedEmail = String(att.markedByEmail || '').trim().toLowerCase();
  const ownerEmail = String(att.ownerEmail || '').trim().toLowerCase();
  const markedName = String(att.markedBy || '').trim().toLowerCase();

  // 1. Primary: if markedByEmail exists, it MUST match the user's email
  if (markedEmail) {
    return Boolean(myEmail && markedEmail === myEmail);
  }

  // 2. If it is a private record, it MUST belong to the user's email
  if (att.isPrivate) {
    return Boolean(myEmail && ownerEmail && ownerEmail === myEmail);
  }

  // 3. If ownerEmail is present on the record, compare ownerEmail
  if (ownerEmail && myEmail) {
    return ownerEmail === myEmail;
  }

  // 4. Fallback for legacy records without markedByEmail:
  // Must match exact non-generic name
  if (markedName && myName) {
    if (markedName === 'admin' || markedName === 'teacher' || markedName === 'administrator') return false;
    return markedName === myName;
  }

  return false;
}

async function updateProfileDashboardKPIs() {
  if (!currentUser) return;

  const todayClassesEls = [document.getElementById('kpi-today-classes'), document.getElementById('dash-kpi-today-classes')].filter(Boolean);
  const markedEls = [document.getElementById('kpi-attendance-marked'), document.getElementById('dash-kpi-attendance-marked')].filter(Boolean);
  const liveSubEls = [document.getElementById('status-live-subject'), document.getElementById('dash-status-live-subject')].filter(Boolean);
  const liveMetaEls = [document.getElementById('status-live-meta'), document.getElementById('dash-status-live-meta')].filter(Boolean);
  const nextSubEls = [document.getElementById('status-next-subject'), document.getElementById('dash-status-next-subject')].filter(Boolean);
  const nextMetaEls = [document.getElementById('status-next-meta'), document.getElementById('dash-status-next-meta')].filter(Boolean);
  if (todayClassesEls.length === 0 && markedEls.length === 0 && liveSubEls.length === 0 && nextSubEls.length === 0) return;

  const myName = (currentUser.name || '').trim().toLowerCase();
  const myId = currentUser._id || currentUser.id || null;
  const myEmail = (currentUser.email || '').trim().toLowerCase();
  const isAdmin = currentUser.role === 'admin';

  // 1. Calculate today's classes, live subject, and next subject from timetable
  try {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()].toLowerCase();

    const ttRes = await API.getTimetable('', '', myEmail);
    const allSlots = (ttRes && ttRes.data) ? ttRes.data : (Array.isArray(ttRes) ? ttRes : []);
    let mySlots = allSlots.filter(s => (s.teacherEmail || '').trim().toLowerCase() === myEmail);
    if (isAdmin && mySlots.length === 0) {
      mySlots = allSlots;
    }

    const todaySlots = mySlots.filter(s => {
      const d = (s.day || '').trim().toLowerCase();
      const days = Array.isArray(s.days) ? s.days.map(x => x.trim().toLowerCase()) : [];
      const splitDays = d.split(',').map(x => x.trim().toLowerCase());
      return d === todayName || d === 'all days' || splitDays.includes(todayName) || days.includes(todayName) || days.includes('all days');
    });

    todayClassesEls.forEach(el => el.textContent = String(todaySlots.length));

    // Calculate Live and Next Subject
    const currentMin = now.getHours() * 60 + now.getMinutes();

    const slotsWithRange = todaySlots.map(s => {
      const range = _parseSlotTimeRange(s.timeSlot || s.time);
      return {
        slot: s,
        startMin: range ? range.startMin : null,
        endMin: range ? range.endMin : null,
        range
      };
    }).sort((a, b) => {
      if (a.startMin !== null && b.startMin !== null) return a.startMin - b.startMin;
      return 0;
    });

    // Find Live slot: currently active
    const liveMatch = slotsWithRange.find(item => {
      if (item.startMin === null || item.endMin === null) return false;
      return currentMin >= item.startMin && currentMin < item.endMin;
    });

    // Find Next slot: earliest slot starting after now
    const nextMatch = slotsWithRange.find(item => {
      if (item.startMin === null) return false;
      return item.startMin > currentMin;
    });

    const isMl = (typeof currentAppLanguage !== 'undefined' ? currentAppLanguage : localStorage.getItem('app_language')) === 'ml';

    if (liveSubEls.length > 0) {
      if (liveMatch) {
        const s = liveMatch.slot;
        const timeText = s.timeSlot || s.time || '';
        const classText = s.class ? (isMl ? `ക്ലാസ് ${s.class}` : `Class ${s.class}`) : '';
        const liveMeta = [classText, timeText].filter(Boolean).join(' • ') || (isMl ? 'നടന്നുകൊണ്ടിരിക്കുന്നു' : 'In session');
        liveSubEls.forEach(el => el.textContent = s.subject || (isMl ? 'ക്ലാസ്' : 'Class'));
        liveMetaEls.forEach(el => el.textContent = liveMeta);
      } else {
        const liveMeta = todaySlots.length === 0 ? (isMl ? 'ഇന്ന് ക്ലാസുകളില്ല' : 'No classes today') : (isMl ? 'ഇപ്പോൾ ക്ലാസുകളൊന്നുമില്ല' : 'No active session');
        liveSubEls.forEach(el => el.textContent = isMl ? 'ഒന്നുമില്ല' : 'None');
        liveMetaEls.forEach(el => el.textContent = liveMeta);
      }
    }

    if (nextSubEls.length > 0) {
      if (nextMatch) {
        const s = nextMatch.slot;
        const diff = nextMatch.startMin - currentMin;
        const classText = s.class ? (isMl ? `ക്ലാസ് ${s.class}` : `Class ${s.class}`) : '';
        const diffText = diff > 0 ? (isMl ? (diff < 60 ? `${diff} മിനിറ്റിൽ` : `${Math.floor(diff / 60)} മണി ${diff % 60} മിനിറ്റിൽ`) : (diff < 60 ? `in ${diff}m` : `in ${Math.floor(diff / 60)}h ${diff % 60}m`)) : '';
        const timeText = s.timeSlot || s.time || '';
        const metaParts = [classText, diffText || timeText].filter(Boolean);
        const nextMeta = metaParts.join(' • ') || (isMl ? 'അടുത്ത ക്ലാസ്' : 'Upcoming');
        nextSubEls.forEach(el => el.textContent = s.subject || (isMl ? 'ക്ലാസ്' : 'Class'));
        nextMetaEls.forEach(el => el.textContent = nextMeta);
      } else {
        if (todaySlots.length > 0) {
          nextSubEls.forEach(el => el.textContent = isMl ? 'പൂർത്തിയായി' : 'Done');
          nextMetaEls.forEach(el => el.textContent = isMl ? 'ഇന്നത്തെ ക്ലാസുകൾ പൂർത്തിയായി' : 'All classes completed');
        } else {
          nextSubEls.forEach(el => el.textContent = isMl ? 'ഒന്നുമില്ല' : 'None');
          nextMetaEls.forEach(el => el.textContent = isMl ? 'അടുത്ത ക്ലാസുകളൊന്നുമില്ല' : 'No upcoming classes');
        }
      }
    }
  } catch (err) {
    console.error('[Dashboard Status Error]', err);
  }

  // 2. Count attendance marked today from live Attendance documents
  try {
    const todayDateStr = formatLocalDate(new Date());
    const attRes = await API.getAttendance(todayDateStr);
    const rawList = (attRes && attRes.data !== undefined) ? attRes.data : attRes;
    const todayAttendances = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);

    const myAttendances = todayAttendances.filter(att => isAttendanceMarkedByCurrentUser(att, currentUser));
    markedEls.forEach(el => el.textContent = String(myAttendances.length));
  } catch (err) {
    console.error('[Marked Today KPI Error]', err);
  }
}

async function undoLog(logId) {
  const targetLog = (cachedActivityLogs || []).find(l => String(l._id) === String(logId));
  const actionName = targetLog ? targetLog.action : 'Action';
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Undo Activity',
        badge: 'Revert Action',
        message: `Are you sure you want to revert "${actionName}"? This will restore the previous state.`,
        confirmText: 'Revert Action',
        isDanger: true
      })
    : confirm(`Revert "${actionName}"?`);
  if (!confirmed) return;

  try {
    const res = await API.undoLog(logId);
    if (res.success) {
      showToast(res.message || `Reverted: "${actionName}"`);
      await loadActivityLogs();
      await loadAttendanceRoster();
      await loadClasses();
      await loadSubjects();
      await renderStudentsDirectory();
      if (typeof renderTimetableSlots === 'function') await renderTimetableSlots();
    }
  } catch (error) {
    showToast(error.message || 'Failed to undo action', true);
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
  selectTab('admin');
  loadAdminTeachersList();
  if (typeof syncAdminPromotionCard === 'function') syncAdminPromotionCard();

  // Scroll to top of main viewport
  const mainViewport = document.querySelector('main');
  if (mainViewport) mainViewport.scrollTop = 0;

  // Sync logo preview in Admin Panel
  const appLogo = appSettings ? appSettings.appLogo : '';
  const firstLetter = (appSettings && appSettings.appName ? appSettings.appName.trim()[0] : 'R').toUpperCase();
  updateAdminLogoPreview(appLogo, firstLetter);
}

function closeAdminPanel() {
  selectTab('settings');
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
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: isCurrentlyAdmin ? 'Demote Admin' : 'Promote to Admin',
        badge: 'Admin Panel',
        message: `Are you sure you want to ${actionText}?`,
        isDanger: isCurrentlyAdmin
      })
    : confirm(`Are you sure you want to ${actionText}?`);
  if (!confirmed) return;

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
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Remove Teacher',
        badge: 'Admin Panel',
        message: `Are you sure you want to permanently remove teacher "${name}"?`,
        isDanger: true
      })
    : confirm(`Are you sure you want to permanently remove teacher "${name}"?`);
  if (!confirmed) return;
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
  const updated = typeof showCustomPrompt === 'function'
    ? await showCustomPrompt({
        title: 'Edit Teacher Name',
        badge: 'Admin Panel',
        message: 'Edit teacher name:',
        defaultValue: currentName
      })
    : prompt('Edit Teacher Name:', currentName);
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
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Clear Attendance Data',
        badge: 'Data Controls',
        message: 'Are you sure you want to clear attendance records? Teachers, students, classes, subjects, and student details will NOT be deleted.',
        confirmText: 'Clear Attendance',
        isDanger: true
      })
    : confirm("Are you sure you want to clear attendance records? Teachers, students, classes, subjects, and student details will NOT be deleted.");
  if (!confirmed) return;
  triggerNavHaptic('delete');

  try {
    const res = await API.clearData();
    if (res.success) {
      showToast('All attendance records have been cleared!');
      await loadAttendanceRoster();
      await loadReport();
      await loadActivityLogs();
      _applyTeachersTabVisibility();
      await loadHomeDashboard();
      selectTab('home');
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// USER DIRECTIVE:
// "reset button for clear all app data...like new"
async function handleResetAppPrompt() {
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Full App Reset (Like New)',
        badge: 'System Wipe',
        message: 'Are you sure you want to wipe all app data like new? All students, classes, subjects, attendance, logs, and settings will be completely reset.',
        confirmText: 'Wipe Everything',
        isDanger: true
      })
    : confirm("Are you sure you want to wipe all app data like new? All students, classes, subjects, attendance, logs, and settings will be completely reset.");
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

let currentActiveTab = 'home';
let previousAppTab = 'home';

function goBackFromSubPage(fallbackTab = 'settings') {
  const target = (previousAppTab && previousAppTab !== currentActiveTab && !['edit-profile', 'teacher-log', 'timetable', 'messages'].includes(previousAppTab))
    ? previousAppTab
    : fallbackTab;
  selectTab(target);
}

// ================= UNASSIGNED TIMETABLE & ATTENDANCE ACCESS VALIDATION =================
let checkingAttendanceAccess = false;

async function checkUnassignedTimetableForAttendance() {
  if (!currentUser) return null;
  if (currentUser.role === 'admin') return null; // Admin has full access to all classes and subjects
  const myEmail = (currentUser.email || '').trim().toLowerCase();
  const myName = (currentUser.name || '').trim().toLowerCase();
  const isTeacher = currentUser.role !== 'admin';

  // Get user's assigned classes and subjects
  const myAssign = getTeacherAssignments(currentUser.name, currentUser.email);
  const userAssignedClasses = new Set((myAssign.assignedClasses || []).map(c => c.trim().toLowerCase()));
  const userAssignedSubjects = new Set((myAssign.assignedSubjects || []).map(s => s.trim().toLowerCase()));

  if (currentUser.classTeacherOf) {
    userAssignedClasses.add(currentUser.classTeacherOf.trim().toLowerCase());
  }
  if (Array.isArray(currentUser.assignedClasses)) {
    currentUser.assignedClasses.forEach(c => {
      if (c) userAssignedClasses.add(String(c).trim().toLowerCase());
    });
  }
  if (Array.isArray(currentUser.assignedSubjects)) {
    currentUser.assignedSubjects.forEach(s => {
      if (s) userAssignedSubjects.add(String(s).trim().toLowerCase());
    });
  }
  (classesList || []).forEach(c => {
    const ctName = (c.classTeacher || '').trim().toLowerCase();
    const ctEmail = (c.classTeacherEmail || '').trim().toLowerCase();
    if ((ctName && ctName !== 'not assigned' && ctName === myName) || (ctEmail && ctEmail === myEmail)) {
      if (c.name) userAssignedClasses.add(c.name.trim().toLowerCase());
    }
  });

  // Fetch timetable slots for this account
  let userSlots = [];
  try {
    const res = await API.getTimetable('', '', myEmail);
    const rawSlots = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
    userSlots = rawSlots.filter(s => {
      const sEmail = (s.teacherEmail || '').trim().toLowerCase();
      const sTeacher = (s.teacher || '').trim().toLowerCase();
      return (myEmail && sEmail === myEmail) || (myName && sTeacher === myName);
    });
  } catch (err) {
    userSlots = (cachedCurrentTimetableSlots || []).filter(s => {
      const sEmail = (s.teacherEmail || '').trim().toLowerCase();
      return !myEmail || !sEmail || sEmail === myEmail;
    });
  }

  // 1. If user has timetable slots, check each slot for unassigned class or subject
  if (userSlots.length > 0) {
    const unassignedSlots = [];

    for (const slot of userSlots) {
      const sClass = (slot.class || '').trim();
      const sSubject = (slot.subject || '').trim();
      const sTime = slot.timeSlot || slot.time || 'Period';
      const sDay = slot.day || (Array.isArray(slot.days) ? slot.days.join(', ') : '');

      let reasons = [];

      // Check class assignment
      if (!sClass || sClass.toLowerCase() === 'unassigned' || sClass.toLowerCase() === 'not assigned') {
        reasons.push('Class is not assigned');
      } else if (!userAssignedClasses.has(sClass.toLowerCase())) {
        reasons.push(`Class "${sClass}" is not assigned to you`);
      }

      // Check subject assignment
      if (!sSubject || sSubject.toLowerCase() === 'unassigned' || sSubject.toLowerCase() === 'not assigned') {
        reasons.push('Subject is not assigned');
      } else {
        // If user is Class Teacher of sClass, class teacher is authorized for classes they lead
        const isCT = (currentUser.classTeacherOf && isClassEqual(currentUser.classTeacherOf, sClass)) ||
                     (classesList || []).some(c => isClassEqual(c.name, sClass) && (isClassEqual(c.classTeacher, currentUser.name) || (c.classTeacherEmail && isClassEqual(c.classTeacherEmail, currentUser.email))));

        if (!isCT) {
          const teachesSubjectForThisClass = (subjectsList || []).some(s => {
            if (!isClassEqual(s.name, sSubject)) return false;
            const st = (s.teacher || '').trim().toLowerCase();
            const se = (s.teacherEmail || s.ownerEmail || '').trim().toLowerCase();
            const isTeacherOfSub = (se && se === myEmail) || (!se && st && st === myName);
            if (!isTeacherOfSub) return false;
            return Array.isArray(s.assignedClasses) && s.assignedClasses.some(ac => isClassEqual(ac, sClass));
          });

          if (!teachesSubjectForThisClass) {
            const teachesSubSomewhere = (subjectsList || []).some(s => {
              if (!isClassEqual(s.name, sSubject)) return false;
              const st = (s.teacher || '').trim().toLowerCase();
              const se = (s.teacherEmail || s.ownerEmail || '').trim().toLowerCase();
              return (se && se === myEmail) || (!se && st && st === myName);
            }) || userAssignedSubjects.has(sSubject.toLowerCase());

            if (teachesSubSomewhere) {
              reasons.push(`Subject "${sSubject}" is not assigned to Class "${sClass}"`);
            } else {
              reasons.push(`Subject "${sSubject}" is not assigned to you`);
            }
          }
        }
      }

      if (reasons.length > 0) {
        unassignedSlots.push({
          slot,
          class: sClass || 'Unassigned Class',
          subject: sSubject || 'Unassigned Subject',
          time: sTime,
          day: sDay,
          reasons
        });
      }
    }

    if (unassignedSlots.length > 0) {
      return {
        type: 'unassigned_timetable',
        title: "You Didn't Assign a Class or Subject",
        badge: '⚠️ Timetable Warning',
        message: `Your timetable contains ${unassignedSlots.length} slot(s) with an unassigned class or subject. You cannot enter the Attendance page until all timetable slots are assigned properly.`,
        unassignedSlots
      };
    }
  }

  // 2. If user has NO timetable slots, but is a teacher without any assigned classes/subjects
  if (userSlots.length === 0 && isTeacher && userAssignedClasses.size === 0 && userAssignedSubjects.size === 0) {
    return {
      type: 'no_assignments',
      title: "You Didn't Assign a Class or Subject",
      badge: '⚠️ Assignment Required',
      message: "You have not been assigned any class or subject yet. Please assign a class or subject to your account before taking attendance.",
      unassignedSlots: []
    };
  }

  return null;
}

function showUnassignedTimetableModal(warningData) {
  const modal = document.getElementById('modal-unassigned-timetable-warning');
  if (!modal) return;

  const titleEl = document.getElementById('unassigned-tt-title');
  const badgeEl = document.getElementById('unassigned-tt-badge');
  const descEl = document.getElementById('unassigned-tt-description');
  const listEl = document.getElementById('unassigned-tt-slots-list');
  const sectionEl = document.getElementById('unassigned-tt-slots-section');

  if (titleEl && warningData.title) titleEl.textContent = warningData.title;
  if (badgeEl && warningData.badge) badgeEl.innerHTML = `<span>${escapeHtml(warningData.badge)}</span>`;
  if (descEl && warningData.message) descEl.textContent = warningData.message;

  if (listEl) {
    if (warningData.unassignedSlots && warningData.unassignedSlots.length > 0) {
      if (sectionEl) sectionEl.classList.remove('hidden');
      listEl.innerHTML = warningData.unassignedSlots.map(item => {
        const timeStr = item.time || 'Slot';
        const dayStr = item.day ? `${item.day} • ` : '';
        return `
          <div class="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-start justify-between gap-3 transition">
            <div class="min-w-0 flex-1">
              <div class="text-xs font-black text-white flex items-center gap-1.5 flex-wrap">
                <span class="text-amber-300 font-extrabold">${escapeHtml(dayStr + timeStr)}</span>
                <span>:</span>
                <span class="text-cyan-100">${escapeHtml(item.subject)}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-white/20 text-white font-bold">[${escapeHtml(item.class)}]</span>
              </div>
              <div class="text-[11px] text-rose-300 mt-1.5 space-y-0.5">
                ${(item.reasons || []).map(r => `<div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span><span>${escapeHtml(r)}</span></div>`).join('')}
              </div>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-lg bg-rose-500/25 text-rose-300 border border-rose-400/40 font-black whitespace-nowrap">
              Not Assigned
            </span>
          </div>
        `;
      }).join('');
    } else {
      if (sectionEl) sectionEl.classList.add('hidden');
      listEl.innerHTML = '';
    }
  }

  modal.classList.remove('hidden');
  const allowVibrate = localStorage.getItem('admin_notif_vibrate') !== 'false';
  if (allowVibrate) {
    try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch(_) {}
  }
}

function closeUnassignedTimetableModal() {
  const modal = document.getElementById('modal-unassigned-timetable-warning');
  if (modal) modal.classList.add('hidden');
}

function handleFixTimetableFromWarning() {
  closeUnassignedTimetableModal();
  if (typeof closeTodayScheduleModal === 'function') {
    closeTodayScheduleModal();
  }
  if (typeof closeTodayMarkedModal === 'function') {
    closeTodayMarkedModal();
  }
  openMyTimetable();
}

// Close unassigned timetable modal and schedule modals on Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeUnassignedTimetableModal();
    if (typeof closeTodayScheduleModal === 'function') closeTodayScheduleModal();
    if (typeof closeTodayMarkedModal === 'function') closeTodayMarkedModal();
  }
});

// ================= TAB NAVIGATION =================
async function selectTab(tab) {
  triggerNavHaptic('medium');

  if (tab === 'attendance') {
    if (checkingAttendanceAccess) return false;
    checkingAttendanceAccess = true;
    try {
      const unassignedData = await checkUnassignedTimetableForAttendance();
      if (unassignedData) {
        showUnassignedTimetableModal(unassignedData);
        return false;
      }
    } catch (err) {
      console.warn('[Attendance Access Check Error]', err);
    } finally {
      checkingAttendanceAccess = false;
    }
  }

  if (currentUser && currentUser.role === 'student' && tab !== 'student-portal') {
    tab = 'student-portal';
  }

  const isStudent = (currentUser && currentUser.role === 'student') || tab === 'student-portal' || isStudentPortalActive();
  const bottomNav = document.getElementById('app-bottom-nav');
  const studentBottomNav = document.getElementById('student-bottom-nav');
  const headerGuideBtn = document.getElementById('header-guide-btn');
  const headerNotifBtn = document.getElementById('header-notif-btn');

  if (isStudent) {
    if (bottomNav) bottomNav.classList.add('hidden');
    if (studentBottomNav) studentBottomNav.classList.remove('hidden');
    if (headerGuideBtn) headerGuideBtn.classList.add('hidden');
    if (headerNotifBtn) headerNotifBtn.classList.add('hidden');
  } else {
    if (bottomNav) bottomNav.classList.remove('hidden');
    if (studentBottomNav) studentBottomNav.classList.add('hidden');
    if (typeof applyHeaderButtonPreference === 'function') {
      applyHeaderButtonPreference();
    } else if (headerGuideBtn) {
      headerGuideBtn.classList.remove('hidden');
    }
    if (headerNotifBtn) headerNotifBtn.classList.remove('hidden');
  }

  if (currentActiveTab !== tab) {
    previousAppTab = currentActiveTab;
    currentActiveTab = tab;
  }
  const allViews = ['home', 'attendance', 'report', 'settings', 'classes', 'subjects', 'students', 'teachers', 'admin', 'edit-profile', 'teacher-log', 'timetable', 'messages', 'workspace', 'student-portal', 'outcomers'];
  allViews.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`view-${tab}`);
  if (activeEl) activeEl.classList.remove('hidden');

  // Revert pink theme when leaving workspace
  if (tab !== 'workspace' && typeof revertPinkTheme === 'function' && typeof pwActive !== 'undefined' && pwActive) {
    revertPinkTheme();
  }

  // Update 4 bottom navigation tabs: home, attendance, report, settings
  const mainTabs = ['home', 'attendance', 'report', 'settings'];
  mainTabs.forEach(t => {
    const btn = document.getElementById(`bottom-tab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = "flex-1 flex flex-col items-center justify-center py-1 text-[#245b70] dark:text-cyan-400 font-black tab-transition scale-105";
      } else {
        btn.className = "flex-1 flex flex-col items-center justify-center py-1 text-[var(--text-sub)] hover:text-[#245b70] font-medium tab-transition";
      }
    }
  });

  // Backward compatibility for old top tabs if present
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

  // Subview / Tab loaders
  if (tab === 'home') {
    loadHomeDashboard();
  } else if (tab === 'attendance') {
    if (currentClass) {
      loadAttendanceRoster();
    } else {
      renderAttendancePlaceholder();
    }
  } else if (tab === 'report') {
    if (reportReadyToLoad) loadReport();
    else renderReportPlaceholder();
  } else if (tab === 'settings') {
    updateUserUI();
    loadActivityLogs();
    updateProfileDashboardKPIs();
  } else if (tab === 'classes') {
    loadClasses();
    renderClassesList();
  } else if (tab === 'subjects') {
    loadSubjects();
    renderSubjectsList();
  } else if (tab === 'students') {
    renderStudentsDirectory();
  } else if (tab === 'teachers') {
    renderTeachersList();
  } else if (tab === 'admin') {
    loadAdminTeachersList();
    const mainViewport = document.querySelector('main');
    if (mainViewport) mainViewport.scrollTop = 0;
  } else if (tab === 'timetable') {
    if (typeof renderTimetableSlots === 'function') renderTimetableSlots();
    const mainViewport = document.querySelector('main');
    if (mainViewport) mainViewport.scrollTop = 0;
  } else if (tab === 'messages') {
    if (typeof loadMessages === 'function') loadMessages();
    const mainViewport = document.querySelector('main');
    if (mainViewport) mainViewport.scrollTop = 0;
  } else if (tab === 'teacher-log' || tab === 'edit-profile') {
    const mainViewport = document.querySelector('main');
    if (mainViewport) mainViewport.scrollTop = 0;
  } else if (tab === 'student-portal') {
    if (typeof initStudentPortal === 'function') initStudentPortal();
    const mainViewport = document.querySelector('main');
    if (mainViewport) mainViewport.scrollTop = 0;
  } else if (tab === 'outcomers') {
    if (typeof loadOutcomers === 'function') loadOutcomers();
    const mainViewport = document.querySelector('main');
    if (mainViewport) mainViewport.scrollTop = 0;
  }

  return true;
}

// Backward compatibility aliases
function selectTopTab(tab) {
  selectTab(tab);
}

function selectBottomTab(tab) {
  selectTab(tab);
}

// ================= HOME / SCHOOL DASHBOARD MODULE =================
async function loadHomeDashboard() {
  updateWelcomeGreeting();
  populateQuickAttendanceDropdowns();
  updateProfileDashboardKPIs();
  await Promise.allSettled([
    loadDashboardStats()
  ]);
}

function updateWelcomeGreeting() {
  const greetingEl = document.getElementById('welcome-greeting');
  const userEl = document.getElementById('welcome-user-name');
  const academicYearEl = document.getElementById('dashboard-academic-year');
  const dayNameEl = document.getElementById('dashboard-day-name');
  const dateBadgeEl = document.getElementById('dashboard-date-text');
  const qaDateEl = document.getElementById('quick-att-date-display');

  const now = new Date();
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayDay = dayNames[now.getDay()];

  if (academicYearEl) {
    const yr = (appSettings && (appSettings.currentAcademicYear || appSettings.academicYear))
      ? (appSettings.currentAcademicYear || appSettings.academicYear)
      : `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`;
    academicYearEl.textContent = `Academic Year ${yr}`;
  }
  if (dayNameEl) {
    dayNameEl.textContent = todayDay;
  }

  const hour = now.getHours();
  let greeting = 'Good Morning';
  if (hour >= 12 && hour < 17) {
    greeting = 'Good Afternoon';
  } else if (hour >= 17 || hour < 5) {
    greeting = 'Good Evening';
  }

  if (greetingEl) greetingEl.textContent = greeting;
  if (userEl) userEl.textContent = (currentUser && currentUser.name) ? currentUser.name : 'Ustadh';

  const dateOpts = { weekday: 'short', day: 'numeric', month: 'short' };
  const formattedDate = now.toLocaleDateString(undefined, dateOpts);
  if (dateBadgeEl) dateBadgeEl.textContent = `Live Sync • ${formattedDate}`;
  if (qaDateEl) qaDateEl.textContent = formattedDate;
}

// Alias for backwards compatibility
function renderDashboardGreetings() {
  updateWelcomeGreeting();
}

function populateQuickAttendanceDropdowns() {
  const qaClass = document.getElementById('quick-att-class');
  const qaSubject = document.getElementById('quick-att-subject');
  if (!qaClass || !qaSubject) return;

  const currentVal = qaClass.value;
  const isTeacher = currentUser && currentUser.role !== 'admin';
  const validClasses = isTeacher ? getTeacherAllowedClasses() : (classesList || []);
  let html = `<option value="">-- Select Class --</option>`;
  validClasses.forEach(c => {
    const isSel = c.name === currentVal ? 'selected' : '';
    html += `<option value="${escapeHtml(c.name)}" ${isSel}>${escapeHtml(c.name)}</option>`;
  });
  qaClass.innerHTML = html;

  handleQuickAttendanceClassChange();
}

function handleQuickAttendanceClassChange() {
  const qaClass = document.getElementById('quick-att-class');
  const qaSubject = document.getElementById('quick-att-subject');
  if (!qaClass || !qaSubject) return;

  const selectedClass = qaClass.value;
  if (!selectedClass) {
    qaSubject.innerHTML = `<option value="">-- Select Subject --</option>`;
    return;
  }

  const isTeacher = currentUser && currentUser.role !== 'admin';
  if (isTeacher) {
    const { teacherSubs, isCT } = getTeacherAllowedSubjectsForClass(selectedClass);
    if (teacherSubs.length > 0) {
      qaSubject.innerHTML = teacherSubs.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    } else if (isCT) {
      qaSubject.innerHTML = `<option value="General">General (Class Teacher)</option>`;
    } else {
      qaSubject.innerHTML = `<option value="" disabled selected>No subjects assigned</option>`;
    }
  } else {
    const validSubjects = getAppropriateSubjectsForClass(selectedClass);
    if (validSubjects && validSubjects.length > 0) {
      qaSubject.innerHTML = validSubjects.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    } else {
      qaSubject.innerHTML = `<option value="General">General</option>`;
    }
  }
}

async function handleStartQuickAttendance() {
  const qaClass = document.getElementById('quick-att-class');
  const qaSubject = document.getElementById('quick-att-subject');
  const selectedClass = qaClass ? qaClass.value : '';
  const selectedSubject = qaSubject ? qaSubject.value : '';

  if (!selectedClass) {
    showToast('Please select a class first', true);
    return;
  }

  attendanceReadyToLoad = true;
  currentClass = selectedClass;
  const selClass = document.getElementById('sel-class');
  if (selClass) {
    const matchOpt = Array.from(selClass.options).find(opt => isClassEqual(opt.value, selectedClass));
    if (matchOpt) {
      selClass.value = matchOpt.value;
      currentClass = matchOpt.value;
    } else {
      const newOpt = document.createElement('option');
      newOpt.value = selectedClass;
      newOpt.textContent = selectedClass;
      selClass.appendChild(newOpt);
      selClass.value = selectedClass;
    }
  }

  updateAttendanceSubjectsDropdown(currentClass, selectedSubject);
  const selSubject = document.getElementById('sel-subject');
  if (selSubject && selectedSubject) {
    const matchSub = Array.from(selSubject.options).find(opt => isClassEqual(opt.value, selectedSubject));
    if (matchSub) {
      selSubject.value = matchSub.value;
      currentSubject = matchSub.value;
    } else {
      const newOpt = document.createElement('option');
      newOpt.value = selectedSubject;
      newOpt.textContent = selectedSubject;
      selSubject.appendChild(newOpt);
      selSubject.value = selectedSubject;
      currentSubject = selectedSubject;
    }
  }

  const ok = await selectTab('attendance');
  if (!ok) return;
  await loadAttendanceRoster();
  showToast(`Attendance ready for ${selectedClass} • ${selectedSubject || currentSubject}`);
}

async function loadDashboardStats() {
  try {
    const stEl = document.getElementById('dash-stat-students');
    const stInEl = document.getElementById('dash-stat-students-in');
    const stOutEl = document.getElementById('dash-stat-students-out');
    const tcEl = document.getElementById('dash-stat-teachers');
    const tcActEl = document.getElementById('dash-stat-teachers-active');
    const clEl = document.getElementById('dash-stat-classes');
    const clMarkedEl = document.getElementById('dash-stat-classes-marked');

    // Campus Overview: public classes only
    const totalClasses = (classesList || []).filter(c => !c.isPrivate).length;
    if (clEl) clEl.textContent = String(totalClasses);
    
    // Total Teachers
    let teacherCount = (cachedTeachersList || []).length;
    if (teacherCount === 0) {
      try {
        const tRes = await API.getTeachers();
        if (tRes && tRes.success && Array.isArray(tRes.data)) {
          cachedTeachersList = tRes.data;
          teacherCount = tRes.data.length;
        }
      } catch (_) {}
    }
    if (tcEl) tcEl.textContent = String(teacherCount);
    if (tcActEl) tcActEl.textContent = '100% Active';

    // Total Students from API — CAMPUS OVERVIEW: public only (exclude private workspace)
    let totalStudents = 0;
    try {
      const res = await API.getStudents('all');
      const studentData = (res && res.success && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
      // Only count public (non-private) students in campus overview
      const publicStudents = studentData.filter(s => !s.isPrivate);
      totalStudents = publicStudents.length;
      if (stEl) stEl.textContent = String(totalStudents);
    } catch (_) {}

    // Calculate In / Out for students & marked classes
    try {
      const now = new Date();
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const logs = cachedActivityLogs || [];
      const markedClassesSet = new Set();
      logs.forEach(log => {
        if (log.action && log.action.toLowerCase().includes('attendance')) {
          const logDate = log.timestamp || log.createdAt;
          if (logDate && String(logDate).startsWith(todayDateStr)) {
            if (log.targetClass) markedClassesSet.add(log.targetClass);
            else if (log.details && typeof log.details === 'string') {
              const match = log.details.match(/Class\s*([A-Za-z0-9_\-]+)/i);
              if (match) markedClassesSet.add(match[1]);
            }
          }
        }
      });

      const markedCount = markedClassesSet.size;
      if (clMarkedEl) clMarkedEl.textContent = `${markedCount} Marked`;

      if (stInEl && stOutEl) {
        if (totalStudents > 0) {
          const inCount = Math.max(0, totalStudents - (markedCount > 0 ? 1 : 0));
          const outCount = totalStudents - inCount;
          stInEl.textContent = `${inCount} In`;
          stOutEl.textContent = `${outCount} Out`;
        } else {
          stInEl.textContent = `0 In`;
          stOutEl.textContent = `0 Out`;
        }
      }
    } catch (_) {}
  } catch (e) {
    console.log('[Dashboard Stats Error]', e);
  }
}

async function loadDashboardTimetable() {
  const container = document.getElementById('dash-today-timetable-container');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-page)]">
        <p class="text-xs text-[var(--text-sub)] font-medium">Please sign in to view your scheduled timetable</p>
      </div>`;
    return;
  }

  try {
    const myEmail = (currentUser.email || '').trim().toLowerCase();
    const isAdmin = currentUser.role === 'admin';
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()].toLowerCase();

    const ttRes = await API.getTimetable('', '', myEmail);
    const allSlots = (ttRes && ttRes.data) ? ttRes.data : (Array.isArray(ttRes) ? ttRes : []);
    let mySlots = allSlots.filter(s => (s.teacherEmail || '').trim().toLowerCase() === myEmail);
    if (isAdmin && mySlots.length === 0) {
      mySlots = allSlots;
    }

    const todaySlots = mySlots.filter(s => {
      const d = (s.day || '').trim().toLowerCase();
      const days = Array.isArray(s.days) ? s.days.map(x => x.trim().toLowerCase()) : [];
      const splitDays = d.split(',').map(x => x.trim().toLowerCase());
      return d === todayName || d === 'all days' || splitDays.includes(todayName) || days.includes(todayName) || days.includes('all days');
    });

    if (todaySlots.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 px-4 rounded-xl border border-dashed border-[#245b70]/30 bg-white/70 dark:bg-slate-900/50 shadow-xs">
          <svg class="w-8 h-8 mx-auto text-[#245b70]/60 dark:text-cyan-400/60 mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <div class="text-xs font-bold text-[var(--text-main)]">No classes scheduled for today</div>
          <p class="text-[10px] text-[var(--text-sub)] mt-0.5">Enjoy your free time or prepare for upcoming classes</p>
        </div>`;
      return;
    }

    const currentMin = now.getHours() * 60 + now.getMinutes();

    const slotsWithTiming = todaySlots.map(s => {
      const range = _parseSlotTimeRange(s.timeSlot || s.time);
      let status = 'upcoming';
      if (range && range.startMin !== null && range.endMin !== null) {
        if (currentMin >= range.startMin && currentMin < range.endMin) {
          status = 'live';
        } else if (currentMin >= range.endMin) {
          status = 'completed';
        } else {
          status = 'upcoming';
        }
      }
      return { slot: s, range, status, startMin: range ? range.startMin : 9999 };
    }).sort((a, b) => a.startMin - b.startMin);

    container.innerHTML = slotsWithTiming.map(item => {
      const s = item.slot;
      const timeStr = s.timeSlot || s.time || 'Scheduled Time';
      const isLive = item.status === 'live';
      const isCompleted = item.status === 'completed';

      let statusBadge = '';
      let cardStyle = '';

      if (isLive) {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-sm animate-pulse"><span class="w-1.5 h-1.5 rounded-full bg-white"></span>Live Now</span>`;
        cardStyle = `bg-white dark:bg-slate-900 border-2 border-[#245b70] dark:border-cyan-400 shadow-md ring-2 ring-[#245b70]/15`;
      } else if (isCompleted) {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">✓ Completed</span>`;
        cardStyle = `bg-white/60 dark:bg-slate-900/40 border border-[#245b70]/15 opacity-75`;
      } else {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Upcoming</span>`;
        cardStyle = `bg-white/95 dark:bg-slate-900/85 border border-[#245b70]/20 hover:border-[#245b70]/50 shadow-xs`;
      }

      return `
        <div class="p-3 rounded-xl flex items-center justify-between gap-3 ${cardStyle} transition">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl ${isLive ? 'bg-emerald-500 text-white' : 'bg-slate-200/70 dark:bg-slate-700 text-[var(--text-main)]'} flex flex-col items-center justify-center flex-shrink-0 text-center font-bold">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h5 class="text-xs sm:text-sm font-black text-[var(--text-main)] truncate">${escapeHtml(s.subject || 'Class')}</h5>
                ${statusBadge}
              </div>
              <div class="text-[11px] text-[var(--text-sub)] flex items-center gap-2 mt-0.5 truncate">
                <span class="font-bold text-[#245b70] dark:text-cyan-400">${escapeHtml(s.class ? 'Class ' + s.class : '')}</span>
                <span>•</span>
                <span>${escapeHtml(timeStr)}</span>
              </div>
            </div>
          </div>
          ${!isCompleted ? `
            <button type="button" onclick="startAttendanceFromTimetable('${escapeHtml(s.class || '')}', '${escapeHtml(s.subject || '')}')" class="flex-shrink-0 touch-btn px-2.5 py-1.5 rounded-lg ${isLive ? 'bg-[#245b70] text-white font-black' : 'bg-[var(--card-bg)] text-[#245b70] dark:text-cyan-400 font-bold border border-[var(--border-color)]'} text-[11px] hover:scale-105 active:scale-95 transition">
              Mark
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  } catch (e) {
    console.log('[Dashboard Timetable Error]', e);
    container.innerHTML = `
      <div class="text-center py-4 px-2 text-xs text-rose-500 font-semibold">
        Could not load today's timetable.
      </div>`;
  }
}

async function startAttendanceFromTimetable(className, subjectName) {
  if (!className) {
    showToast('Class is not specified in this timetable slot', true);
    return;
  }

  attendanceReadyToLoad = true;
  currentClass = className;
  const selClass = document.getElementById('sel-class');
  if (selClass) {
    const matchOpt = Array.from(selClass.options).find(opt => isClassEqual(opt.value, className));
    if (matchOpt) {
      selClass.value = matchOpt.value;
      currentClass = matchOpt.value;
    } else {
      const newOpt = document.createElement('option');
      newOpt.value = className;
      newOpt.textContent = className;
      selClass.appendChild(newOpt);
      selClass.value = className;
    }
  }

  updateAttendanceSubjectsDropdown(currentClass, subjectName);
  const selSubject = document.getElementById('sel-subject');
  if (selSubject && subjectName) {
    const matchSub = Array.from(selSubject.options).find(opt => isClassEqual(opt.value, subjectName));
    if (matchSub) {
      selSubject.value = matchSub.value;
      currentSubject = matchSub.value;
    } else {
      const newOpt = document.createElement('option');
      newOpt.value = subjectName;
      newOpt.textContent = subjectName;
      selSubject.appendChild(newOpt);
      selSubject.value = subjectName;
      currentSubject = subjectName;
    }
  }

  const ok = await selectTab('attendance');
  if (!ok) return;

  loadAttendanceRoster();
  showToast(`Attendance ready for ${className} • ${subjectName || currentSubject}`);
}

// Account Settings Handlers
function openChangePasswordModal() {
  const modal = document.getElementById('modal-change-password');
  if (modal) {
    const cur = document.getElementById('input-current-password');
    const np = document.getElementById('input-new-password');
    const cp = document.getElementById('input-confirm-password');
    if (cur) cur.value = '';
    if (np) np.value = '';
    if (cp) cp.value = '';
    modal.classList.remove('hidden');
  }
}

function closeChangePasswordModal() {
  const modal = document.getElementById('modal-change-password');
  if (modal) modal.classList.add('hidden');
}

async function handleChangePassword(e) {
  e.preventDefault();
  const curPass = document.getElementById('input-current-password')?.value;
  const newPass = document.getElementById('input-new-password')?.value;
  const confPass = document.getElementById('input-confirm-password')?.value;
  const btn = document.getElementById('btn-save-password');

  if (!newPass || newPass.length < 6) {
    showToast('New password must be at least 6 characters', true);
    return;
  }
  if (newPass !== confPass) {
    showToast('New passwords do not match', true);
    return;
  }

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }
    const res = await API.changePassword(curPass, newPass);
    if (res.success) {
      showToast(res.message || 'Password changed successfully!');
      closeChangePasswordModal();
    }
  } catch (err) {
    showToast(err.message || 'Failed to update password', true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }
  }
}

function openNotificationSettingsModal() {
  const modal = document.getElementById('modal-notification-settings');
  if (modal) {
    const tMorning = document.getElementById('user-notif-morning');
    const tPreclass = document.getElementById('user-notif-preclass');
    const tVibrate = document.getElementById('user-notif-vibrate');
    if (tMorning) tMorning.checked = localStorage.getItem('admin_notif_morning') !== 'false';
    if (tPreclass) tPreclass.checked = localStorage.getItem('admin_notif_preclass') !== 'false';
    if (tVibrate) tVibrate.checked = localStorage.getItem('admin_notif_vibrate') !== 'false';
    modal.classList.remove('hidden');
  }
}

function closeNotificationSettingsModal() {
  const modal = document.getElementById('modal-notification-settings');
  if (modal) modal.classList.add('hidden');
}

function openLanguageSettingsModal() {
  const modal = document.getElementById('modal-language-settings');
  if (modal) {
    const lang = (typeof getAppLanguage === 'function') ? getAppLanguage() : (localStorage.getItem('app_language') || 'en');
    if (typeof updateLanguageModalUI === 'function') {
      updateLanguageModalUI(lang);
    }
    modal.classList.remove('hidden');
  }
}

function closeLanguageSettingsModal() {
  const modal = document.getElementById('modal-language-settings');
  if (modal) modal.classList.add('hidden');
}

function selectAppLanguage(lang) {
  if (typeof setAppLanguage === 'function') {
    setAppLanguage(lang);
  } else if (typeof applyTranslations === 'function') {
    applyTranslations(lang);
    const toastMsg = lang === 'ml' ? 'ഭാഷ മലയാളത്തിലേക്ക് മാറ്റി' : 'Language changed to English';
    if (typeof showToast === 'function') {
      showToast(toastMsg);
    }
  } else {
    try { localStorage.setItem('app_language', lang); } catch(_) {}
    document.documentElement.lang = lang;
  }

  setTimeout(() => {
    closeLanguageSettingsModal();
  }, 180);
}

// Modal triggers
async function openClassModal() {
  document.getElementById('input-class-name').value = '';
  await populateTeacherDropdowns('input-class-teacher', '');
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
  updateAuthModalPortalUI();
  clearAuthAlert();
  renderGoogleButton();
}

function closeAuthModal(force = false) {
  if (!force && !currentUser) {
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
    const res = await API.googleLogin({ access_token: tokenResponse.access_token, portal: authPortalRole, role: authPortalRole });
    if (res.success && res.user) {
      currentUser = res.user;
      currentRole = res.user.role;
      updateUserUI();
      closeAuthModal(true);
      showToast(res.message || `Welcome, ${res.user.name}!`);

      const inStudentPortal = isStudentPortalActive() || authPortalRole === 'student' || res.user.role === 'student';
      if (inStudentPortal) {
        sessionStorage.setItem('registerly_active_portal', 'student');
        selectTab('student-portal');
        await initStudentPortal();
        hideSplashLoader();
        return;
      }

      sessionStorage.setItem('registerly_active_portal', 'teacher');
      selectTab('home');

      // Show animation during loading (no dashboard preview)
      showSplashLoader('Signing in & setting up portal...');

      try {
        await loadCurrentUser();
        await loadAppSettings();
        await loadClasses();
        await loadSubjects();
        await loadTeachersData();
        await loadAttendanceRoster();
        await loadReport();
        await loadActivityLogs();
        _applyTeachersTabVisibility();
        await loadHomeDashboard();
        proceedAppWorkflowSequence();
      } catch (postSyncErr) {
        console.warn('[Google Post-Login Sync Warning]', postSyncErr);
      }
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
    const res = await API.googleLogin({ credential: response.credential, portal: authPortalRole, role: authPortalRole });
    if (res.success && res.user) {
      currentUser = res.user;
      currentRole = res.user.role;
      updateUserUI();
      closeAuthModal(true);
      showToast(res.message || `Welcome, ${res.user.name}!`);

      const inStudentPortal = isStudentPortalActive() || authPortalRole === 'student' || res.user.role === 'student';
      if (inStudentPortal) {
        sessionStorage.setItem('registerly_active_portal', 'student');
        selectTab('student-portal');
        await initStudentPortal();
        hideSplashLoader();
        return;
      }

      sessionStorage.setItem('registerly_active_portal', 'teacher');
      selectTab('home');

      // Show animation during loading (no dashboard preview)
      showSplashLoader('Signing in & setting up portal...');

      try {
        await loadCurrentUser();
        await loadAppSettings();
        await loadClasses();
        await loadSubjects();
        await loadTeachersData();
        await loadAttendanceRoster();
        await loadReport();
        await loadActivityLogs();
        _applyTeachersTabVisibility();
        await loadHomeDashboard();
        proceedAppWorkflowSequence();
      } catch (postSyncErr) {
        console.warn('[Google Post-Login Sync Warning]', postSyncErr);
      }
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
    const res = await API.login(email, password, { portal: authPortalRole });
    if (res.success && res.user) {
      currentUser = res.user;
      currentRole = res.user.role;
      updateUserUI();
      closeAuthModal(true);
      showToast(res.message || `Welcome back, ${res.user.name}!`);

      const inStudentPortal = isStudentPortalActive() || authPortalRole === 'student' || res.user.role === 'student';
      if (inStudentPortal) {
        sessionStorage.setItem('registerly_active_portal', 'student');
        selectTab('student-portal');
        await initStudentPortal();
        hideSplashLoader();
        return;
      }

      sessionStorage.setItem('registerly_active_portal', 'teacher');
      selectTab('home');

      // Show animation during loading (no dashboard preview)
      showSplashLoader('Signing in & setting up portal...');

      try {
        await loadCurrentUser();
        await loadAppSettings();
        await loadClasses();
        await loadSubjects();
        await loadTeachersData();
        await loadAttendanceRoster();
        await loadReport();
        await loadActivityLogs();
        _applyTeachersTabVisibility();
        await loadHomeDashboard();
        proceedAppWorkflowSequence();
      } catch (postSyncErr) {
        console.warn('[Email Post-Login Sync Warning]', postSyncErr);
      }
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
    const res = await API.register(name, email, password, { portal: authPortalRole, role: authPortalRole });
    if (res.success && res.user) {
      currentUser = res.user;
      currentRole = res.user.role;
      updateUserUI();
      closeAuthModal(true);
      showToast(res.message || 'Account created successfully!');

      const inStudentPortal = isStudentPortalActive() || authPortalRole === 'student' || res.user.role === 'student';
      if (inStudentPortal) {
        sessionStorage.setItem('registerly_active_portal', 'student');
        selectTab('student-portal');
        await initStudentPortal();
        hideSplashLoader();
        return;
      }

      sessionStorage.setItem('registerly_active_portal', 'teacher');
      selectTab('home');

      // Show animation during loading (no dashboard preview)
      showSplashLoader('Creating account & setting up portal...');

      try {
        await loadCurrentUser();
        await loadAppSettings();
        await loadClasses();
        await loadSubjects();
        await loadTeachersData();
        await loadAttendanceRoster();
        await loadReport();
        await loadActivityLogs();
        _applyTeachersTabVisibility();
        await loadHomeDashboard();
        proceedAppWorkflowSequence();
      } catch (postSyncErr) {
        console.warn('[Register Post-Login Sync Warning]', postSyncErr);
      }
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
  selectTab('home');
  loadHomeDashboard();
  const bubbleModal = document.getElementById('notif-bubble-timetable-modal');
  if (bubbleModal) bubbleModal.classList.add('hidden');
  const preclassCard = document.getElementById('notif-preclass-card');
  if (preclassCard) preclassCard.classList.add('hidden');
  const langModal = document.getElementById('modal-first-language-select');
  if (langModal) langModal.classList.add('hidden');
  const guideModal = document.getElementById('modal-app-guide');
  if (guideModal) guideModal.classList.add('hidden');
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
    const label = t.email ? `${t.name} (${t.email})` : t.name;
    optionsHtml += `<option value="${escapeHtml(t.name)}" data-email="${escapeHtml(t.email || '')}" ${isSel}>${escapeHtml(label)}</option>`;
  });

  // If previous custom value exists, keep it selectable
  if (selectedValue && !cachedTeachersList.some(t => t.name === selectedValue || t.email === selectedValue)) {
    optionsHtml += `<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)}</option>`;
  }

  selectEl.innerHTML = optionsHtml;
}



// Generate friendly fallback avatar (theme color rounded square)
function getEmailAvatarPreview(email, name = '') {
  const label = (name || email || 'Teacher').trim();
  return getInitialsAvatar(label, '245b70', 'ffffff', true);
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

// ================================================================
// TEACHER DRAG & DROP SORTING (Only active after long press / hold or drag handle)
// ================================================================
let draggedTeacherIndex = null;
let touchDraggedTeacherIndex = null;
let touchTeacherElement = null;
let recentlyPlacedTeacherId = null;
let teacherHoldTimer = null;
let teacherHoldActive = false;
let teacherHoldStartX = 0;
let teacherHoldStartY = 0;

function handleTeacherPointerDown(e, index) {
  if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
  const card = e.currentTarget;
  teacherHoldActive = false;
  teacherHoldStartX = e.clientX || 0;
  teacherHoldStartY = e.clientY || 0;

  if (teacherHoldTimer) clearTimeout(teacherHoldTimer);
  teacherHoldTimer = setTimeout(() => {
    teacherHoldActive = true;
    card.setAttribute('draggable', 'true');
    card.classList.add('drag-activated');
    triggerNavHaptic('medium');
  }, 250);
}

function handleTeacherPointerMove(e) {
  if (!teacherHoldTimer && !teacherHoldActive) return;
  const currentX = e.clientX || 0;
  const currentY = e.clientY || 0;
  const diffX = Math.abs(currentX - teacherHoldStartX);
  const diffY = Math.abs(currentY - teacherHoldStartY);

  if (!teacherHoldActive && (diffX > 8 || diffY > 8)) {
    if (teacherHoldTimer) {
      clearTimeout(teacherHoldTimer);
      teacherHoldTimer = null;
    }
  }
}

function handleTeacherPointerUp(e) {
  if (teacherHoldTimer) {
    clearTimeout(teacherHoldTimer);
    teacherHoldTimer = null;
  }
  teacherHoldActive = false;
  const card = e.currentTarget;
  if (card) {
    card.classList.remove('drag-activated');
    card.setAttribute('draggable', 'false');
  }
}

function handleTeacherDragStart(e, index) {
  const fromHandle = Boolean(e.target.closest('.drag-handle'));
  if (!teacherHoldActive && !fromHandle) {
    e.preventDefault();
    return;
  }
  const searchInput = document.getElementById('teacher-search-input');
  if (searchInput && searchInput.value.trim()) {
    e.preventDefault();
    showToast('Clear search filter to reorder teachers');
    return;
  }
  draggedTeacherIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  try {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'teacher', index }));
  } catch (_) {}
  e.currentTarget.classList.add('dragging');
  triggerNavHaptic('light');
}

function handleTeacherDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.currentTarget;
  if (!item.classList.contains('drag-over') && draggedTeacherIndex !== index) {
    item.classList.add('drag-over');
  }
}

function handleTeacherDragLeave(e) {
  const item = e.currentTarget;
  if (!item.contains(e.relatedTarget)) {
    item.classList.remove('drag-over');
  }
}

function handleTeacherDragEnd(e) {
  if (teacherHoldTimer) {
    clearTimeout(teacherHoldTimer);
    teacherHoldTimer = null;
  }
  teacherHoldActive = false;
  draggedTeacherIndex = null;
  document.querySelectorAll('#teachers-cards-container .drag-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over', 'drag-activated');
    el.setAttribute('draggable', 'false');
  });
}

async function handleTeacherDrop(e, targetIndex) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  let sourceIndex = draggedTeacherIndex;
  if (sourceIndex === null) {
    const rawData = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
    if (rawData !== null && rawData !== '') {
      sourceIndex = parseInt(rawData, 10);
    }
  }

  handleTeacherDragEnd(e);

  if (sourceIndex === null || isNaN(sourceIndex) || sourceIndex === targetIndex) return;
  if (!cachedTeachersList || cachedTeachersList.length <= 1) return;

  const movedTeacher = cachedTeachersList.splice(sourceIndex, 1)[0];
  if (!movedTeacher) return;
  cachedTeachersList.splice(targetIndex, 0, movedTeacher);

  recentlyPlacedTeacherId = movedTeacher._id;
  triggerNavHaptic('strong');

  renderTeachersList(true);

  setTimeout(() => {
    if (recentlyPlacedTeacherId === movedTeacher._id) {
      recentlyPlacedTeacherId = null;
      document.querySelectorAll('#teachers-cards-container .drag-item-placed').forEach(el => {
        el.classList.remove('drag-item-placed');
      });
    }
  }, 600);

  try {
    const orderedIds = cachedTeachersList.map(t => t._id);
    await API.reorderTeachers(orderedIds);
    showToast('Teacher order updated!');
  } catch (err) {
    console.error('[Reorder Teachers Error]', err);
    showToast('Failed to save teacher order', true);
  }
}

function handleTeacherContainerDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleTeacherContainerDrop(e) {
  if (e.target.closest('.drag-item')) return;
  e.preventDefault();
  if (draggedTeacherIndex === null || !cachedTeachersList) return;
  handleTeacherDrop(e, Math.max(0, cachedTeachersList.length - 1));
}

// Mobile & Tablet Touch Long-Press Hold-to-Drag for Teachers
function handleTeacherTouchStart(e, index) {
  if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
  const searchInput = document.getElementById('teacher-search-input');
  if (searchInput && searchInput.value.trim()) return;

  const touch = e.touches[0];
  teacherHoldStartX = touch.clientX;
  teacherHoldStartY = touch.clientY;
  teacherHoldActive = false;
  touchDraggedTeacherIndex = null;
  touchTeacherElement = e.currentTarget;

  const handle = e.target.closest('.drag-handle');
  if (handle) {
    teacherHoldActive = true;
    touchDraggedTeacherIndex = index;
    if (touchTeacherElement) {
      touchTeacherElement.classList.add('drag-activated', 'dragging');
    }
    triggerNavHaptic('medium');
    return;
  }

  if (teacherHoldTimer) clearTimeout(teacherHoldTimer);
  teacherHoldTimer = setTimeout(() => {
    teacherHoldActive = true;
    touchDraggedTeacherIndex = index;
    if (touchTeacherElement) {
      touchTeacherElement.classList.add('drag-activated', 'dragging');
    }
    triggerNavHaptic('medium');
  }, 250);
}

function handleTeacherTouchMove(e) {
  const touch = e.touches[0];
  const diffX = Math.abs(touch.clientX - teacherHoldStartX);
  const diffY = Math.abs(touch.clientY - teacherHoldStartY);

  if (!teacherHoldActive) {
    if (diffX > 8 || diffY > 8) {
      if (teacherHoldTimer) {
        clearTimeout(teacherHoldTimer);
        teacherHoldTimer = null;
      }
    }
    return; // Allow native page scroll
  }

  // Active dragging after hold: prevent page scroll
  e.preventDefault();
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const card = target ? target.closest('#teachers-cards-container .drag-item') : null;

  document.querySelectorAll('#teachers-cards-container .drag-item').forEach(el => el.classList.remove('drag-over'));
  if (card && card !== touchTeacherElement) {
    card.classList.add('drag-over');
  }
}

async function handleTeacherTouchEnd(e) {
  if (teacherHoldTimer) {
    clearTimeout(teacherHoldTimer);
    teacherHoldTimer = null;
  }

  if (!teacherHoldActive || touchDraggedTeacherIndex === null) {
    teacherHoldActive = false;
    touchDraggedTeacherIndex = null;
    if (touchTeacherElement) {
      touchTeacherElement.classList.remove('drag-activated', 'dragging');
      touchTeacherElement = null;
    }
    return;
  }

  teacherHoldActive = false;
  const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  const target = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null;
  const card = target ? target.closest('#teachers-cards-container .drag-item') : null;

  const sourceIndex = touchDraggedTeacherIndex;
  touchDraggedTeacherIndex = null;
  if (touchTeacherElement) {
    touchTeacherElement.classList.remove('drag-activated', 'dragging');
    touchTeacherElement = null;
  }

  document.querySelectorAll('#teachers-cards-container .drag-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over', 'drag-activated');
  });

  if (card && cachedTeachersList && cachedTeachersList.length > 1) {
    const targetIdx = parseInt(card.getAttribute('data-index'), 10);
    if (!isNaN(targetIdx) && targetIdx !== sourceIndex) {
      const movedTeacher = cachedTeachersList.splice(sourceIndex, 1)[0];
      if (!movedTeacher) return;
      cachedTeachersList.splice(targetIdx, 0, movedTeacher);

      recentlyPlacedTeacherId = movedTeacher._id;
      triggerNavHaptic('strong');

      renderTeachersList(true);

      setTimeout(() => {
        if (recentlyPlacedTeacherId === movedTeacher._id) {
          recentlyPlacedTeacherId = null;
          document.querySelectorAll('#teachers-cards-container .drag-item-placed').forEach(el => {
            el.classList.remove('drag-item-placed');
          });
        }
      }, 600);

      try {
        const orderedIds = cachedTeachersList.map(t => t._id);
        await API.reorderTeachers(orderedIds);
        showToast('Teacher order updated!');
      } catch (err) {
        console.error('[Reorder Teachers Error]', err);
        showToast('Failed to save teacher order', true);
      }
    }
  }
}

const touchTeacherStart = handleTeacherTouchStart;
const touchTeacherMove = handleTeacherTouchMove;
const touchTeacherEnd = handleTeacherTouchEnd;

// USER DIRECTIVE: Render teachers cards in the 4th tab
async function renderTeachersList(skipFetch = false) {
  const container = document.getElementById('teachers-cards-container');
  const countEl = document.getElementById('teachers-count-total');
  const searchInput = document.getElementById('teacher-search-input');
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  try {
    if (!skipFetch || !cachedTeachersList) {
      await loadTeachersData();
    }
    let teachers = cachedTeachersList || [];

    if (countEl) countEl.innerText = teachers.length;

    if (searchTerm) {
      teachers = teachers.filter(t =>
        (t.name && t.name.toLowerCase().includes(searchTerm)) ||
        (t.email && t.email.toLowerCase().includes(searchTerm)) ||
        (() => {
          const tAss = getTeacherAssignments(t.name, t.email);
          return tAss.assignedClasses.some(c => c.toLowerCase().includes(searchTerm)) ||
                 tAss.assignedSubjects.some(s => s.toLowerCase().includes(searchTerm));
        })()
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

    container.innerHTML = teachers.map((t, index) => {
      const avatar = isCustomPhoto(t.avatarUrl) ? t.avatarUrl : getInitialsAvatar(t.name || t.email, '245b70', 'ffffff', true);
      const isPlaced = recentlyPlacedTeacherId && String(recentlyPlacedTeacherId) === String(t._id);
      const placedClass = isPlaced ? ' drag-item-placed' : '';
      const canManage = canUserEditDelete();
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

      const tAssign = getTeacherAssignments(t.name, t.email);
      const subjectsPills = tAssign.assignedSubjects.length > 0
        ? tAssign.assignedSubjects.map(s => `<span class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold text-xs shadow-sm">${escapeHtml(s)}</span>`).join(' ')
        : `<span class="text-xs text-[var(--text-sub)] italic">None assigned</span>`;

      const classesPills = tAssign.assignedClasses.length > 0
        ? tAssign.assignedClasses.map(c => `<span class="px-2 py-0.5 rounded-lg bg-[#245b70]/10 text-[#245b70] dark:bg-cyan-900/30 dark:text-cyan-300 border border-[#245b70]/20 dark:border-cyan-700/30 font-bold text-xs shadow-sm">${escapeHtml(c)}</span>`).join(' ')
        : `<span class="text-xs text-[var(--text-sub)] italic">None assigned</span>`;

      const totalAllTime = t.totalAllTimeSessions !== undefined ? t.totalAllTimeSessions : (t.sessionCount || 0);
      const currentSessions = t.sessionCount || 0;
      const sessionButtonLabel = selectedYear === 'all'
        ? `Report (${totalAllTime})`
        : `Report (${currentSessions} in ${selectedYear})`;

      return `
        <div id="teacher-card-${t._id}"
             data-index="${index}"
             data-id="${t._id}"
             class="drag-item bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col ${placedClass}"
             draggable="false"
             onmousedown="handleTeacherPointerDown(event, ${index})"
             onmousemove="handleTeacherPointerMove(event)"
             onmouseup="handleTeacherPointerUp(event)"
             onmouseleave="handleTeacherPointerUp(event)"
             ontouchstart="handleTeacherTouchStart(event, ${index})"
             ontouchmove="handleTeacherTouchMove(event)"
             ontouchend="handleTeacherTouchEnd(event)"
             ontouchcancel="handleTeacherTouchEnd(event)"
             ondragstart="handleTeacherDragStart(event, ${index})"
             ondragover="handleTeacherDragOver(event, ${index})"
             ondragleave="handleTeacherDragLeave(event)"
             ondragend="handleTeacherDragEnd(event)"
             ondrop="handleTeacherDrop(event, ${index})">
          <!-- Main row: avatar left, content right -->
          <div class="flex gap-0">
            <!-- Left: Avatar column -->
            <div class="flex-shrink-0 flex flex-col items-center justify-start pt-3.5 px-3 pb-3">
              <img src="${avatar}" alt="${escapeHtml(t.name)}" class="w-14 h-14 rounded-2xl object-cover border-2 border-[#245b70]/40 shadow-sm">
            </div>

            <!-- Right: Content column -->
            <div class="flex-1 min-w-0 pt-3 pb-3 pr-3 flex flex-col gap-2">

              <!-- Row 1: Name + role badge + google badge | Drag Handle + Edit + Delete -->
              <div class="flex items-start justify-between gap-1.5">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <h3 class="font-extrabold text-sm text-[var(--text-main)] leading-tight">${escapeHtml(t.name)}</h3>
                    ${roleBadge}
                  </div>
                  <div class="mt-0.5">${googleStatusBadge}</div>
                </div>
                ${canManage ? `
                <div class="flex items-center gap-1 flex-shrink-0">
                  <div class="drag-handle text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 flex-shrink-0 cursor-grab active:cursor-grabbing select-none transition" title="Hold card or drag handle to reorder">
                    <svg class="w-4 h-4 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5"></circle>
                      <circle cx="15" cy="6" r="1.5"></circle>
                      <circle cx="9" cy="12" r="1.5"></circle>
                      <circle cx="15" cy="12" r="1.5"></circle>
                      <circle cx="9" cy="18" r="1.5"></circle>
                      <circle cx="15" cy="18" r="1.5"></circle>
                    </svg>
                  </div>
                  <button onclick="openProfileEditPage('${t._id}')" title="Edit Teacher"
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
                <button onclick="openTeacherTimetable('${escapeQuotes(t.email || '')}', '${escapeQuotes(t.name || '')}')"
                  class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500 hover:text-white text-xs font-bold transition shadow-sm" title="View timetable">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <span>Timetable</span>
                </button>
                <button onclick="openTeacherLogModal('${t._id}')"
                  class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 hover:bg-[#245b70] hover:text-white text-xs font-bold transition shadow-sm" title="View teacher report & session logs">
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

          <!-- Classes strip -->
          <div class="border-t border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2 flex items-start gap-2">
            <span class="text-[10px] font-bold text-[#245b70] dark:text-cyan-400 uppercase tracking-wide pt-0.5 flex-shrink-0">Classes</span>
            <div class="flex flex-wrap gap-1 flex-1">${classesPills}</div>
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
  if (preview) preview.src = getInitialsAvatar('', '245b70', 'ffffff', true);

  document.getElementById('new-teacher-name').value = '';
  document.getElementById('new-teacher-email').value = '';

  

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
  

  if (!name) {
    showToast('Teacher name is required', true);
    return;
  }

  try {
    const res = await API.addTeacher({
      name,
      email,
      avatarUrl: newTeacherPhotoUrl,
      assignedClasses: [],
      assignedSubjects: []
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



async function handleUpdateTeacher(e) {
  e.preventDefault();
  if (!activeEditTeacherId) return;

  const name = document.getElementById('edit-teacher-name').value.trim();
  const email = document.getElementById('edit-teacher-email').value.trim();
  try {
    const res = await API.editTeacher(activeEditTeacherId, {
      name,
      email,
      avatarUrl: editTeacherPhotoUrl
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
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Remove Teacher',
        badge: 'Faculty',
        message: `Are you sure you want to remove teacher "${name}"?`,
        isDanger: true
      })
    : confirm(`Are you sure you want to remove teacher "${name}"?`);
  if (!confirmed) return;

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
  selectTab('teacher-log');
  const mainViewport = document.querySelector('main');
  if (mainViewport) mainViewport.scrollTop = 0;

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
      if (avatarEl) avatarEl.src = isCustomPhoto(teacher.avatarUrl) ? teacher.avatarUrl : getEmailAvatarPreview(teacher.email, teacher.name);

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

      // Assigned Classes & Subjects derived dynamically
      const classesWrap = document.getElementById('tlog-assigned-classes');
      const subjectsWrap = document.getElementById('tlog-assigned-subjects');
      const tLogAssign = getTeacherAssignments(teacher.name, teacher.email);
      if (classesWrap) {
        classesWrap.innerHTML = tLogAssign.assignedClasses.length > 0
          ? tLogAssign.assignedClasses.map(c => `<span class="px-2 py-0.5 rounded-lg bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 font-bold text-xs">${escapeHtml(c)}</span>`).join('')
          : `<span class="text-xs text-[var(--text-sub)] italic">None</span>`;
      }
      if (subjectsWrap) {
        subjectsWrap.innerHTML = tLogAssign.assignedSubjects.length > 0
          ? tLogAssign.assignedSubjects.map(s => `<span class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-xs">${escapeHtml(s)}</span>`).join('')
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
  currentTeacherLogData = null;
  currentTeacherSessions = [];
  goBackFromSubPage('settings');
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
    // Update header notification bell badge (badge moved from messages card to header bell)
    if (typeof updateNotifBadge === 'function') {
      updateNotifBadge(unreadCount);
    } else {
      const badge = document.getElementById('header-unread-msg-badge');
      if (badge) {
        badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
        if (unreadCount > 0) { badge.classList.remove('hidden'); badge.style.display = 'flex'; }
        else { badge.classList.add('hidden'); badge.style.display = ''; }
      }
    }
  } catch (err) {
    // silently fail - not critical
  }
}

function resolveSenderEmail(m) {
  if (!m) return '';
  if (m.senderEmail && m.senderEmail.trim()) return m.senderEmail.trim();
  if (m.senderId && typeof m.senderId === 'object' && m.senderId.email) return m.senderId.email.trim();
  const sName = (m.senderName || '').trim();
  if (typeof teachersList !== 'undefined' && Array.isArray(teachersList)) {
    const t = teachersList.find(tc => isNameEqual(tc.name, sName));
    if (t && t.email) return t.email.trim();
  }
  if (currentUser && isNameEqual(currentUser.name, sName) && currentUser.email) {
    return currentUser.email.trim();
  }
  return m.senderRole === 'admin' ? 'admin@school.internal' : '';
}

function getMessageFontSizeClass(text) {
  const len = (text || '').trim().length;
  // If chat is few: letters are big, very big! As letters increase, bigness decreases
  if (len <= 15) {
    return 'text-2xl sm:text-3xl font-black leading-snug tracking-tight';
  } else if (len <= 45) {
    return 'text-lg sm:text-xl font-extrabold leading-snug';
  } else if (len <= 95) {
    return 'text-base sm:text-lg font-bold leading-normal';
  } else if (len <= 180) {
    return 'text-sm sm:text-base font-semibold leading-relaxed';
  } else {
    return 'text-xs sm:text-sm font-medium leading-relaxed';
  }
}

async function openMessagesModal() {
  selectTab('messages');
  const mainViewport = document.querySelector('main');
  if (mainViewport) mainViewport.scrollTop = 0;
  await loadMessages();
  try { await API.markMessagesRead(); } catch(_) {}
  // Clear header notification bell badge on opening messages
  if (typeof updateNotifBadge === 'function') { updateNotifBadge(0); }
  else {
    const badge = document.getElementById('header-unread-msg-badge');
    if (badge) { badge.classList.add('hidden'); badge.style.display = ''; }
  }
}

function closeMessagesModal() {
  goBackFromSubPage('home');
}

function insertMsgInputTag(tag) {
  const input = document.getElementById('message-input-text');
  if (!input) return;
  const cleaned = input.value.replace(/^📢\s*\[.*?\]\s*|^⏰\s*\[.*?\]\s*|^⚠️\s*\[.*?\]\s*|^📋\s*\[.*?\]\s*/, '');
  input.value = tag + cleaned;
  input.focus();
}

let messagesSearchQuery = '';
function handleMessagesSearch(query) {
  messagesSearchQuery = (query || '').toLowerCase().trim();
  renderMessagesStream();
}

function renderMessagesStream() {
  const container = document.getElementById('messages-list-container');
  if (!container) return;

  let messages = cachedMessages || [];
  if (messagesSearchQuery) {
    messages = messages.filter(m => {
      const txt = (m.text || '').toLowerCase();
      const sName = (m.senderName || '').toLowerCase();
      const sEmail = resolveSenderEmail(m).toLowerCase();
      return txt.includes(messagesSearchQuery) || sName.includes(messagesSearchQuery) || sEmail.includes(messagesSearchQuery);
    });
  }

  const countPill = document.getElementById('messages-count-pill');
  if (countPill) {
    if (messagesSearchQuery) {
      countPill.textContent = `${messages.length} Found`;
    } else {
      countPill.textContent = (cachedMessages || []).length > 0 ? `${(cachedMessages || []).length} Notices` : 'Notice Board';
    }
  }

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
        <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1e4d5f]/20 via-[#245b70]/20 to-teal-400/20 text-[#245b70] dark:text-cyan-300 flex items-center justify-center shadow-inner border border-[#245b70]/20">
          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </div>
        <div>
          <h3 class="text-sm sm:text-base font-black text-[var(--text-main)]">${messagesSearchQuery ? 'No matching announcements found' : 'Teacher Notice Board is Clean'}</h3>
          <p class="text-xs text-[var(--text-sub)] max-w-sm mt-1">${messagesSearchQuery ? 'Try a different search query' : 'No announcements or messages have been posted yet. Type below to broadcast the first notice to all teachers!'}</p>
        </div>
      </div>
    `;
    return;
  }

  const myId = currentUser && (currentUser._id || currentUser.id);
  const isAdmin = currentUser && currentUser.role === 'admin';

  container.innerHTML = messages.map(m => {
    const isMine = String(m.senderId) === String(myId);
    const canManage = isMine || isAdmin;
    const avatar = m.senderAvatar || DEFAULT_AVATAR;
    const senderEmail = resolveSenderEmail(m);
    const senderName = m.senderName || 'Anonymous Teacher';
    const rolePill = m.senderRole === 'admin'
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/35 shadow-2xs"><svg class="w-2.5 h-2.5 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Admin</span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-[#245b70]/15 text-[#245b70] dark:text-cyan-300 border border-[#245b70]/25 shadow-2xs">Teacher</span>`;

    return `
      <div class="message-announcement-card flex items-start gap-3 ${isMine ? 'flex-row-reverse' : ''} group transition-all duration-200">
        <!-- Avatar with live status indicator -->
        <div class="relative flex-shrink-0">
          <img src="${avatar}" alt="${escapeHtml(senderName)}" class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover ring-2 ${isMine ? 'ring-[#245b70]/50' : 'ring-[#43888a]/40'} shadow-sm">
          <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[var(--card-bg)] flex items-center justify-center shadow-2xs">
            <span class="w-1 h-1 rounded-full bg-white"></span>
          </div>
        </div>

        <!-- Content Block: Profile Name, Email, and Message Box Below -->
        <div class="max-w-[85%] sm:max-w-[80%] space-y-1.5 ${isMine ? 'items-end flex flex-col' : ''}">
          <!-- Profile Name + Role + Time -->
          <div class="flex items-center gap-2 ${isMine ? 'flex-row-reverse' : ''} flex-wrap">
            <span class="font-black text-xs sm:text-sm text-[var(--text-main)] truncate">${escapeHtml(senderName)}</span>
            ${rolePill}
            ${isMine ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[var(--text-sub)]">You</span>' : ''}
            <span class="text-[10px] font-medium text-[var(--text-sub)] flex items-center gap-1">
              <svg class="w-2.5 h-2.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              ${_timeAgo(m.createdAt)}
            </span>
          </div>

          <!-- Email Profile Display: below name, clearly highlighted with icon -->
          <div class="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold ${isMine ? 'text-teal-700 dark:text-teal-300 flex-row-reverse' : 'text-[#245b70] dark:text-cyan-400'} truncate">
            <svg class="w-3.5 h-3.5 flex-shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            <span class="font-mono truncate">${escapeHtml(senderEmail || 'No email registered')}</span>
          </div>

          <!-- BELOW THAT: THE MESSAGE CARD -->
          <div class="${isMine
            ? 'bg-gradient-to-br from-[#1e4d5f] via-[#245b70] to-[#123644] text-white border border-white/15 shadow-md rounded-2xl rounded-tr-xs'
            : 'bg-gradient-to-br from-[var(--bg-page)] via-[var(--card-bg)] to-[#245b70]/10 dark:to-[#245b70]/20 text-[var(--text-main)] border border-[var(--border-color)] border-l-4 border-l-[#245b70] dark:border-l-cyan-400 shadow-sm rounded-2xl rounded-tl-xs'
          } px-3.5 py-2.5 sm:px-4 sm:py-3 relative select-none cursor-pointer active:scale-[0.99] transition group-hover:shadow-md"
            onmousedown="handleMsgStartHold(event, '${m._id}')"
            onmouseup="handleMsgEndHold(event)"
            onmouseleave="handleMsgEndHold(event)"
            ontouchstart="handleMsgStartHold(event, '${m._id}')"
            ontouchend="handleMsgEndHold(event)"
            ontouchmove="handleMsgEndHold(event)"
            ontouchcancel="handleMsgEndHold(event)"
            oncontextmenu="handleMsgContextMenu(event, '${m._id}')"
            title="Press and hold to edit or delete"
            style="-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;white-space:pre-wrap;word-break:break-word;">

            <!-- Chat Text Only with Dynamic Font Scaling -->
            <p class="${getMessageFontSizeClass(m.text)} ${isMine ? 'text-white' : 'text-[var(--text-main)]'} pointer-events-none">
              ${escapeHtml(m.text)}
            </p>

            ${m.isEdited ? `<span class="text-[9px] ${isMine ? 'text-teal-200/80' : 'text-[var(--text-sub)]'} italic block mt-1 pointer-events-none">(edited)</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

async function loadMessages() {
  const container = document.getElementById('messages-list-container');
  if (!container) return;
  container.innerHTML = `<div class="flex items-center justify-center py-12"><div class="w-7 h-7 rounded-full border-3 border-[#245b70] border-t-transparent animate-spin"></div></div>`;
  try {
    const res = await API.getMessages();
    const messages = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
    cachedMessages = messages;
    renderMessagesStream();
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
  if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; }
  try {
    await API.sendMessage(text);
    input.value = '';
    await loadMessages();
  } catch (err) {
    showToast('Failed to send message: ' + err.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Post'; }
  }
}

// ================= TIMETABLE MODULE (SOLELY MAPPED TO USER EMAILS) =================
let currentTimetableDay = 'all';
let timetableViewTeacherEmail = null; // string: teacher email solely being viewed
let timetableViewTeacherName = null;  // string: display label for header
let timetableReadOnly = false;        // true=no add/edit/delete buttons
let timetableEditingSlotId = null;

// Helper: match slot strictly to teacher email (email-based mapping only, no name dependency)
function isSlotForTeacher(slot, targetEmail) {
  if (!slot) return false;
  // Handle flipped legacy signature if called as (slot, name, id, email)
  const emailCandidate = (arguments.length >= 4 && arguments[3]) ? arguments[3] : targetEmail;
  const target = (emailCandidate || '').trim().toLowerCase();
  const slotEmail = (slot.teacherEmail || '').trim().toLowerCase();
  return Boolean(target && slotEmail && target === slotEmail);
}

// Open current logged-in account's timetable (from Profile tab)
async function openMyTimetable() {
  if (!currentUser) return;
  timetableViewTeacherEmail = (currentUser.email || '').trim().toLowerCase();
  timetableViewTeacherName = (currentUser.name || '').trim();
  timetableReadOnly = false; // Always editable for the user's own profile!
  await openTimetableModal();
}

// Open timetable for a specific teacher (from Teachers tab, mapped solely by email)
async function openTeacherTimetable(teacherEmail, teacherName = '', teacherId = null) {
  let targetEmail = (teacherEmail || '').trim().toLowerCase();
  let targetName = (teacherName || '').trim();
  // Support legacy call order (name, id, email)
  if (targetEmail && !targetEmail.includes('@') && arguments[2] && String(arguments[2]).includes('@')) {
    targetEmail = String(arguments[2]).trim().toLowerCase();
    targetName = String(teacherEmail).trim();
  }

  const isAdmin = currentUser && currentUser.role === 'admin';
  const myEmail = (currentUser && currentUser.email ? currentUser.email : '').trim().toLowerCase();
  const isMe = Boolean(myEmail && targetEmail && myEmail === targetEmail);

  timetableViewTeacherEmail = targetEmail || null;
  timetableViewTeacherName = targetName || targetEmail || null;
  // Editable for admin AND the teacher themselves!
  timetableReadOnly = !(isAdmin || isMe);
  await openTimetableModal();
}

async function openTimetableModal() {
  selectTab('timetable');
  const mainViewport = document.querySelector('main');
  if (mainViewport) mainViewport.scrollTop = 0;

  // Populate class filter
  const classFilter = document.getElementById('timetable-filter-class');
  if (classFilter) {
    classFilter.innerHTML = `<option value="all">All Classes</option>` +
      classesList.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
  }

  // Fallback: If timetableViewTeacherEmail was not set, default to currentUser
  if (!timetableViewTeacherEmail && currentUser) {
    timetableViewTeacherEmail = (currentUser.email || '').trim().toLowerCase();
    timetableViewTeacherName = (currentUser.name || '').trim();
  }

  const isAdminTT = currentUser && currentUser.role === 'admin';
  const myEmail = (currentUser && currentUser.email ? currentUser.email : '').trim().toLowerCase();
  const isMe = Boolean(myEmail && timetableViewTeacherEmail && myEmail === timetableViewTeacherEmail);

  // Show/hide Add button:
  // Admin can add a slot to ANY teacher's timetable (or their own);
  // Non-admin can add a slot to their OWN timetable.
  const addSlotBtn = document.getElementById('btn-add-timetable-slot');
  const canAddSlot = !timetableReadOnly && (isAdminTT || isMe);
  if (addSlotBtn) addSlotBtn.classList.toggle('hidden', !canAddSlot);

  // Update title & subtitle (tied strictly to account email)
  const ttTitleEl = document.getElementById('timetable-modal-title') || document.querySelector('#modal-timetable h3');
  const ttSubtitleEl = document.getElementById('timetable-modal-subtitle');
  if (ttTitleEl) {
    if (isMe) {
      ttTitleEl.textContent = 'My Timetable';
    } else if (timetableViewTeacherName) {
      ttTitleEl.textContent = `${timetableViewTeacherName}'s Timetable`;
    } else if (timetableViewTeacherEmail) {
      ttTitleEl.textContent = `${timetableViewTeacherEmail}'s Timetable`;
    } else {
      ttTitleEl.textContent = 'Timetable';
    }
  }
  if (ttSubtitleEl) {
    if (isMe) {
      ttSubtitleEl.textContent = `Personal schedule linked to ${myEmail}`;
    } else if (timetableViewTeacherEmail) {
      ttSubtitleEl.textContent = `Schedule mapped to email: ${timetableViewTeacherEmail}`;
    }
  }

  // Default to All Days
  currentTimetableDay = 'all';
  _updateTimetableDayTabs();
  await renderTimetableSlots();
}

function closeTimetableModal() {
  goBackFromSubPage('home');
  timetableViewTeacherEmail = null;
  timetableViewTeacherName = null;
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
    const res = await API.getTimetable(selectedClass === 'all' ? '' : selectedClass, dayParam, timetableViewTeacherEmail || '');
    let slots = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

    // Filter strictly by teacher email
    if (timetableViewTeacherEmail) {
      slots = slots.filter(s => (s.teacherEmail || '').trim().toLowerCase() === timetableViewTeacherEmail);
    }

    if (slots.length === 0) {
      const emptyMsg = timetableViewTeacherEmail
        ? `No timetable slots scheduled for ${escapeHtml(timetableViewTeacherEmail)} on ${escapeHtml(currentTimetableDay)}.`
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

  // Target teacher email solely
  const targetTeacherEmail = (timetableViewTeacherEmail || (currentUser && currentUser.email) || '').trim().toLowerCase();
  const teacherEmailInput = document.getElementById('slot-input-teacher-email');
  const assigneeNameEl = document.getElementById('slot-assignee-name');

  if (teacherEmailInput) teacherEmailInput.value = targetTeacherEmail;
  if (assigneeNameEl) assigneeNameEl.textContent = targetTeacherEmail;

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
        const currentSlotEmail = (slot.teacherEmail || targetTeacherEmail).trim().toLowerCase();
        if (teacherEmailInput) teacherEmailInput.value = currentSlotEmail;
        if (assigneeNameEl) assigneeNameEl.textContent = currentSlotEmail;
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
  const teacherEmailVal = ((document.getElementById('slot-input-teacher-email') || {}).value || timetableViewTeacherEmail || (currentUser && currentUser.email) || '').trim().toLowerCase();

  const daysArr = selectedSlotDays.length > 0
    ? selectedSlotDays
    : [((document.getElementById('slot-input-day') || {}).value || '').trim()].filter(Boolean);

  const slotData = {
    day: daysArr.join(', '),
    days: daysArr,
    timeSlot: (document.getElementById('slot-input-time') || {}).value || '',
    class: (document.getElementById('slot-input-class') || {}).value || '',
    subject: (document.getElementById('slot-input-subject') || {}).value || '',
    teacherEmail: teacherEmailVal,
    room: (document.getElementById('slot-input-room') || {}).value || '',
  };

  if (!slotData.day || !slotData.timeSlot || !slotData.class || !slotData.subject) {
    showToast('Please select at least one day, time, class and subject.', true);
    return;
  }

  // Feature 3: Schedule conflict / overlap detection (custom modal)
  const newRange = _parseSlotTimeRange(slotData.timeSlot);
  if (newRange) {
    let allSlotsForCheck = cachedCurrentTimetableSlots || [];
    try {
      const allRes = await API.getTimetable('', '', '');
      allSlotsForCheck = (allRes && allRes.data) ? allRes.data : (Array.isArray(allRes) ? allRes : allSlotsForCheck);
    } catch(_) {}
    // Target teacher email strictly (only look with editing teacher's email, not admin id)
    const targetTeacherEmail = (slotData.teacherEmail || teacherEmailVal || timetableViewTeacherEmail || '').trim().toLowerCase();
    let selfConflictSlot = null;
    let classConflictSlot = null;
    for (const s of allSlotsForCheck) {
      if (slotId && String(s._id) === String(slotId)) continue;
      const existRange = _parseSlotTimeRange(s.timeSlot || s.time);
      if (!existRange) continue;
      const timeOverlap = newRange.startMin < existRange.endMin && existRange.startMin < newRange.endMin;
      if (!timeOverlap) continue;
      const existDays = Array.isArray(s.days) && s.days.length > 0
        ? s.days : (s.day || '').split(',').map(x => x.trim()).filter(Boolean);
      const dayOverlap = daysArr.some(d =>
        d === 'All Days' || existDays.includes('All Days') || existDays.includes(d)
      );
      if (!dayOverlap) continue;
      const ownerEmail = (s.teacherEmail || '').trim().toLowerCase();
      if (targetTeacherEmail && ownerEmail === targetTeacherEmail) { selfConflictSlot = s; break; }
      if (!classConflictSlot && isClassEqual(s.class, slotData.class)) { classConflictSlot = s; }
    }
    const conflictSlot = selfConflictSlot || classConflictSlot;
    if (conflictSlot) {
      const conflictType = selfConflictSlot ? 'self' : 'other';
      const btn0 = e.target.querySelector('button[type="submit"]');
      const saveAction = async () => {
        const btn2 = document.getElementById('modal-add-timetable-slot') ? document.getElementById('modal-add-timetable-slot').querySelector('button[type="submit"]') : null;
        if (btn2) { btn2.disabled = true; btn2.textContent = 'Saving...'; }
        try {
          if (slotId) { await API.updateTimetableSlot(slotId, slotData); showToast('Timetable slot updated!'); }
          else { await API.createTimetableSlot(slotData); showToast('Timetable slot added!'); }
          closeAddTimetableSlotModal();
          if (currentTimetableDay !== 'all' && !daysArr.includes(currentTimetableDay) && !daysArr.includes('All Days')) {
            currentTimetableDay = daysArr[0] || 'all'; _updateTimetableDayTabs();
          }
          await renderTimetableSlots();
          checkAndTriggerTimetableNotifications();
        } catch (err2) { showToast('Failed to save slot: ' + err2.message, true); }
        finally { if (btn2) { btn2.disabled = false; btn2.textContent = slotId ? 'Save Changes' : 'Save Slot'; } }
      };
      showTimetableConflictModal(conflictType, conflictSlot, saveAction);
      return;
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
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Delete Slot',
        badge: 'Timetable',
        message: 'Delete this timetable slot?',
        isDanger: true
      })
    : confirm('Delete this timetable slot?');
  if (!confirmed) return;
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
  const matchedSubs = (subjectsList || []).filter(s => (s.assignedClasses || []).some(ac => isClassEqual(ac, selectedClass)));
  const uniqueNames = Array.from(new Set(matchedSubs.map(s => s.name).filter(Boolean)));
  const subjects = uniqueNames.length > 0 ? uniqueNames : Array.from(new Set((subjectsList || []).map(s => s.name).filter(Boolean)));
  const currentVal = subjectSelect.value;
  subjectSelect.innerHTML = '<option value="">Select subject...</option>' +
    subjects.map(s => '<option value="' + escapeHtml(s) + '" ' + (s === currentVal ? 'selected' : '') + '>' + escapeHtml(s) + '</option>').join('');
}


// ================= TIMETABLE DRAG & DROP AND GENERATOR =================
let cachedCurrentTimetableSlots = [];
let draggedTimetableSlotId = null;

// Parse a slot time range like "09:00 AM - 10:00 AM" into start and end minute numbers
// ---- TIMETABLE CONFLICT MODAL ----
function showTimetableConflictModal(conflictType, conflictSlot, onConfirm) {
  const modal = document.getElementById('modal-timetable-conflict');
  if (!modal) { if (onConfirm) onConfirm(); return; }
  const badge = document.getElementById('conflict-modal-type-badge');
  const title = document.getElementById('conflict-modal-title');
  const desc = document.getElementById('conflict-modal-desc');
  const details = document.getElementById('conflict-modal-details');
  const saveBtn = document.getElementById('conflict-modal-save-btn');
  const cancelBtn = document.getElementById('conflict-modal-cancel-btn');

  // Accurately resolve first/conflicting slot's assigned teacher (from slot, subjectsList, or currentUser)
  const ownerEmail = (conflictSlot.teacherEmail || '').trim().toLowerCase();
  const slotSubject = (conflictSlot.subject || '').trim().toLowerCase();
  const slotClass = (conflictSlot.class || '').trim().toLowerCase();

  let subjTeacherName = '';
  let subjTeacherEmail = '';
  const _sList = (typeof subjectsList !== 'undefined' && Array.isArray(subjectsList)) ? subjectsList : [];
  const foundSubj = _sList.find(s => {
    const sName = (s.name || '').trim().toLowerCase();
    if (sName !== slotSubject) return false;
    if (s.assignedClasses && Array.isArray(s.assignedClasses) && s.assignedClasses.length > 0) {
      return s.assignedClasses.some(c => c.trim().toLowerCase() === slotClass);
    }
    return true;
  }) || _sList.find(s => (s.name || '').trim().toLowerCase() === slotSubject);

  if (foundSubj) {
    subjTeacherName = (foundSubj.teacher || '').trim();
    subjTeacherEmail = (foundSubj.teacherEmail || '').trim().toLowerCase();
  }

  const effectiveEmail = ownerEmail || subjTeacherEmail;

  const _tList = (typeof cachedTeachersList !== 'undefined' && Array.isArray(cachedTeachersList)) ? cachedTeachersList : [];
  const foundByEmail = effectiveEmail ? _tList.find(t => (t.email || '').trim().toLowerCase() === effectiveEmail) : null;
  const foundByName = subjTeacherName ? _tList.find(t => (t.name || '').trim().toLowerCase() === subjTeacherName.toLowerCase()) : null;
  const matchedTeacher = foundByEmail || foundByName;

  const isOwnerCurrent = Boolean(
    currentUser && (
      (effectiveEmail && (currentUser.email || '').trim().toLowerCase() === effectiveEmail) ||
      (subjTeacherName && (currentUser.name || '').trim().toLowerCase() === subjTeacherName.toLowerCase()) ||
      (matchedTeacher && (currentUser.email || '').trim().toLowerCase() === (matchedTeacher.email || '').trim().toLowerCase())
    )
  );

  let teacherName = '';
  if (isOwnerCurrent) {
    teacherName = currentUser.name || 'Admin';
  } else if (subjTeacherName) {
    teacherName = subjTeacherName;
  } else if (matchedTeacher && (matchedTeacher.name || matchedTeacher.username)) {
    teacherName = (matchedTeacher.name || matchedTeacher.username).trim();
  } else if (conflictSlot.teacherName) {
    teacherName = conflictSlot.teacherName.trim();
  } else if (effectiveEmail) {
    teacherName = effectiveEmail;
  } else {
    teacherName = 'Assigned Teacher';
  }

  const isEditingOther = Boolean(currentUser && currentUser.role === 'admin' && currentUser.email && currentUser.email.toLowerCase() !== ownerEmail);

  if (conflictType === 'self') {
    if (badge) badge.textContent = isEditingOther ? '⚠️ Teacher Schedule Conflict' : '⚠️ Your Own Conflict';
    if (title) title.textContent = isEditingOther ? `${teacherName} Already Has a Class!` : 'You Already Have a Class!';
    if (desc) desc.textContent = isEditingOther ? `${teacherName} already has a slot scheduled at this time:` : 'You already have a slot scheduled at this time:';
  } else {
    if (badge) badge.textContent = isOwnerCurrent ? '⚠️ Your Class Overlap' : '⚠️ Class Schedule Conflict';
    if (title) title.textContent = `${teacherName} Already Has a Class Here!`;
    if (desc) desc.textContent = isOwnerCurrent
      ? `You already have "${conflictSlot.subject || 'a subject'}" scheduled for ${conflictSlot.class || 'this class'} at this time:`
      : `${teacherName} already has "${conflictSlot.subject || 'a subject'}" scheduled for ${conflictSlot.class || 'this class'} at this time:`;
  }

  const slotDays = Array.isArray(conflictSlot.days) && conflictSlot.days.length > 0
    ? conflictSlot.days.join(', ')
    : (conflictSlot.day || '—');

  if (details) {
    details.innerHTML =
      '<div class="flex items-center gap-2"><span class="text-cyan-300 font-bold w-16 shrink-0">Subject</span><span class="text-white font-semibold">' + escapeHtml(conflictSlot.subject || '—') + '</span></div>' +
      '<div class="flex items-center gap-2"><span class="text-cyan-300 font-bold w-16 shrink-0">Teacher</span><span class="text-white font-semibold">' + escapeHtml(teacherName) + '</span></div>' +
      '<div class="flex items-center gap-2"><span class="text-cyan-300 font-bold w-16 shrink-0">Class</span><span class="text-white font-semibold">' + escapeHtml(conflictSlot.class || '—') + '</span></div>' +
      '<div class="flex items-center gap-2"><span class="text-cyan-300 font-bold w-16 shrink-0">Time</span><span class="text-white font-semibold">' + escapeHtml(conflictSlot.timeSlot || conflictSlot.time || '—') + '</span></div>' +
      '<div class="flex items-center gap-2"><span class="text-cyan-300 font-bold w-16 shrink-0">Days</span><span class="text-white font-semibold">' + escapeHtml(slotDays) + '</span></div>';
  }

  // Wire buttons
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  document.getElementById('conflict-modal-save-btn').addEventListener('click', function() {
    closeTimetableConflictModal();
    if (onConfirm) onConfirm();
  });
  document.getElementById('conflict-modal-cancel-btn').addEventListener('click', function() {
    closeTimetableConflictModal();
  });

  modal.classList.remove('hidden');
  if (window.triggerNavHaptic) triggerNavHaptic('warning');
}

function closeTimetableConflictModal() {
  const modal = document.getElementById('modal-timetable-conflict');
  if (modal) modal.classList.add('hidden');
}

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

  const targetEmail = (timetableViewTeacherEmail || (currentUser ? currentUser.email : '')).trim().toLowerCase();
  let teacherProfileName = '';
  if (timetableViewTeacherName && timetableViewTeacherName.trim().toLowerCase() !== targetEmail) {
    teacherProfileName = timetableViewTeacherName.trim();
  }
  if (!teacherProfileName && targetEmail) {
    if (currentUser && (currentUser.email || '').trim().toLowerCase() === targetEmail && currentUser.name) {
      teacherProfileName = currentUser.name.trim();
    } else if (typeof cachedTeachersList !== 'undefined' && Array.isArray(cachedTeachersList)) {
      const found = cachedTeachersList.find(t => (t.email || '').trim().toLowerCase() === targetEmail);
      if (found && (found.name || found.username)) {
        teacherProfileName = (found.name || found.username).trim();
      }
    }
  }
  const teacherDisplay = teacherProfileName || targetEmail || 'Weekly Schedule';
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
  const myEmail = currentUser && currentUser.email ? currentUser.email.trim().toLowerCase() : '';

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[now.getDay()];
  const todayLower = todayName.toLowerCase();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return slots.map(slot => {
    const slotEmail = (slot.teacherEmail || '').trim().toLowerCase();
    const isOwnSlot = Boolean(myEmail && slotEmail && slotEmail === myEmail);

    // Editable by admin or the assigned teacher account (strictly by email)
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
    if (navigator.vibrate) {
      try { navigator.vibrate(40); } catch (_) {}
    }
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

function canManageMessage(msg) {
  if (!msg) return false;
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;

  const myId = String(currentUser._id || currentUser.id || '').trim();
  const myEmail = String(currentUser.email || '').trim().toLowerCase();
  const myName = String(currentUser.name || '').trim().toLowerCase();

  const sId = String(msg.senderId || '').trim();
  const sEmail = String(msg.senderEmail || '').trim().toLowerCase();
  const sName = String(msg.senderName || '').trim().toLowerCase();

  if (myId && sId && myId === sId) return true;
  if (myEmail && sEmail && myEmail === sEmail) return true;
  if (myName && sName && myName === sName) return true;
  return false;
}

function openMessageActionsModal(msg) {
  if (!msg) return;
  activeSelectedMessage = msg;
  const modal = document.getElementById('modal-message-actions');
  const preview = document.getElementById('message-actions-preview');
  const senderEl = document.getElementById('message-actions-sender');
  const btnEdit = document.getElementById('btn-msg-action-edit');
  const btnDelete = document.getElementById('btn-msg-action-delete');

  if (preview) preview.textContent = msg.text || '';
  if (senderEl) {
    const time = (typeof _timeAgo === 'function') ? _timeAgo(msg.createdAt) : '';
    senderEl.textContent = `By ${msg.senderName || 'Teacher'}${time ? ' • ' + time : ''}`;
  }

  const canManage = canManageMessage(msg);
  if (btnEdit) btnEdit.style.display = canManage ? 'flex' : 'none';
  if (btnDelete) btnDelete.style.display = canManage ? 'flex' : 'none';

  if (modal) modal.classList.remove('hidden');
}

function closeMessageActionsModal() {
  const modal = document.getElementById('modal-message-actions');
  if (modal) modal.classList.add('hidden');
  activeSelectedMessage = null;
}

function copySelectedMessageText() {
  if (!activeSelectedMessage || !activeSelectedMessage.text) return;
  const text = activeSelectedMessage.text;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Notice copied to clipboard');
      closeMessageActionsModal();
    }).catch(() => {
      fallbackCopyMsgText(text);
    });
  } else {
    fallbackCopyMsgText(text);
  }
}

function fallbackCopyMsgText(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Notice copied to clipboard');
    closeMessageActionsModal();
  } catch (_) {
    showToast('Failed to copy notice', true);
  }
}

let activeEditingMessageObj = null;

function openEditMessageModal(msgId) {
  const msg = (cachedMessages || []).find(m => String(m._id) === String(msgId));
  if (!msg) return;
  activeEditingMessageObj = msg;
  const modal = document.getElementById('modal-edit-message');
  const input = document.getElementById('edit-message-text-input');
  if (input) {
    input.value = msg.text || '';
    setTimeout(() => { input.focus(); }, 150);
  }
  if (modal) modal.classList.remove('hidden');
}

function openEditMessageModalFromAction() {
  if (!activeSelectedMessage) return;
  const msg = activeSelectedMessage;
  closeMessageActionsModal();
  openEditMessageModal(msg._id);
}

function closeEditMessageModal() {
  const modal = document.getElementById('modal-edit-message');
  if (modal) modal.classList.add('hidden');
  activeEditingMessageObj = null;
}

function insertMsgEditTag(tag) {
  const input = document.getElementById('edit-message-text-input');
  if (!input) return;
  const cleaned = input.value.replace(/^📢\s*\[.*?\]\s*|^⏰\s*\[.*?\]\s*|^⚠️\s*\[.*?\]\s*|^📋\s*\[.*?\]\s*/, '');
  input.value = tag + cleaned;
  input.focus();
}

async function handleSaveEditedMessage() {
  if (!activeEditingMessageObj) return;
  const input = document.getElementById('edit-message-text-input');
  const newText = input ? input.value.trim() : '';
  if (!newText) {
    showToast('Message text cannot be empty', true);
    return;
  }
  const btn = document.getElementById('btn-save-edited-msg');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const res = await API.editMessage(activeEditingMessageObj._id, newText);
    if (res && res.success) {
      showToast('Announcement updated');
      closeEditMessageModal();
      await loadMessages();
    }
  } catch (err) {
    showToast(err.message || 'Failed to edit message', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Save Changes</span>';
    }
  }
}

async function triggerDeleteMessage(msgId) {
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Delete Announcement?',
        badge: 'Notice Board',
        message: 'Are you sure you want to delete this broadcast notice?',
        isDanger: true
      })
    : confirm('Are you sure you want to delete this message?');
  if (!confirmed) return;
  triggerNavHaptic('delete');

  try {
    const res = await API.deleteMessage(msgId);
    if (res && res.success) {
      showToast('Announcement deleted');
      await loadMessages();
    }
  } catch (err) {
    showToast(err.message || 'Failed to delete message', true);
  }
}

async function promptEditSelectedMessage() {
  openEditMessageModalFromAction();
}

async function confirmDeleteSelectedMessage() {
  if (!activeSelectedMessage) return;
  const msgId = activeSelectedMessage._id;
  closeMessageActionsModal();
  await triggerDeleteMessage(msgId);
}

async function handleClearAllChat() {
  const confirmed = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm({
        title: 'Clear Chat History',
        badge: 'Messages',
        message: 'Are you sure you want to delete all chat history? This cannot be undone.',
        confirmText: 'Clear All Messages',
        isDanger: true
      })
    : confirm('Are you sure you want to delete all chat history? This cannot be undone.');
  if (!confirmed) return;
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
  const option = document.getElementById('print-choice-student-details');
  const isAllowed = !appSettings || appSettings.allowStudentDetailsPrint !== false;
  if (option) option.classList.toggle('hidden', !isAllowed);
  const section = document.getElementById('student-export-section');
  if (section) section.classList.remove('hidden');
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
  } else if (type === 'teacher-activity') {
    openTeacherActivityExportModal();
  } else if (type === 'timetable') {
    printTimetableSchedule();
  }
}

function openClassAttendanceExportModal() {
  closePrintDataChoiceModal();
  openAttendanceExportModal();
}

async function openIndividualAttendanceReportModal() {
  closePrintDataChoiceModal();
  const modal = document.getElementById('modal-individual-attendance');
  if (!modal) return;

  if (!classesList || classesList.length === 0) {
    try { await loadClasses(); } catch (_) {}
  }
  if (!cachedAllStudents || cachedAllStudents.length === 0) {
    try {
      const res = await API.getStudents('all');
      if (res && res.data) cachedAllStudents = res.data;
    } catch (_) {}
  }

  // Populate Class Select (combines public classes and personal workspace classes)
  const classSelect = document.getElementById('att-indiv-class-select') || document.getElementById('att-indiv-class');
  if (classSelect) {
    const combinedClasses = [...(classesList || []), ...((typeof pwClassesList !== 'undefined' && Array.isArray(pwClassesList)) ? pwClassesList : [])];
    const seenClasses = new Set();
    const uniqueClasses = [];
    combinedClasses.forEach(c => {
      const cName = (c.name || c || '').trim();
      if (cName && !seenClasses.has(cName.toLowerCase())) {
        seenClasses.add(cName.toLowerCase());
        uniqueClasses.push(c);
      }
    });
    classSelect.innerHTML = uniqueClasses.map(c => {
      const cName = c.name || c;
      return `<option value="${escapeHtml(cName)}">${escapeHtml(cName)}</option>`;
    }).join('');
  }

  // Populate Year Select
  const yearSelect = document.getElementById('att-indiv-year-select') || document.getElementById('att-indiv-year');
  if (yearSelect) {
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = `
      <option value="${currentYear}">${currentYear}</option>
      <option value="${currentYear - 1}">${currentYear - 1}</option>
      <option value="${currentYear + 1}">${currentYear + 1}</option>
    `;
  }

  handleIndivAttendanceClassChanged();
  modal.classList.remove('hidden');
}

function closeIndividualAttendanceModal() {
  const modal = document.getElementById('modal-individual-attendance');
  if (modal) modal.classList.add('hidden');
}
function closeIndividualAttendanceReportModal() {
  closeIndividualAttendanceModal();
}

function handleIndivAttendanceClassChanged() {
  const classSelect = document.getElementById('att-indiv-class-select') || document.getElementById('att-indiv-class');
  const classVal = classSelect?.value || '';
  const stuSelect = document.getElementById('att-indiv-student-select') || document.getElementById('att-indiv-student');
  const subSelect = document.getElementById('att-indiv-subject-select') || document.getElementById('att-indiv-subject');

  // Populate Subjects for this class (including workspace subjects)
  if (subSelect) {
    const combinedSubs = [...(subjectsList || []), ...((typeof pwSubjectsList !== 'undefined' && Array.isArray(pwSubjectsList)) ? pwSubjectsList : [])];
    const filteredSubs = combinedSubs.filter(s => {
      const assigned = Array.isArray(s.assignedClasses) ? s.assignedClasses : [];
      return assigned.length === 0 || classListIncludes(assigned, classVal) || isClassEqual(s.class, classVal);
    });
    let html = `<option value="all">All Subjects (Consolidated)</option>`;
    html += filteredSubs.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    subSelect.innerHTML = html;
  }

  // Populate Students for this class (including workspace students)
  if (stuSelect) {
    const combinedStudents = [...(cachedAllStudents || []), ...((typeof pwStudentsList !== 'undefined' && Array.isArray(pwStudentsList)) ? pwStudentsList : [])];
    const seenStu = new Set();
    const filteredStudents = [];
    combinedStudents.forEach(s => {
      const sId = String(s.studentId || s._id || '');
      if (isClassEqual(s.class, classVal) && sId && !seenStu.has(sId)) {
        seenStu.add(sId);
        filteredStudents.push(s);
      }
    });
    filteredStudents.sort((a, b) => (parseInt(a.roll, 10) || 0) - (parseInt(b.roll, 10) || 0));
    stuSelect.innerHTML = filteredStudents.map(s => {
      return `<option value="${s._id || s.studentId}" data-id="${s.studentId}" data-roll="${s.roll || ''}" data-name="${escapeQuotes(s.name || '')}">${escapeHtml(s.name)}</option>`;
    }).join('') || '<option value="">No students in this class</option>';
  }

  handleIndivAttendanceStudentChanged();
}
function handleAttIndivClassChanged() {
  handleIndivAttendanceClassChanged();
}

function handleIndivAttendanceStudentChanged() {
  const stuSelect = document.getElementById('att-indiv-student-select') || document.getElementById('att-indiv-student');
  const subEl = document.getElementById('att-indiv-student-sub');
  const nameEl = document.getElementById('att-indiv-student-fullname');
  if (!stuSelect) return;
  const selOpt = stuSelect.options[stuSelect.selectedIndex];
  if (selOpt && selOpt.value) {
    const sId = selOpt.getAttribute('data-id') || '';
    const roll = selOpt.getAttribute('data-roll') || '';
    const sName = selOpt.getAttribute('data-name') || selOpt.text || '';
    if (nameEl) nameEl.textContent = sName;
    if (subEl) {
      subEl.innerText = `ID: ${sId} • Roll: #${roll}`;
      subEl.classList.remove('hidden');
    }
  } else {
    if (nameEl) nameEl.textContent = 'Select a student';
    if (subEl) {
      subEl.innerText = 'ID: — • Roll: —';
    }
  }
}
function handleAttIndivStudentChanged() {
  handleIndivAttendanceStudentChanged();
}

async function executeIndividualAttendancePrint() {
  const stuSelect = document.getElementById('att-indiv-student-select') || document.getElementById('att-indiv-student');
  const classVal = (document.getElementById('att-indiv-class-select') || document.getElementById('att-indiv-class'))?.value || '';
  const subjectVal = (document.getElementById('att-indiv-subject-select') || document.getElementById('att-indiv-subject'))?.value || 'all';
  const yearVal = (document.getElementById('att-indiv-year-select') || document.getElementById('att-indiv-year'))?.value || new Date().getFullYear();
  const monthVal = (document.getElementById('att-indiv-month-select') || document.getElementById('att-indiv-month'))?.value || 'all';

  if (!stuSelect || !stuSelect.value) {
    showToast('Please select a student', true);
    return;
  }

  const studentVal = stuSelect.value;
  let student = (cachedAllStudents || []).find(s => String(s._id) === String(studentVal) || String(s.studentId) === String(studentVal));
  if (!student) {
    try {
      const res = await API.getStudentById(studentVal);
      if (res && res.success && res.data) student = res.data;
    } catch (_) {}
  }
  if (!student) {
    showToast('Student information not found', true);
    return;
  }

  showToast('Preparing Individual Attendance Report...');

  let totalSessions = student.attendanceSessions || 0;
  let presentCount = student.attendancePresent || 0;
  let absentCount = student.attendanceAbsent || 0;
  let leaveCount = student.attendanceLeave || 0;
  let attPercentage = student.attendancePercentage !== undefined ? student.attendancePercentage : (totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0);

  const monthNames = [
    { code: '06', name: 'June' },
    { code: '07', name: 'July' },
    { code: '08', name: 'August' },
    { code: '09', name: 'September' },
    { code: '10', name: 'October' },
    { code: '11', name: 'November' },
    { code: '12', name: 'December' },
    { code: '01', name: 'January' },
    { code: '02', name: 'February' },
    { code: '03', name: 'March' }
  ];

  let displayMonths = monthNames;
  if (monthVal !== 'all-year') {
    const single = monthNames.find(m => m.code === monthVal || m.code === monthVal.padStart(2, '0'));
    if (single) displayMonths = [single];
  }

  const monthRowsHtml = displayMonths.map(m => {
    return `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #1e293b;">${escapeHtml(m.name)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #475569;">—</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #059669; font-weight: 700;">—</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #e11d48; font-weight: 700;">—</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #d97706; font-weight: 700;">—</td>
      </tr>
    `;
  }).join('');

  const cat = getClassCategory(student.class);
  let streamOrYearText = '';
  if (cat === 'plus_two' && (student.academicStatus?.stream || student.stream)) {
    streamOrYearText = ` (${student.academicStatus?.stream || student.stream})`;
  } else if (cat === 'degree' && (student.academicStatus?.degreeYear || student.degreeYear)) {
    streamOrYearText = ` (${student.academicStatus?.degreeYear || student.degreeYear})`;
  }

  const guardianName = student.familyDetails?.guardian === 'Other'
    ? (student.familyDetails?.guardianName || '-')
    : (student.familyDetails?.fatherName || student.familyDetails?.motherName || '-');
  const guardianMobile = student.familyDetails?.fatherMobile || student.familyDetails?.motherNumber || student.familyDetails?.guardianNumber || '-';

  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 24px; max-width: 820px; margin: 0 auto; line-height: 1.4;">
      <!-- Header -->
      <div style="border-bottom: 2.5px solid #1e4d5f; padding-bottom: 12px; margin-bottom: 18px;">
        <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.1em; color: #1e4d5f; text-transform: uppercase;">STUDENT ATTENDANCE RECORD</div>
        <h1 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 4px 0 2px; letter-spacing: -0.02em;">INDIVIDUAL ATTENDANCE REPORT</h1>
        <div style="font-size: 11px; font-weight: 600; color: #475569;">
          Academic Year: <strong style="color: #0f172a;">[${escapeHtml(String(yearVal))}]</strong> | Status As Of: <strong style="color: #0f172a;">[${todayStr}]</strong>
        </div>
      </div>

      <!-- 1. STUDENT IDENTIFICATION -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 11px; font-weight: 900; color: #1e4d5f; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px;">
          1. STUDENT IDENTIFICATION
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 10.5px;">
          <tbody>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 700; color: #334155; width: 22%;">Student Name</td>
              <td style="border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 800; color: #0f172a; width: 28%;">${escapeHtml(student.name)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 700; color: #334155; width: 22%;">Student ID</td>
              <td style="border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 800; font-family: monospace; color: #0f172a; width: 28%;">${escapeHtml(String(student.studentId))}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 700; color: #334155;">Class / Stream</td>
              <td style="border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 700; color: #0f172a;">${escapeHtml(student.class)}${escapeHtml(streamOrYearText)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 700; color: #334155;">Roll No.</td>
              <td style="border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 700; color: #0f172a;">${escapeHtml(student.roll || '-')}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 700; color: #334155;">Guardian Name</td>
              <td style="border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(guardianName)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 700; color: #334155;">Contact Mobile</td>
              <td style="border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(guardianMobile)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 2. OVERALL ATTENDANCE SUMMARY -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 11px; font-weight: 900; color: #1e4d5f; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px;">
          2. OVERALL ATTENDANCE SUMMARY
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11px; text-align: center;">
          <thead>
            <tr style="background: #1e4d5f; color: #ffffff;">
              <th style="padding: 8px; border: 1px solid #1e4d5f; font-weight: 800; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase;">TOTAL SESSIONS</th>
              <th style="padding: 8px; border: 1px solid #1e4d5f; font-weight: 800; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase;">PRESENT</th>
              <th style="padding: 8px; border: 1px solid #1e4d5f; font-weight: 800; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase;">ABSENT</th>
              <th style="padding: 8px; border: 1px solid #1e4d5f; font-weight: 800; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase;">LEAVE</th>
              <th style="padding: 8px; border: 1px solid #1e4d5f; font-weight: 800; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase;">ATTENDANCE %</th>
            </tr>
          </thead>
          <tbody>
            <tr style="font-weight: 800; font-size: 13px;">
              <td style="border: 1px solid #cbd5e1; padding: 10px; color: #0f172a;">${totalSessions}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; color: #059669;">${presentCount}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; color: #e11d48;">${absentCount}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; color: #d97706;">${leaveCount}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; color: #1e4d5f;">${attPercentage}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3. MONTH-WISE ATTENDANCE BREAKDOWN -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 11px; font-weight: 900; color: #1e4d5f; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px;">
          3. MONTH-WISE ATTENDANCE BREAKDOWN
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 10px;">
          <thead>
            <tr style="background: #f1f5f9; color: #334155;">
              <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-weight: 800; text-transform: uppercase;">MONTH</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: 800; text-transform: uppercase;">TOTAL SESSIONS</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: 800; text-transform: uppercase;">PRESENT</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: 800; text-transform: uppercase;">ABSENT</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: 800; text-transform: uppercase;">LEAVE</th>
            </tr>
          </thead>
          <tbody>
            ${monthRowsHtml}
            <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #94a3b8;">
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #0f172a;">Total (Year to Date)</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #0f172a;">${totalSessions}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #059669;">${presentCount}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #e11d48;">${absentCount}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #d97706;">${leaveCount}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 4. TEACHER'S REMARKS & OBSERVATIONS (FREE FOR HANDWRITING) -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 900; color: #1e4d5f; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px;">
          4. TEACHER'S REMARKS & OBSERVATIONS
        </div>
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; min-height: 75px; background: #fafafa; color: #94a3b8; font-size: 10px; font-style: italic;">
          [Enter remarks regarding attendance regularity, medical leaves, or parent consultation notes...]
        </div>
      </div>

      <!-- Signatures -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; padding-top: 35px; text-align: center; margin-bottom: 20px;">
        <div>
          <div style="border-top: 1px solid #475569; padding-top: 6px; font-weight: 800; font-size: 10px; color: #1e293b;">Class Teacher Signature</div>
        </div>
        <div>
          <div style="border-top: 1px solid #475569; padding-top: 6px; font-weight: 800; font-size: 10px; color: #1e293b;">Parent / Guardian Signature</div>
        </div>
        <div>
          <div style="border-top: 1px solid #475569; padding-top: 6px; font-weight: 800; font-size: 10px; color: #1e293b;">Principal / Head Signature</div>
        </div>
      </div>

      <!-- Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 12px;">
        <span>Individual Student Attendance Report</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  `;

  const sheet = document.getElementById('profile-report-print-sheet');
  if (sheet) {
    sheet.innerHTML = html;
    closeIndividualAttendanceModal();
    document.body.classList.add('printing-profile-report');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-profile-report');
    }, 1200);
  }
}

async function openIndividualStudentDataModal() {
  closePrintDataChoiceModal();
  const modal = document.getElementById('modal-individual-student-data');
  if (!modal) return;

  if (!classesList || classesList.length === 0) {
    try { await loadClasses(); } catch (_) {}
  }
  if (!cachedAllStudents || cachedAllStudents.length === 0) {
    try {
      const res = await API.getStudents('all');
      if (res && res.data) cachedAllStudents = res.data;
    } catch (_) {}
  }

  const classSelect = document.getElementById('stu-indiv-class-select') || document.getElementById('stu-indiv-class');
  if (classSelect) {
    const combinedClasses = [...(classesList || []), ...((typeof pwClassesList !== 'undefined' && Array.isArray(pwClassesList)) ? pwClassesList : [])];
    const seenClasses = new Set();
    const uniqueClasses = [];
    combinedClasses.forEach(c => {
      const cName = (c.name || c || '').trim();
      if (cName && !seenClasses.has(cName.toLowerCase())) {
        seenClasses.add(cName.toLowerCase());
        uniqueClasses.push(c);
      }
    });
    classSelect.innerHTML = uniqueClasses.map(c => {
      const cName = c.name || c;
      return `<option value="${escapeHtml(cName)}">${escapeHtml(cName)}</option>`;
    }).join('');
  }

  handleIndivStudentDataClassChanged();
  modal.classList.remove('hidden');
}

function closeIndividualStudentDataModal() {
  const modal = document.getElementById('modal-individual-student-data');
  if (modal) modal.classList.add('hidden');
}

function handleIndivStudentDataClassChanged() {
  const classSelect = document.getElementById('stu-indiv-class-select') || document.getElementById('stu-indiv-class');
  const classVal = classSelect?.value || '';
  const stuSelect = document.getElementById('stu-indiv-student-select') || document.getElementById('stu-indiv-student');
  if (stuSelect) {
    const combinedStudents = [...(cachedAllStudents || []), ...((typeof pwStudentsList !== 'undefined' && Array.isArray(pwStudentsList)) ? pwStudentsList : [])];
    const seenStu = new Set();
    const filteredStudents = [];
    combinedStudents.forEach(s => {
      const sId = String(s.studentId || s._id || '');
      if (isClassEqual(s.class, classVal) && sId && !seenStu.has(sId)) {
        seenStu.add(sId);
        filteredStudents.push(s);
      }
    });
    filteredStudents.sort((a, b) => (parseInt(a.roll, 10) || 0) - (parseInt(b.roll, 10) || 0));
    stuSelect.innerHTML = filteredStudents.map(s => {
      return `<option value="${s._id || s.studentId}" data-id="${s.studentId}" data-roll="${s.roll || ''}" data-name="${escapeQuotes(s.name || '')}">${escapeHtml(s.name)}</option>`;
    }).join('') || '<option value="">No students in this class</option>';
  }
  handleIndivStudentDataStudentChanged();
}
function handleStuIndivClassChanged() {
  handleIndivStudentDataClassChanged();
}

function handleIndivStudentDataStudentChanged() {
  const stuSelect = document.getElementById('stu-indiv-student-select') || document.getElementById('stu-indiv-student');
  const subEl = document.getElementById('stu-indiv-student-sub');
  const nameEl = document.getElementById('stu-indiv-student-fullname');
  if (!stuSelect) return;
  const selOpt = stuSelect.options[stuSelect.selectedIndex];
  if (selOpt && selOpt.value) {
    const sId = selOpt.getAttribute('data-id') || '';
    const roll = selOpt.getAttribute('data-roll') || '';
    const sName = selOpt.getAttribute('data-name') || selOpt.text || '';
    if (nameEl) nameEl.textContent = sName;
    if (subEl) {
      subEl.innerText = `ID: ${sId} • Roll: #${roll}`;
      subEl.classList.remove('hidden');
    }
  } else {
    if (nameEl) nameEl.textContent = 'Select a student';
    if (subEl) {
      subEl.innerText = 'ID: — • Roll: —';
    }
  }
}
function handleStuIndivStudentChanged() {
  handleIndivStudentDataStudentChanged();
}

async function executeIndividualStudentDataPrint() {
  const stuSelect = document.getElementById('stu-indiv-student-select') || document.getElementById('stu-indiv-student');
  if (!stuSelect || !stuSelect.value) {
    showToast('Please select a student', true);
    return;
  }

  const studentVal = stuSelect.value;
  let student = (cachedAllStudents || []).find(s => String(s._id) === String(studentVal) || String(s.studentId) === String(studentVal));
  if (!student) {
    try {
      const res = await API.getStudentById(studentVal);
      if (res && res.success && res.data) student = res.data;
    } catch (_) {}
  }
  if (!student) {
    showToast('Student information not found', true);
    return;
  }

  showToast('Preparing Student Information Record...');

  const cat = getClassCategory(student.class);
  const dob = student.personalDetails?.dob || '-';
  const age = calculateAgeFromDob(dob) || '-';
  const gender = student.personalDetails?.gender || '-';
  const blood = student.personalDetails?.bloodGroup || '-';
  const email = student.personalDetails?.studentEmail || '-';

  const fullAddr = student.address?.fullAddress || student.address || '-';
  const place = student.address?.place || '-';
  const district = student.address?.district || '-';
  const state = student.address?.state || '-';
  const pin = student.address?.pinCode || '-';

  const father = student.familyDetails?.fatherName || '-';
  const fatherMobile = student.familyDetails?.fatherMobile || '-';
  const mother = student.familyDetails?.motherName || '-';
  const motherMobile = student.familyDetails?.motherNumber || '-';
  const guardian = student.familyDetails?.guardian === 'Other'
    ? (student.familyDetails?.guardianName || student.familyDetails?.guardianRelation || '-')
    : (student.familyDetails?.guardian || 'Father');
  const guardianOcc = student.familyDetails?.guardianOccupation || '-';

  // Dynamic Academic Status Rows
  let dynamicAcademicRow = '';
  if (cat === 'plus_two') {
    dynamicAcademicRow = `
      <tr>
        <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Class</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #0f172a; width: 28%;">${escapeHtml(student.class)}</td>
        <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Stream</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #0f172a; width: 28%;">${escapeHtml(student.academicStatus?.stream || student.stream || 'Not specified (e.g. Science, Commerce, Humanities)')}</td>
      </tr>
    `;
  } else if (cat === 'degree') {
    dynamicAcademicRow = `
      <tr>
        <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Class</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #0f172a; width: 28%;">${escapeHtml(student.class)}</td>
        <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Year</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #0f172a; width: 28%;">${escapeHtml(student.academicStatus?.degreeYear || student.degreeYear || 'Not specified')}</td>
      </tr>
    `;
  } else {
    // 5 to 10
    dynamicAcademicRow = `
      <tr>
        <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Class</td>
        <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #0f172a;">${escapeHtml(student.class)}</td>
      </tr>
    `;
  }

  const prevCollege = student.academicStatus?.previousCollege || '-';
  const rank = student.academicStatus?.rank || '-';
  const admNo = student.academicStatus?.admissionNo || '-';
  const admDate = student.academicStatus?.admissionDate || '-';
  const attPct = student.attendancePercentage !== undefined ? `${student.attendancePercentage}%` : 'No sessions recorded yet';

  const photoSrc = isCustomPhoto(student.photoUrl) ? student.photoUrl : '';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 24px; max-width: 820px; margin: 0 auto; line-height: 1.35;">
      <!-- Header with Photo Box in Top Right (Template 2) -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #1e4d5f; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.1em; color: #1e4d5f; text-transform: uppercase;">STUDENT INFORMATION RECORD</div>
          <h1 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 3px 0 2px; letter-spacing: -0.02em; text-transform: uppercase;">${escapeHtml(student.name)}</h1>
          <div style="font-size: 11px; font-weight: 700; color: #475569;">
            Student ID: <strong style="color: #0f172a;">${escapeHtml(String(student.studentId))}</strong> | Roll No.: <strong style="color: #0f172a;">${escapeHtml(student.roll || '-')}</strong> | Class: <strong style="color: #0f172a;">${escapeHtml(student.class)}</strong>
          </div>
        </div>
        <div style="width: 88px; height: 100px; border: 1.5px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #f8fafc; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 16px;">
          ${photoSrc ? `<img src="${escapeQuotes(photoSrc)}" style="width: 100%; height: 100%; object-fit: cover;" alt="Student Photo">` : `<span style="font-size: 9px; font-weight: 700; color: #94a3b8; text-align: center; padding: 4px;">Student Photo</span>`}
        </div>
      </div>

      <!-- 1. PERSONAL DETAILS -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 11px; font-weight: 900; color: #1e4d5f; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 5px;">
          1. PERSONAL DETAILS
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 10.5px;">
          <tbody>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Date of Birth</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a; width: 28%;">${escapeHtml(dob)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Age</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a; width: 28%;">${escapeHtml(age)}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Gender</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(gender)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Blood Group</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(blood)}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Student Email ID</td>
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(email)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 2. ADDRESS DETAILS -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 11px; font-weight: 900; color: #1e4d5f; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 5px;">
          2. ADDRESS DETAILS
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 10.5px;">
          <tbody>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Full Address</td>
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(fullAddr)}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Place</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a; width: 28%;">${escapeHtml(place)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">District</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a; width: 28%;">${escapeHtml(district)}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">State</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(state)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">PIN Code</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(pin)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3. FAMILY & GUARDIAN DETAILS -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 11px; font-weight: 900; color: #1e4d5f; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 5px;">
          3. FAMILY & GUARDIAN DETAILS
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 10.5px;">
          <tbody>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Father</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a; width: 28%;">${escapeHtml(father)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155; width: 22%;">Father's Mobile</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a; width: 28%;">${escapeHtml(fatherMobile)}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Mother</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(mother)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Mother's Mobile</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(motherMobile)}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Guardian</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(guardian)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Guardian Occupation</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(guardianOcc)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 4. ACADEMIC STATUS (DYNAMIC) -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 11px; font-weight: 900; color: #1e4d5f; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 5px;">
          4. ACADEMIC STATUS
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 10.5px;">
          <tbody>
            ${dynamicAcademicRow}
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Previous College</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(prevCollege)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Rank</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(rank)}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Admission No.</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(admNo)}</td>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Admission Date</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(admDate)}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #334155;">Attendance %</td>
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 700; color: #0f172a;">${escapeHtml(attPct)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 5. TEACHERS' REMARKS (FREE FOR HANDWRITING) -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 900; color: #1e4d5f; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 5px;">
          5. TEACHERS' REMARKS
        </div>
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; min-height: 80px; background: #fafafa; color: #94a3b8; font-size: 10px; font-style: italic;">
          [Teacher handwritten evaluation, conduct remarks, and academic progress notes...]
        </div>
      </div>

      <!-- Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 12px;">
        <span>Student Profile Record — ${escapeHtml(student.name)}</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  `;

  const sheet = document.getElementById('profile-report-print-sheet');
  if (sheet) {
    sheet.innerHTML = html;
    closeIndividualStudentDataModal();
    document.body.classList.add('printing-profile-report');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-profile-report');
    }, 1200);
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
    const combinedClasses = [...(classesList || []), ...((typeof pwClassesList !== 'undefined' && Array.isArray(pwClassesList)) ? pwClassesList : [])];
    const seenClasses = new Set();
    const uniqueClasses = [];
    combinedClasses.forEach(c => {
      const cName = (c.name || c || '').trim();
      if (cName && !seenClasses.has(cName.toLowerCase())) {
        seenClasses.add(cName.toLowerCase());
        uniqueClasses.push(c);
      }
    });
    classSelect.innerHTML = `<option value="all">All Classes</option>` +
      uniqueClasses.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
    classSelect.value = currentVal;
  }

  // USER DIRECTIVE: "fistly all check boxes are unticked"
  const container = document.getElementById('export-fields-container');
  if (container) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(c => c.checked = false);
  }

  modal.classList.remove('hidden');
}

function _hasAnySelectedExportField(fields) {
  return fields && Object.values(fields).some(Boolean);
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

// Exact order: all 28 fields matching Add Student modal
function _getSelectedExportFields() {
  return {
    photo: Boolean(document.getElementById('chk-export-photo')?.checked),
    id: Boolean(document.getElementById('chk-export-id')?.checked),
    name: Boolean(document.getElementById('chk-export-name')?.checked),
    class: Boolean(document.getElementById('chk-export-class')?.checked),
    stream: Boolean(document.getElementById('chk-export-stream')?.checked),
    roll: Boolean(document.getElementById('chk-export-roll')?.checked),
    dob: Boolean(document.getElementById('chk-export-dob')?.checked),
    age: Boolean(document.getElementById('chk-export-age')?.checked),
    gender: Boolean(document.getElementById('chk-export-gender')?.checked),
    bloodGroup: Boolean(document.getElementById('chk-export-bloodGroup')?.checked),
    email: Boolean(document.getElementById('chk-export-email')?.checked),
    address: Boolean(document.getElementById('chk-export-address')?.checked),
    place: Boolean(document.getElementById('chk-export-place')?.checked),
    district: Boolean(document.getElementById('chk-export-district')?.checked),
    state: Boolean(document.getElementById('chk-export-state')?.checked),
    pinCode: Boolean(document.getElementById('chk-export-pinCode')?.checked),
    father: Boolean(document.getElementById('chk-export-father')?.checked),
    mobile: Boolean(document.getElementById('chk-export-mobile')?.checked),
    mother: Boolean(document.getElementById('chk-export-mother')?.checked),
    motherNumber: Boolean(document.getElementById('chk-export-motherNumber')?.checked),
    guardian: Boolean(document.getElementById('chk-export-guardian')?.checked),
    guardianOcc: Boolean(document.getElementById('chk-export-guardianOcc')?.checked),
    admNo: Boolean(document.getElementById('chk-export-admNo')?.checked),
    admDate: Boolean(document.getElementById('chk-export-admDate')?.checked),
    year: Boolean(document.getElementById('chk-export-year')?.checked),
    rank: Boolean(document.getElementById('chk-export-rank')?.checked),
    college: Boolean(document.getElementById('chk-export-college')?.checked),
    attendance: Boolean(document.getElementById('chk-export-attendance')?.checked)
  };
}

async function executeStudentPrintA4() {
  const classFilter = document.getElementById('export-student-class')?.value || 'all';
  const fields = _getSelectedExportFields();

  if (!_hasAnySelectedExportField(fields)) {
    showToast('Please select at least one field to include', true);
    return;
  }

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
        const photo = isCustomPhoto(st.photoUrl) ? st.photoUrl : getInitialsAvatar(st.name, '245b70');
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
  const isDedicatedPrint = document.body.classList.contains('printing-attendance-sheet') ||
    document.body.classList.contains('printing-student-roster') ||
    document.body.classList.contains('printing-timetable') ||
    document.body.classList.contains('printing-teacher-activity') ||
    document.body.classList.contains('print-cards-active');

  const reportView = document.getElementById('view-report');
  const printable = document.getElementById('printable-report');
  if (!isDedicatedPrint && reportView && !reportView.classList.contains('hidden') && printable && !printable.classList.contains('hidden')) {
    document.body.classList.add('print-report-active');
  }
});

window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-cards-active');
  document.body.classList.remove('print-report-active');
  document.body.classList.remove('printing-attendance-sheet');
  const printContainer = document.getElementById('attendance-print-sheet');
  if (printContainer) printContainer.innerHTML = '';
});

// CSV Export for chosen fields across student model:
async function executeStudentExportCSV() {
  const classFilter = document.getElementById('export-student-class')?.value || 'all';
  const fields = _getSelectedExportFields();

  if (!_hasAnySelectedExportField(fields)) {
    showToast('Please select at least one field to include', true);
    return;
  }

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
    if (fields.stream) headers.push('Stream / Year');
    if (fields.roll) headers.push('Roll No');
    if (fields.dob) headers.push('Date of Birth');
    if (fields.age) headers.push('Age');
    if (fields.gender) headers.push('Gender');
    if (fields.bloodGroup) headers.push('Blood Group');
    if (fields.email) headers.push('Student Email');
    if (fields.address) headers.push('Address');
    if (fields.place) headers.push('Place');
    if (fields.district) headers.push('District');
    if (fields.state) headers.push('State');
    if (fields.pinCode) headers.push('PIN Code');
    if (fields.father) headers.push("Father's Name");
    if (fields.mobile) headers.push("Father's Number");
    if (fields.mother) headers.push("Mother's Name");
    if (fields.motherNumber) headers.push("Mother's Number");
    if (fields.guardian) headers.push('Guardian');
    if (fields.guardianOcc) headers.push('Guardian Occupation');
    if (fields.admNo) headers.push('Admission No.');
    if (fields.admDate) headers.push('Admission Date');
    if (fields.year) headers.push('Year Joined');
    if (fields.rank) headers.push('Rank');
    if (fields.college) headers.push('Previous College');
    if (fields.attendance) headers.push('Attendance %');

    const csvRows = [headers.join(',')];

    students.forEach(st => {
      const row = [];
      const fatherName = (st.familyDetails && st.familyDetails.fatherName) || '';
      const fatherMobile = (st.familyDetails && st.familyDetails.fatherMobile) || '';
      const motherName = (st.familyDetails && st.familyDetails.motherName) || '';
      const motherNumber = (st.familyDetails && (st.familyDetails.motherNumber || st.familyDetails.motherMobile)) || '';
      const guardian = (st.familyDetails && st.familyDetails.guardianName) ? `${st.familyDetails.guardianName} (${st.familyDetails.guardianRelation || 'Guardian'})` : ((st.familyDetails && (st.familyDetails.guardian || st.familyDetails.guardianType)) || '');
      const guardianOcc = (st.familyDetails && st.familyDetails.guardianOccupation) || '';
      const address = (st.address && st.address.fullAddress) || '';
      const place = (st.address && st.address.place) || '';
      const district = (st.address && st.address.district) || '';
      const state = (st.address && st.address.state) || '';
      const pinCode = (st.address && st.address.pinCode) || '';
      const dob = (st.personalDetails && st.personalDetails.dob) || '';
      const age = (st.personalDetails && st.personalDetails.age) ? String(st.personalDetails.age) : (dob && typeof calculateAge === 'function' ? String(calculateAge(dob) || '') : '');
      const gender = (st.personalDetails && st.personalDetails.gender) || '';
      const bloodGroup = (st.personalDetails && st.personalDetails.bloodGroup) || '';
      const email = (st.personalDetails && st.personalDetails.studentEmail) || '';
      const streamOrYear = (st.academicStatus && (st.academicStatus.stream || st.academicStatus.degreeYear)) || '';
      const admNo = (st.academicStatus && st.academicStatus.admissionNo) || '';
      const admDate = (st.academicStatus && st.academicStatus.admissionDate) || '';
      const yearJoined = (st.academicStatus && st.academicStatus.yearJoined) || '';
      const rank = (st.academicStatus && st.academicStatus.rank) || '';
      const prevCollege = (st.academicStatus && st.academicStatus.previousCollege) || '';
      const attPercent = st.attendancePercentage !== undefined ? `${st.attendancePercentage}%` : '';

      if (fields.photo) row.push(`"${(st.photoUrl || '').replace(/"/g, '""')}"`);
      if (fields.id) row.push(`"${st.studentId}"`);
      if (fields.name) row.push(`"${(st.name || '').replace(/"/g, '""')}"`);
      if (fields.class) row.push(`"${(st.class || '').replace(/"/g, '""')}"`);
      if (fields.stream) row.push(`"${streamOrYear.replace(/"/g, '""')}"`);
      if (fields.roll) row.push(`"${st.roll !== undefined ? st.roll : ''}"`);
      if (fields.dob) row.push(`"${dob.replace(/"/g, '""')}"`);
      if (fields.age) row.push(`"${age.replace(/"/g, '""')}"`);
      if (fields.gender) row.push(`"${gender.replace(/"/g, '""')}"`);
      if (fields.bloodGroup) row.push(`"${bloodGroup.replace(/"/g, '""')}"`);
      if (fields.email) row.push(`"${email.replace(/"/g, '""')}"`);
      if (fields.address) row.push(`"${address.replace(/"/g, '""')}"`);
      if (fields.place) row.push(`"${place.replace(/"/g, '""')}"`);
      if (fields.district) row.push(`"${district.replace(/"/g, '""')}"`);
      if (fields.state) row.push(`"${state.replace(/"/g, '""')}"`);
      if (fields.pinCode) row.push(`"${pinCode.replace(/"/g, '""')}"`);
      if (fields.father) row.push(`"${fatherName.replace(/"/g, '""')}"`);
      if (fields.mobile) row.push(`"${fatherMobile.replace(/"/g, '""')}"`);
      if (fields.mother) row.push(`"${motherName.replace(/"/g, '""')}"`);
      if (fields.motherNumber) row.push(`"${motherNumber.replace(/"/g, '""')}"`);
      if (fields.guardian) row.push(`"${guardian.replace(/"/g, '""')}"`);
      if (fields.guardianOcc) row.push(`"${guardianOcc.replace(/"/g, '""')}"`);
      if (fields.admNo) row.push(`"${admNo.replace(/"/g, '""')}"`);
      if (fields.admDate) row.push(`"${admDate.replace(/"/g, '""')}"`);
      if (fields.year) row.push(`"${yearJoined.replace(/"/g, '""')}"`);
      if (fields.rank) row.push(`"${rank.replace(/"/g, '""')}"`);
      if (fields.college) row.push(`"${prevCollege.replace(/"/g, '""')}"`);
      if (fields.attendance) row.push(`"${attPercent.replace(/"/g, '""')}"`);

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

async function executeStudentRosterPrintA4() {
  const classFilter = document.getElementById('export-student-class')?.value || 'all';
  const fields = _getSelectedExportFields();

  if (!_hasAnySelectedExportField(fields)) {
    showToast('Please select at least one field to include in the roster', true);
    return;
  }

  try {
    showToast('Generating Printable Student Roster...');
    const res = await API.getStudents(classFilter === 'all' ? 'all' : classFilter);
    const students = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

    if (students.length === 0) {
      showToast('No students found for selected class', true);
      return;
    }

    const schoolTitle = (appSettings && appSettings.schoolName)
      ? appSettings.schoolName
      : (appSettings && appSettings.appName ? appSettings.appName : 'REGISTERLY');

    const printContainer = document.getElementById('student-roster-print-sheet');
    if (!printContainer) return;

    // Build dynamic column headers & cell renderers based exclusively on ticked checkboxes
    const cols = [];
    cols.push({ label: '#', align: 'center', width: '35px', render: (st, idx) => idx + 1 });
    if (fields.photo) cols.push({ label: 'Photo', align: 'center', width: '45px', render: st => {
      const p = isCustomPhoto(st.photoUrl) ? st.photoUrl : getInitialsAvatar(st.name, '245b70');
      return `<img src="${p}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;display:inline-block;border:1px solid #cbd5e1;">`;
    }});
    if (fields.id) cols.push({ label: 'ID', align: 'left', render: st => st.studentId || st._id || '-' });
    if (fields.roll) cols.push({ label: 'Roll', align: 'center', width: '45px', render: st => st.roll !== undefined ? st.roll : '-' });
    if (fields.name) cols.push({ label: 'Student Name', align: 'left', render: st => `<b>${escapeHtml(st.name || '-')}</b>` });
    if (fields.class) cols.push({ label: 'Class', align: 'center', render: st => escapeHtml(st.class || classFilter) });
    if (fields.stream) cols.push({ label: 'Stream/Year', align: 'center', render: st => escapeHtml((st.academicStatus && (st.academicStatus.stream || st.academicStatus.degreeYear)) || '-') });
    if (fields.dob) cols.push({ label: 'DOB', align: 'center', render: st => escapeHtml((st.personalDetails && st.personalDetails.dob) || '-') });
    if (fields.age) cols.push({ label: 'Age', align: 'center', render: st => escapeHtml((st.personalDetails && st.personalDetails.age) ? `${st.personalDetails.age}` : (st.personalDetails?.dob && typeof calculateAge === 'function' ? `${calculateAge(st.personalDetails.dob) || '-'}` : '-')) });
    if (fields.gender) cols.push({ label: 'Gender', align: 'center', render: st => escapeHtml((st.personalDetails && st.personalDetails.gender) || '-') });
    if (fields.bloodGroup) cols.push({ label: 'Blood', align: 'center', render: st => escapeHtml((st.personalDetails && st.personalDetails.bloodGroup) || '-') });
    if (fields.email) cols.push({ label: 'Email', align: 'left', render: st => escapeHtml((st.personalDetails && st.personalDetails.studentEmail) || '-') });
    if (fields.mobile) cols.push({ label: "Father's No.", align: 'left', render: st => escapeHtml((st.familyDetails && st.familyDetails.fatherMobile) || '-') });
    if (fields.father) cols.push({ label: "Father's Name", align: 'left', render: st => escapeHtml((st.familyDetails && st.familyDetails.fatherName) || '-') });
    if (fields.mother) cols.push({ label: "Mother's Name", align: 'left', render: st => escapeHtml((st.familyDetails && st.familyDetails.motherName) || '-') });
    if (fields.motherNumber) cols.push({ label: "Mother's No.", align: 'left', render: st => escapeHtml((st.familyDetails && (st.familyDetails.motherNumber || st.familyDetails.motherMobile)) || '-') });
    if (fields.guardian) cols.push({ label: 'Guardian', align: 'left', render: st => escapeHtml((st.familyDetails && st.familyDetails.guardianName) ? `${st.familyDetails.guardianName} (${st.familyDetails.guardianRelation || 'Guardian'})` : ((st.familyDetails && (st.familyDetails.guardian || st.familyDetails.guardianType)) || '-')) });
    if (fields.guardianOcc) cols.push({ label: 'Guardian Occ.', align: 'left', render: st => escapeHtml((st.familyDetails && st.familyDetails.guardianOccupation) || '-') });
    if (fields.place) cols.push({ label: 'Place', align: 'left', render: st => escapeHtml((st.address && st.address.place) || '-') });
    if (fields.district) cols.push({ label: 'District', align: 'left', render: st => escapeHtml((st.address && st.address.district) || '-') });
    if (fields.state) cols.push({ label: 'State', align: 'left', render: st => escapeHtml((st.address && st.address.state) || '-') });
    if (fields.pinCode) cols.push({ label: 'PIN', align: 'center', render: st => escapeHtml((st.address && st.address.pinCode) || '-') });
    if (fields.address) cols.push({ label: 'Address', align: 'left', render: st => escapeHtml((st.address && st.address.fullAddress) || '-') });
    if (fields.admNo) cols.push({ label: 'Adm No.', align: 'center', render: st => escapeHtml((st.academicStatus && st.academicStatus.admissionNo) || '-') });
    if (fields.admDate) cols.push({ label: 'Adm Date', align: 'center', render: st => escapeHtml((st.academicStatus && st.academicStatus.admissionDate) || '-') });
    if (fields.year) cols.push({ label: 'Year Joined', align: 'center', render: st => escapeHtml((st.academicStatus && st.academicStatus.yearJoined) || '-') });
    if (fields.rank) cols.push({ label: 'Rank', align: 'center', render: st => escapeHtml((st.academicStatus && st.academicStatus.rank) || '-') });
    if (fields.college) cols.push({ label: 'Previous College', align: 'left', render: st => escapeHtml((st.academicStatus && st.academicStatus.previousCollege) || '-') });
    if (fields.attendance) cols.push({ label: 'Attendance %', align: 'center', render: st => escapeHtml(st.attendancePercentage !== undefined ? `${st.attendancePercentage}%` : '-') });
    cols.push({ label: 'Remarks / Sign', align: 'center', width: '90px', render: () => '' });

    const classLabel = classFilter === 'all' ? 'All Classes' : classFilter;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    let html = `
      <div style="font-family: Arial, sans-serif; padding: 10px 14px; color: #0f172a; max-width: 900px; margin: 0 auto; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 1.5px solid #245b70; padding-bottom: 6px; margin-bottom: 8px;">
          <div>
            <h1 style="font-size: 16px; font-weight: 900; margin: 0; color: #245b70; letter-spacing: 0.5px;">${escapeHtml(schoolTitle)}</h1>
            <h2 style="font-size: 11px; font-weight: 700; margin: 1px 0 0; color: #334155;">STUDENT ROSTER / REGISTER SHEET</h2>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b; font-weight: 600; line-height: 1.3;">
            <div>Class: <b style="color:#0f172a;">${escapeHtml(classLabel)}</b></div>
            <div>Total Students: <b style="color:#0f172a;">${students.length}</b></div>
            <div>Date: ${dateStr}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;">
          <thead>
            <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1.5px solid #64748b;">
              ${cols.map(c => `<th style="padding: 4px 6px; text-align: ${c.align}; font-size: 8.5pt; font-weight: 800; color: #1e293b; ${c.width ? `width:${c.width};` : ''}">${c.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${students.map((st, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #fafafa;' : ''}">
                ${cols.map(c => `<td style="padding: 3px 6px; text-align: ${c.align}; font-size: 8.5pt; line-height: 1.25; vertical-align: middle;">${c.render(st, idx)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 16px; display: flex; justify-content: space-between; font-size: 9.5pt; color: #475569; page-break-inside: avoid; break-inside: avoid;">
          <div style="border-top: 1px dashed #94a3b8; width: 180px; padding-top: 4px; text-align: center;">
            Class Teacher Signature
          </div>
          <div style="border-top: 1px dashed #94a3b8; width: 180px; padding-top: 4px; text-align: center;">
            Principal / Admin Signature
          </div>
        </div>
      </div>
    `;

    printContainer.innerHTML = html;
    closeStudentExportModal();

    document.body.classList.add('printing-student-roster');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-student-roster');
      printContainer.innerHTML = '';
    }, { once: true });

    setTimeout(() => { window.print(); }, 250);

  } catch (err) {
    showToast('Failed to prepare student roster: ' + (err.message || 'Error'), true);
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
    const combinedClasses = [...(classesList || []), ...((typeof pwClassesList !== 'undefined' && Array.isArray(pwClassesList)) ? pwClassesList : [])];
    const seenClasses = new Set();
    const uniqueClasses = [];
    combinedClasses.forEach(c => {
      const cName = (c.name || c || '').trim();
      if (cName && !seenClasses.has(cName.toLowerCase())) {
        seenClasses.add(cName.toLowerCase());
        uniqueClasses.push(c);
      }
    });
    classSelect.innerHTML = `<option value="all">All Classes</option>` +
      uniqueClasses.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
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

  let filteredSubjects = [...(subjectsList || []), ...((typeof pwSubjectsList !== 'undefined' && Array.isArray(pwSubjectsList)) ? pwSubjectsList : [])];
  if (classVal !== 'all') {
    const classSubs = filteredSubjects.filter(s => {
      const assigned = Array.isArray(s.assignedClasses) ? s.assignedClasses : [];
      if (assigned.length > 0 && classListIncludes(assigned, classVal)) return true;
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
      `"Student ID","Name","Roll No","Class","Subject","Year","Month","Total Sessions","Present","Absent","Leave","Percentage (%)","Status"`
    ];

    data.forEach(row => {
      const effStatus = row.status || (row.percent >= 90 ? 'Excellent' : row.percent >= 75 ? 'Regular' : row.percent >= 60 ? 'Warning' : 'Critical');
      const csvRow = [
        `"${row.studentId !== undefined ? row.studentId : ''}"`,
        `"${(row.name || '').replace(/"/g, '""')}"`,
        `"${row.roll !== undefined ? row.roll : ''}"`,
        `"${(row.class || classDisplay).replace(/"/g, '""')}"`,
        `"${subjectDisplay.replace(/"/g, '""')}"`,
        `"${yearDisplay.replace(/"/g, '""')}"`,
        `"${monthDisplay.replace(/"/g, '""')}"`,
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

async function generateAndPrintAttendanceSheet({ classVal = 'all', subjectVal = 'whole', yearVal = 'all', monthVal = 'all-year' } = {}) {
  try {
    showToast('Preparing A4 Attendance Sheet...');
    const res = await API.getClassReport(classVal, yearVal, monthVal, subjectVal);
    const data = (res && res.data) ? res.data : [];

    if (!data || data.length === 0) {
      showToast('No attendance records found for selected filters', true);
      return;
    }

    const monthNames = {
      'all-year': 'All Months',
      '01': 'January', '02': 'February', '03': 'March', '04': 'April',
      '05': 'May', '06': 'June', '07': 'July', '08': 'August',
      '09': 'September', '10': 'October', '11': 'November', '12': 'December',
      '1': 'January', '2': 'February', '3': 'March', '4': 'April',
      '5': 'May', '6': 'June', '7': 'July', '8': 'August', '9': 'September'
    };
    const monthDisplay = monthNames[monthVal] || (monthVal === 'all-year' ? 'All Months' : monthVal);
    const subjectDisplay = (subjectVal === 'whole' || subjectVal === 'all') ? 'All Subjects' : subjectVal;
    const classDisplay = (classVal === 'all') ? 'All Classes' : classVal;
    const yearDisplay = (yearVal === 'all') ? 'All Years' : yearVal;

    const schoolTitle = (appSettings && appSettings.schoolName)
      ? appSettings.schoolName
      : (appSettings && appSettings.appName ? appSettings.appName : 'REGISTERLY');

    const totalStudents = data.length;
    const totalSessions = data[0]?.sessions || (res.summary?.totalSessions || 0);
    const avgPercent = res.summary?.classAverage !== undefined
      ? res.summary.classAverage
      : Math.round(data.reduce((acc, r) => acc + (r.percent || 0), 0) / (totalStudents || 1));

    const totalPresent = data.reduce((acc, r) => acc + (r.present || 0), 0);
    const totalAbsent = data.reduce((acc, r) => acc + (r.absent || 0), 0);
    const totalLeave = data.reduce((acc, r) => acc + (r.leave || r.late || 0), 0);

    const printContainer = document.getElementById('attendance-print-sheet');
    if (!printContainer) return;

    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    let html = `
      <div style="font-family: Arial, sans-serif; padding: 10px 14px; color: #0f172a; max-width: 900px; margin: 0 auto; background: #fff;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 1.5px solid #245b70; padding-bottom: 6px; margin-bottom: 8px;">
          <div>
            <h1 style="font-size: 16px; font-weight: 900; margin: 0; color: #245b70; letter-spacing: 0.5px;">${escapeHtml(schoolTitle)}</h1>
            <h2 style="font-size: 11px; font-weight: 700; margin: 1px 0 0; color: #334155;">MONTHLY ATTENDANCE REPORT</h2>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b; font-weight: 600; line-height: 1.3;">
            <div>Class: <b style="color:#0f172a;">${escapeHtml(classDisplay)}</b></div>
            <div>Subject: <b style="color:#0f172a;">${escapeHtml(subjectDisplay)}</b></div>
            <div>Period: <b style="color:#0f172a;">${escapeHtml(monthDisplay)} ${escapeHtml(yearDisplay)}</b></div>
            <div>Printed: ${dateStr}</div>
          </div>
        </div>

        <!-- KPI Summary Cards (Compact) -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px;">
          <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; background: #f8fafc; text-align: center;">
            <div style="font-size: 8.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Average Attendance</div>
            <div style="font-size: 12pt; font-weight: 900; color: #245b70; margin-top: 1px;">${avgPercent}%</div>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; background: #f8fafc; text-align: center;">
            <div style="font-size: 8.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Students</div>
            <div style="font-size: 12pt; font-weight: 900; color: #0f172a; margin-top: 1px;">${totalStudents}</div>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; background: #f8fafc; text-align: center;">
            <div style="font-size: 8.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Sessions</div>
            <div style="font-size: 12pt; font-weight: 900; color: #0f172a; margin-top: 1px;">${totalSessions}</div>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; background: #f8fafc; text-align: center;">
            <div style="font-size: 8.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Present / Absent / Leave</div>
            <div style="font-size: 10.5pt; font-weight: 900; color: #0f172a; margin-top: 2px;">
              <span style="color:#16a34a;">${totalPresent}</span> / <span style="color:#dc2626;">${totalAbsent}</span> / <span style="color:#d97706;">${totalLeave}</span>
            </div>
          </div>
        </div>

        <!-- Attendance Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;">
          <thead>
            <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1.5px solid #64748b;">
              <th style="padding: 4px 6px; text-align: center; width: 40px; font-size: 8.5pt; font-weight: 800;">Roll</th>
              <th style="padding: 4px 6px; text-align: left; font-size: 8.5pt; font-weight: 800;">Student Name</th>
              <th style="padding: 4px 4px; text-align: center; width: 55px; font-size: 8.5pt; font-weight: 800;">Sessions</th>
              <th style="padding: 4px 4px; text-align: center; width: 55px; font-size: 8.5pt; font-weight: 800; color: #16a34a;">Present</th>
              <th style="padding: 4px 4px; text-align: center; width: 55px; font-size: 8.5pt; font-weight: 800; color: #dc2626;">Absent</th>
              <th style="padding: 4px 4px; text-align: center; width: 50px; font-size: 8.5pt; font-weight: 800; color: #d97706;">Leave</th>
              <th style="padding: 4px 4px; text-align: center; width: 60px; font-size: 8.5pt; font-weight: 800;">Percent</th>
              <th style="padding: 4px 6px; text-align: center; width: 70px; font-size: 8.5pt; font-weight: 800;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((row, idx) => {
              const effStatus = row.status || (row.percent >= 90 ? 'Excellent' : row.percent >= 75 ? 'Regular' : row.percent >= 60 ? 'Warning' : 'Critical');
              const statusColor = effStatus === 'Excellent' ? '#16a34a' : effStatus === 'Regular' ? '#2563eb' : effStatus === 'Warning' ? '#d97706' : '#dc2626';
              return `
                <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #fafafa;' : ''}">
                  <td style="padding: 3px 6px; text-align: center; font-weight: 700; font-size: 8.5pt;">${row.roll !== undefined ? row.roll : '-'}</td>
                  <td style="padding: 3px 6px; text-align: left; font-weight: 700; font-size: 8.5pt;">${escapeHtml(row.name || '-')}</td>
                  <td style="padding: 3px 4px; text-align: center; font-size: 8.5pt;">${row.sessions !== undefined ? row.sessions : 0}</td>
                  <td style="padding: 3px 4px; text-align: center; font-weight: 700; color: #16a34a; font-size: 8.5pt;">${row.present !== undefined ? row.present : 0}</td>
                  <td style="padding: 3px 4px; text-align: center; font-weight: 700; color: #dc2626; font-size: 8.5pt;">${row.absent !== undefined ? row.absent : 0}</td>
                  <td style="padding: 3px 4px; text-align: center; color: #d97706; font-size: 8.5pt;">${row.leave !== undefined ? row.leave : (row.late !== undefined ? row.late : 0)}</td>
                  <td style="padding: 3px 4px; text-align: center; font-weight: 800; font-size: 8.5pt;">${row.percent !== undefined ? row.percent : 100}%</td>
                  <td style="padding: 3px 6px; text-align: center; font-weight: 700; color: ${statusColor}; font-size: 8.5pt;">${effStatus}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Sign-off Footer -->
        <div style="margin-top: 16px; display: flex; justify-content: space-between; font-size: 9.5pt; color: #475569; page-break-inside: avoid; break-inside: avoid;">
          <div style="border-top: 1px dashed #94a3b8; width: 180px; padding-top: 4px; text-align: center;">
            Class Teacher Signature
          </div>
          <div style="border-top: 1px dashed #94a3b8; width: 180px; padding-top: 4px; text-align: center;">
            Principal / Head Signature
          </div>
        </div>
      </div>
    `;

    printContainer.innerHTML = html;

    document.body.classList.add('printing-attendance-sheet');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-attendance-sheet');
      printContainer.innerHTML = '';
    }, { once: true });

    setTimeout(() => { window.print(); }, 250);

  } catch (err) {
    showToast('Failed to prepare attendance sheet: ' + (err.message || 'Error'), true);
  }
}

async function executeAttendancePrintA4() {
  const classVal = document.getElementById('export-att-class')?.value || 'all';
  const subjectVal = document.getElementById('export-att-subject')?.value || 'whole';
  const yearVal = document.getElementById('export-att-year')?.value || 'all';
  const monthVal = document.getElementById('export-att-month')?.value || 'all-year';

  closeAttendanceExportModal();
  await generateAndPrintAttendanceSheet({ classVal, subjectVal, yearVal, monthVal });
}

// ================= TEACHER ACTIVITY & SESSION REPORT =================
async function openTeacherActivityExportModal(defaultTeacherId = null) {
  const modal = document.getElementById('modal-teacher-activity-export');
  if (!modal) return;

  // 1. Populate Teachers Dropdown so Admins and Teachers can select any teacher
  try {
    let teachers = cachedTeachersList;
    if (!teachers || teachers.length === 0) {
      const tRes = await API.getTeachers();
      teachers = (tRes && tRes.data) ? tRes.data : (Array.isArray(tRes) ? tRes : []);
      cachedTeachersList = teachers;
    }

    const teacherSelect = document.getElementById('export-tlog-teacher');
    if (teacherSelect && teachers.length > 0) {
      teacherSelect.innerHTML = teachers.map(t =>
        `<option value="${t._id}">${escapeHtml(t.name)}${t.email ? ` (${escapeHtml(t.email)})` : ''}</option>`
      ).join('');

      const myId = currentUser?._id || currentUser?.id;
      if (defaultTeacherId) {
        teacherSelect.value = defaultTeacherId;
      } else if (myId && teachers.some(t => String(t._id) === String(myId))) {
        teacherSelect.value = myId;
      } else {
        teacherSelect.selectedIndex = 0;
      }
    }
  } catch (e) {
    console.error('Failed to load teachers for export modal:', e);
  }

  // 2. Populate Classes
  if (!classesList || classesList.length === 0) {
    try { await loadClasses(); } catch(_) {}
  }

  const classSelect = document.getElementById('export-tlog-class');
  if (classSelect) {
    const currentVal = classSelect.value || 'all';
    classSelect.innerHTML = `<option value="all">All Classes</option>` +
      classesList.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
    classSelect.value = currentVal;
  }

  const yearSelect = document.getElementById('export-tlog-year');
  if (yearSelect && !yearSelect.value) {
    yearSelect.value = String(new Date().getFullYear());
  }

  modal.classList.remove('hidden');
}

function closeTeacherActivityExportModal() {
  const modal = document.getElementById('modal-teacher-activity-export');
  if (modal) modal.classList.add('hidden');
}

function _renderAndPrintTeacherActivitySheet(res, yearVal, classVal) {
  const teacher = res.teacher || currentUser || { name: 'Teacher' };
  const stats = res.stats || {};
  const sessions = res.sessions || [];

  const schoolTitle = (appSettings && appSettings.schoolName)
    ? appSettings.schoolName
    : (appSettings && appSettings.appName ? appSettings.appName : 'REGISTERLY');

  const printContainer = document.getElementById('teacher-activity-print-sheet');
  if (!printContainer) return;

  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  let sessionsHtml = '';
  if (sessions.length === 0) {
    sessionsHtml = `
      <tr>
        <td colspan="8" style="padding: 16px 8px; text-align: center; color: #64748b; font-style: italic;">
          No teaching sessions recorded for the selected class and academic year.
        </td>
      </tr>
    `;
  } else {
    sessionsHtml = sessions.map((s, idx) => {
      const tot = s.totalStudents !== undefined ? s.totalStudents : (s.summary && s.summary.total !== undefined ? s.summary.total : '-');
      const pres = s.presentCount !== undefined ? s.presentCount : (s.summary && s.summary.present !== undefined ? s.summary.present : 0);
      const abs = s.absentCount !== undefined ? s.absentCount : (s.summary && s.summary.absent !== undefined ? s.summary.absent : 0);
      const lve = s.leaveCount !== undefined ? s.leaveCount : (s.summary && (s.summary.leave !== undefined ? s.summary.leave : (s.summary.late || 0)));
      return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #fafafa;' : ''}">
        <td style="padding: 3.5px 6px; text-align: center; color: #64748b; font-size: 8.5pt;">${idx + 1}</td>
        <td style="padding: 3.5px 6px; font-weight: 700; font-size: 8.5pt;">${escapeHtml(s.date || '-')}</td>
        <td style="padding: 3.5px 6px; font-weight: 700; font-size: 8.5pt;">${escapeHtml(s.class || '-')}</td>
        <td style="padding: 3.5px 6px; font-size: 8.5pt;">${escapeHtml(s.subject || '-')}</td>
        <td style="padding: 3.5px 6px; text-align: center; font-size: 8.5pt;">${tot}</td>
        <td style="padding: 3.5px 6px; text-align: center; font-weight: 700; color: #16a34a; font-size: 8.5pt;">${pres}</td>
        <td style="padding: 3.5px 6px; text-align: center; font-weight: 700; color: #dc2626; font-size: 8.5pt;">${abs}</td>
        <td style="padding: 3.5px 6px; text-align: center; color: #d97706; font-size: 8.5pt;">${lve}</td>
      </tr>
      `;
    }).join('');
  }

  let html = `
    <div style="font-family: Arial, sans-serif; padding: 10px 14px; color: #0f172a; max-width: 900px; margin: 0 auto; background: #fff;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 1.5px solid #245b70; padding-bottom: 6px; margin-bottom: 8px;">
        <div>
          <h1 style="font-size: 16px; font-weight: 900; margin: 0; color: #245b70; letter-spacing: 0.5px;">${escapeHtml(schoolTitle)}</h1>
          <h2 style="font-size: 11px; font-weight: 700; margin: 1px 0 0; color: #334155;">TEACHER ACTIVITY & ATTENDANCE LOG</h2>
        </div>
        <div style="text-align: right; font-size: 10px; color: #64748b; font-weight: 600; line-height: 1.3;">
          <div>Teacher: <b style="color:#0f172a;">${escapeHtml(teacher.name || '')}</b></div>
          <div>Email: ${escapeHtml(teacher.email || '-')}</div>
          <div>Year: <b style="color:#0f172a;">${escapeHtml(yearVal === 'all' ? 'All Years' : yearVal)}</b></div>
          <div>Printed: ${dateStr}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px;">
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; background: #f8fafc; text-align: center;">
          <div style="font-size: 8.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Sessions</div>
          <div style="font-size: 12pt; font-weight: 900; color: #245b70; margin-top: 1px;">${stats.totalSessions || sessions.length}</div>
        </div>
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; background: #f8fafc; text-align: center;">
          <div style="font-size: 8.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Active Days</div>
          <div style="font-size: 12pt; font-weight: 900; color: #0f172a; margin-top: 1px;">${stats.totalDays || '-'}</div>
        </div>
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; background: #f8fafc; text-align: center;">
          <div style="font-size: 8.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Classes Handled</div>
          <div style="font-size: 12pt; font-weight: 900; color: #0f172a; margin-top: 1px;">${stats.classesCount || '-'}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;">
        <thead>
          <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1.5px solid #64748b;">
            <th style="padding: 4px 6px; text-align: center; width: 35px; font-size: 8.5pt; font-weight: 800;">#</th>
            <th style="padding: 4px 6px; text-align: left; width: 85px; font-size: 8.5pt; font-weight: 800;">Date</th>
            <th style="padding: 4px 6px; text-align: left; font-size: 8.5pt; font-weight: 800;">Class</th>
            <th style="padding: 4px 6px; text-align: left; font-size: 8.5pt; font-weight: 800;">Subject</th>
            <th style="padding: 4px 6px; text-align: center; width: 65px; font-size: 8.5pt; font-weight: 800;">Students</th>
            <th style="padding: 4px 6px; text-align: center; width: 60px; font-size: 8.5pt; font-weight: 800; color: #16a34a;">Present</th>
            <th style="padding: 4px 6px; text-align: center; width: 60px; font-size: 8.5pt; font-weight: 800; color: #dc2626;">Absent</th>
            <th style="padding: 4px 6px; text-align: center; width: 55px; font-size: 8.5pt; font-weight: 800; color: #d97706;">Leave</th>
          </tr>
        </thead>
        <tbody>
          ${sessionsHtml}
        </tbody>
      </table>

      <div style="margin-top: 16px; display: flex; justify-content: space-between; font-size: 9.5pt; color: #475569; page-break-inside: avoid; break-inside: avoid;">
        <div style="border-top: 1px dashed #94a3b8; width: 180px; padding-top: 4px; text-align: center;">
          Teacher Signature
        </div>
        <div style="border-top: 1px dashed #94a3b8; width: 180px; padding-top: 4px; text-align: center;">
          Principal Verification
        </div>
      </div>
    </div>
  `;

  printContainer.innerHTML = html;
  closeTeacherActivityExportModal();

  document.body.classList.add('printing-teacher-activity');
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-teacher-activity');
    printContainer.innerHTML = '';
  }, { once: true });

  setTimeout(() => { window.print(); }, 250);
}

function _downloadTeacherActivityCSV(teacherName, yearVal, classVal, sessions) {
  if (!sessions || sessions.length === 0) {
    showToast('No sessions found to export', true);
    return;
  }

  const csvRows = [
    `"Teacher","${teacherName.replace(/"/g, '""')}"`,
    `"Year","${yearVal}"`,
    `"Class Filter","${classVal}"`,
    `""`,
    `"Date","Class","Subject","Period","Total Students","Present","Absent","Leave"`
  ];

  sessions.forEach(s => {
    const tot = s.totalStudents !== undefined ? s.totalStudents : (s.summary && s.summary.total !== undefined ? s.summary.total : 0);
    const pres = s.presentCount !== undefined ? s.presentCount : (s.summary && s.summary.present !== undefined ? s.summary.present : 0);
    const abs = s.absentCount !== undefined ? s.absentCount : (s.summary && s.summary.absent !== undefined ? s.summary.absent : 0);
    const lve = s.leaveCount !== undefined ? s.leaveCount : (s.summary && (s.summary.leave !== undefined ? s.summary.leave : (s.summary.late || 0)));
    csvRows.push([
      `"${s.date || ''}"`,
      `"${(s.class || '').replace(/"/g, '""')}"`,
      `"${(s.subject || '').replace(/"/g, '""')}"`,
      `"${(s.period || '').replace(/"/g, '""')}"`,
      `"${tot}"`,
      `"${pres}"`,
      `"${abs}"`,
      `"${lve}"`
    ].join(','));
  });

  const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
  const downloadAnchor = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute("href", csvContent);
  downloadAnchor.setAttribute("download", `Teacher_Activity_${teacherName.replace(/\s+/g, '_')}_${dateTag}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  showToast('Teacher Activity CSV downloaded successfully!');
  closeTeacherActivityExportModal();
}

async function executeTeacherActivityPrintA4() {
  const teacherId = document.getElementById('export-tlog-teacher')?.value || currentUser?._id || currentUser?.id;
  if (!teacherId) {
    showToast('Please select a teacher', true);
    return;
  }

  const classVal = document.getElementById('export-tlog-class')?.value || 'all';
  const yearVal = document.getElementById('export-tlog-year')?.value || 'all';

  try {
    showToast('Fetching teacher activity records...');
    const res = await API.getTeacherLogs(teacherId, yearVal, classVal);
    if (!res || !res.success) {
      showToast('No activity records found', true);
      return;
    }

    _renderAndPrintTeacherActivitySheet(res, yearVal, classVal);
  } catch (err) {
    showToast('Failed to prepare teacher activity report: ' + (err.message || 'Error'), true);
  }
}

async function executeTeacherActivityExportCSV() {
  const teacherId = document.getElementById('export-tlog-teacher')?.value || currentUser?._id || currentUser?.id;
  if (!teacherId) {
    showToast('Please select a teacher', true);
    return;
  }

  const classVal = document.getElementById('export-tlog-class')?.value || 'all';
  const yearVal = document.getElementById('export-tlog-year')?.value || 'all';

  try {
    showToast('Preparing Activity CSV...');
    const res = await API.getTeacherLogs(teacherId, yearVal, classVal);
    const sessions = (res && res.sessions) ? res.sessions : [];
    const teacherName = (res.teacher && res.teacher.name) || currentUser?.name || 'Teacher';
    _downloadTeacherActivityCSV(teacherName, yearVal, classVal, sessions);
  } catch (err) {
    showToast('Export failed: ' + (err.message || 'Error'), true);
  }
}

async function printTeacherLogDirect() {
  if (!currentTeacherLogData || !currentTeacherLogData.teacher) {
    showToast('No teacher log data loaded', true);
    return;
  }
  const teacherId = currentTeacherLogData.teacher.id || currentTeacherLogData.teacher._id;
  const yearVal = document.getElementById('tlog-filter-year')?.value || 'all';
  const classVal = document.getElementById('tlog-filter-class')?.value || 'all';

  try {
    showToast('Preparing Teacher Activity Sheet...');
    const res = await API.getTeacherLogs(teacherId, yearVal, classVal);
    _renderAndPrintTeacherActivitySheet(res, yearVal, classVal);
  } catch (err) {
    showToast('Failed to print teacher report: ' + (err.message || 'Error'), true);
  }
}

async function exportTeacherLogCSVDirect() {
  if (!currentTeacherLogData || !currentTeacherLogData.teacher) {
    showToast('No teacher log data loaded', true);
    return;
  }
  const teacherName = currentTeacherLogData.teacher.name || 'Teacher';
  const yearVal = document.getElementById('tlog-filter-year')?.value || 'all';
  const classVal = document.getElementById('tlog-filter-class')?.value || 'all';

  _downloadTeacherActivityCSV(teacherName, yearVal, classVal, currentTeacherSessions);
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
          <div onclick="dismissTimetableSummary(); jumpToTakeAttendance('${escapeQuotes(slot.class || '')}', '${escapeQuotes(slot.subject || '')}')" class="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-between gap-3 transition cursor-pointer active:scale-98 group">
            <div class="min-w-0 flex-1">
              <div class="text-xs font-black text-white flex items-center gap-1.5 flex-wrap">
                <span class="text-amber-300 font-extrabold">${escapeHtml(timeStr)}</span>
                <span>:</span>
                <span class="text-cyan-100 group-hover:text-cyan-200 transition">${escapeHtml(slot.subject)}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-white/20 text-white font-bold">[${escapeHtml(slot.class)}]</span>
              </div>
              ${slot.room ? `<div class="text-[10px] text-cyan-200/80 mt-0.5">Room: ${escapeHtml(slot.room)}</div>` : ''}
            </div>
            <div class="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 text-cyan-200 group-hover:bg-cyan-500/30 transition">
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
  const myKey = currentUser ? (currentUser._id || currentUser.email || currentUser.name || 'user') : 'user';
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const snoozeUntil = Date.now() + 15 * 60 * 1000;
  try {
    localStorage.setItem(`tt_summary_snooze_${myKey}`, String(snoozeUntil));
    localStorage.removeItem(`tt_summary_${myKey}_${todayStr}`);
  } catch(_) {}
  showToast('Morning timetable snoozed for 15 mins');
}

function dismissTimetableSummary() {
  const modal = document.getElementById('notif-bubble-timetable-modal');
  if (modal) modal.classList.add('hidden');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const myKey = currentUser ? (currentUser._id || currentUser.email || currentUser.name || 'user') : 'user';
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
    const myKey = currentUser ? (currentUser._id || currentUser.email || currentUser.name || 'user') : 'user';
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const snoozeUntil = Date.now() + 2 * 60 * 1000; // Snooze for 2 minutes
    try {
      localStorage.setItem(`tt_preclass_snooze_${myKey}_${slotKey}`, String(snoozeUntil));
      localStorage.removeItem(`tt_notif_5m_${myKey}_${slotKey}_${todayStr}`);
    } catch(_) {}
  }
  showToast('Class reminder snoozed for 2 mins');
}

function dismissPreClassAlert() {
  const card = document.getElementById('notif-preclass-card');
  if (card) card.classList.add('hidden');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const myKey = currentUser ? (currentUser._id || currentUser.email || currentUser.name || 'user') : 'user';
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

    const myAccountKey = String(currentUser._id || currentUser.email || currentUser.name || 'user');
    const myEmail = (currentUser.email || '').trim().toLowerCase();

    // Fetch all timetable slots
    const res = await API.getTimetable('', '', '');
    const allSlots = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

    // USER DIRECTIVE:
    // "only show in 6.00 am time table notification ....time table that connect with email id ..do not show that connected with teacher names"
    // Strictly filter timetable slots connected with user's email ID. Do NOT match by teacher names.
    const mySlots = allSlots.filter(s => {
      const slotEmail = (s.teacherEmail || '').trim().toLowerCase();
      return Boolean(myEmail && slotEmail && slotEmail === myEmail);
    });

    const currentHours = now.getHours();
    const summaryNotifKey = `tt_summary_${myAccountKey}_${todayStr}`;
    const snoozeUntil = parseInt(localStorage.getItem(`tt_summary_snooze_${myAccountKey}`) || '0', 10);
    const isSnoozed = Date.now() < snoozeUntil;

    const allowMorning = localStorage.getItem('admin_notif_morning') !== 'false';
    const allowPreclass = localStorage.getItem('admin_notif_preclass') !== 'false';
    const notifStatus = localStorage.getItem(summaryNotifKey);

    // USER DIRECTIVE: 6.00 AM notification (starts at or after 6:00 AM)
    const isMorningTime = currentHours >= 6;

    // If no timetable slots connected with this account's email ID
    if (mySlots.length === 0) {
      if (allowMorning && isMorningTime && notifStatus !== 'done' && notifStatus !== 'shown' && !isSnoozed) {
        localStorage.setItem(summaryNotifKey, 'shown');

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

    // 1. Daily 6:00 AM morning summary notification for this email account only
    if (allowMorning && isMorningTime && notifStatus !== 'done' && notifStatus !== 'shown' && !isSnoozed) {
      localStorage.setItem(summaryNotifKey, 'shown');

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

    // 2. Notification 5 minutes before every class for this email account only
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
          const slotStatus = localStorage.getItem(slotDoneKey);
          const slotSnoozeUntil = parseInt(localStorage.getItem(`tt_preclass_snooze_${myAccountKey}_${slotKey}`) || '0', 10);
          const isSlotSnoozed = Date.now() < slotSnoozeUntil;

          if (slotStatus !== 'done' && slotStatus !== 'shown' && !isSlotSnoozed) {
            localStorage.setItem(slotDoneKey, 'shown');
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

// ================= TODAY'S SCHEDULE & ATTENDANCE STATUS MODAL =================
async function openTodayScheduleModal() {
  triggerNavHaptic('light');
  const modal = document.getElementById('modal-today-schedule');
  const listEl = document.getElementById('today-schedule-modal-slots-list');
  const titleEl = document.getElementById('today-schedule-modal-title');
  if (!modal || !listEl) return;

  modal.classList.remove('hidden');
  listEl.innerHTML = `<div class="p-8 text-center text-xs text-cyan-200 flex flex-col items-center justify-center gap-2.5"><div class="w-6 h-6 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin"></div><span>Loading today's schedule & attendance...</span></div>`;

  try {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()].toLowerCase();
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const myEmail = (currentUser?.email || '').trim().toLowerCase();
    const myName = (currentUser?.name || '').trim().toLowerCase();
    const isAdmin = currentUser?.role === 'admin';

    // 1. Fetch timetable slots
    const ttRes = await API.getTimetable('', '', myEmail);
    const allSlots = (ttRes && ttRes.data) ? ttRes.data : (Array.isArray(ttRes) ? ttRes : []);
    let mySlots = allSlots.filter(s => (s.teacherEmail || '').trim().toLowerCase() === myEmail);
    if (isAdmin && mySlots.length === 0) mySlots = allSlots;

    const todaySlots = mySlots.filter(s => {
      const d = (s.day || '').trim().toLowerCase();
      const days = Array.isArray(s.days) ? s.days.map(x => x.trim().toLowerCase()) : [];
      const splitDays = d.split(',').map(x => x.trim().toLowerCase());
      return d === todayName || d === 'all days' || splitDays.includes(todayName) || days.includes(todayName) || days.includes('all days');
    });

    // 2. Fetch today's attendance records to check if marked
    let todayAttendances = [];
    try {
      const attRes = await API.getAttendance(todayDateStr);
      todayAttendances = (attRes && attRes.data) ? attRes.data : (Array.isArray(attRes) ? attRes : []);
    } catch (_) {}

    const currentMin = now.getHours() * 60 + now.getMinutes();

    // Sort slots chronologically
    const slotsWithRange = todaySlots.map(s => {
      const range = _parseSlotTimeRange(s.timeSlot || s.time);
      return {
        slot: s,
        startMin: range ? range.startMin : null,
        endMin: range ? range.endMin : null
      };
    }).sort((a, b) => {
      if (a.startMin !== null && b.startMin !== null) return a.startMin - b.startMin;
      return 0;
    });

    if (titleEl) titleEl.textContent = dayNames[now.getDay()] + "'s Schedule (" + todaySlots.length + " Classes)";

    if (todaySlots.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 rounded-2xl bg-white/10 border border-white/15 text-center space-y-1.5">
          <div class="text-sm font-bold text-amber-300">No classes scheduled for today!</div>
          <div class="text-xs text-cyan-100/70">Enjoy your day or check other days in your Timetable.</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = slotsWithRange.map(({ slot: s, startMin, endMin }) => {
      const timeStr = s.timeSlot || s.time || 'Period';
      const isLive = startMin !== null && endMin !== null && currentMin >= startMin && currentMin < endMin;
      const isUpcoming = startMin !== null && currentMin < startMin;
      const isPassed = endMin !== null && currentMin >= endMin;

      // Check if attendance is marked for this class & subject today
      const isMarked = todayAttendances.some(att =>
        isClassEqual(att.class, s.class) &&
        (String(att.subject || '').trim().toLowerCase() === String(s.subject || '').trim().toLowerCase() || att.subject === 'all')
      );

      let statusBadge = '';
      if (isMarked) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 text-[11px] font-black shadow-xs">
            <svg class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Marked</span>
          </span>
        `;
      } else if (isLive) {
        statusBadge = `
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 text-[11px] font-black animate-pulse shadow-xs">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Live Now</span>
          </span>
        `;
      } else if (isUpcoming) {
        const diff = startMin - currentMin;
        const diffText = diff > 0 ? (diff < 60 ? `in ${diff}m` : `in ${Math.floor(diff / 60)}h ${diff % 60}m`) : 'Soon';
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400/20 text-amber-200 border border-amber-300/40 text-[11px] font-bold">
            <svg class="w-3 h-3 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Upcoming (${diffText})</span>
          </span>
        `;
      } else {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/40 text-[11px] font-bold">
            <span>Not Marked</span>
          </span>
        `;
      }

      return `
        <div onclick="jumpToTakeAttendance('${escapeQuotes(s.class || '')}', '${escapeQuotes(s.subject || '')}')" class="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-between gap-3 transition cursor-pointer active:scale-98 group">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-black text-amber-300">${escapeHtml(timeStr)}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-lg bg-white/20 text-white font-extrabold uppercase tracking-wider">${escapeHtml(s.class || '')}</span>
              ${s.room ? `<span class="text-[10px] text-cyan-200/80">Room: ${escapeHtml(s.room)}</span>` : ''}
            </div>
            <div class="text-sm font-black text-white mt-1 truncate group-hover:text-cyan-200 transition">
              ${escapeHtml(s.subject || 'Class')}
            </div>
          </div>
          <div class="flex-shrink-0">
            ${statusBadge}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = `<div class="p-4 text-center text-xs text-rose-300">Error loading schedule: ${escapeHtml(err.message)}</div>`;
  }
}

function closeTodayScheduleModal() {
  const modal = document.getElementById('modal-today-schedule');
  if (modal) modal.classList.add('hidden');
}

async function jumpToTakeAttendance(className, subjectName) {
  closeTodayScheduleModal();

  attendanceReadyToLoad = true;
  if (className) {
    currentClass = className;
    const selClass = document.getElementById('sel-class');
    if (selClass) {
      const matchOpt = Array.from(selClass.options).find(opt => isClassEqual(opt.value, className));
      if (matchOpt) {
        selClass.value = matchOpt.value;
        currentClass = matchOpt.value;
      } else {
        const newOpt = document.createElement('option');
        newOpt.value = className;
        newOpt.textContent = className;
        selClass.appendChild(newOpt);
        selClass.value = className;
        currentClass = className;
      }
    }
  }

  updateAttendanceSubjectsDropdown(currentClass, subjectName);
  if (subjectName) {
    const selSub = document.getElementById('sel-subject');
    if (selSub) {
      const matchSub = Array.from(selSub.options).find(opt => isClassEqual(opt.value, subjectName));
      if (matchSub) {
        selSub.value = matchSub.value;
        currentSubject = matchSub.value;
      } else {
        const newOpt = document.createElement('option');
        newOpt.value = subjectName;
        newOpt.textContent = subjectName;
        selSub.appendChild(newOpt);
        selSub.value = subjectName;
        currentSubject = subjectName;
      }
    }
  }

  const ok = await selectTab('attendance');
  if (!ok) return;

  loadAttendanceRoster();
}


// ================= TODAY'S MARKED ATTENDANCE MODAL =================
async function openTodayMarkedModal() {
  triggerNavHaptic('light');
  const modal = document.getElementById('modal-today-marked');
  const listEl = document.getElementById('today-marked-modal-slots-list');
  const titleEl = document.getElementById('today-marked-modal-title');
  if (!modal || !listEl) return;

  modal.classList.remove('hidden');
  listEl.innerHTML = '<div class="p-8 text-center text-xs text-cyan-200 flex flex-col items-center justify-center gap-2.5"><div class="w-6 h-6 rounded-full border-2 border-emerald-300 border-t-transparent animate-spin"></div><span>Loading marked attendance sessions...</span></div>';

  try {
    const todayDateStr = formatLocalDate(new Date());
    const myEmail = (currentUser?.email || '').trim().toLowerCase();
    const myName = (currentUser?.name || '').trim().toLowerCase();
    const isAdmin = currentUser?.role === 'admin';

    const attRes = await API.getAttendance(todayDateStr);
    const rawList = (attRes && attRes.data !== undefined) ? attRes.data : attRes;
    const todayAttendances = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);

    const myAttendances = todayAttendances.filter(att => isAttendanceMarkedByCurrentUser(att, currentUser));

    if (titleEl) {
      titleEl.textContent = 'Marked Sessions Today (' + myAttendances.length + ')';
    }

    if (myAttendances.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 rounded-2xl bg-white/10 border border-white/15 text-center space-y-1.5">
          <div class="text-sm font-bold text-amber-300">No attendance marked yet today!</div>
          <div class="text-xs text-cyan-100/70">Tap "Today's Classes" to check your schedule and start taking attendance.</div>
        </div>
      `;
      return;
    }

    // Sort by most recently updated
    myAttendances.sort((a, b) => {
      const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tB - tA;
    });

    listEl.innerHTML = myAttendances.map(att => {
      const timeDate = att.updatedAt || att.createdAt;
      let timeStr = 'Today';
      if (timeDate) {
        try {
          const d = new Date(timeDate);
          timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (_) {}
      }

      const total = att.summary?.total || (att.records ? att.records.length : 0);
      const present = att.summary?.present || 0;
      const absent = att.summary?.absent || 0;
      const pct = att.summary?.percentage !== undefined ? att.summary.percentage : (total > 0 ? Math.round((present / total) * 100) : 0);

      return `
        <div onclick="jumpToAttendanceSession('${escapeQuotes(att.class || '')}', '${escapeQuotes(att.subject || '')}', '${escapeQuotes(att.date || '')}')" class="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-between gap-3 transition cursor-pointer active:scale-98 group">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-black text-emerald-300">${escapeHtml(timeStr)}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-lg bg-white/20 text-white font-extrabold uppercase tracking-wider">${escapeHtml(att.class || '')}</span>
              ${att.markedBy ? `<span class="text-[10px] text-cyan-200/70">By: ${escapeHtml(att.markedBy)}</span>` : ''}
            </div>
            <div class="text-sm font-black text-white mt-1 truncate group-hover:text-emerald-200 transition">
              ${escapeHtml(att.subject || 'All Subjects')}
            </div>
          </div>
          <div class="flex-shrink-0 text-right">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 text-[11px] font-black shadow-xs">
              <span>${present}/${total} Present (${pct}%)</span>
            </span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = '<div class="p-4 text-center text-xs text-rose-300">Error loading marked sessions: ' + escapeHtml(err.message) + '</div>';
  }
}

function closeTodayMarkedModal() {
  const modal = document.getElementById('modal-today-marked');
  if (modal) modal.classList.add('hidden');
}

async function jumpToAttendanceSession(className, subjectName, dateStr) {
  closeTodayMarkedModal();
  if (dateStr) {
    currentDateStr = dateStr;
    const picker = document.getElementById('attendance-date-picker');
    if (picker) picker.value = dateStr;
    updateDateDisplay();
  }
  attendanceReadyToLoad = true;
  if (className) {
    currentClass = className;
    const selClass = document.getElementById('sel-class');
    if (selClass) {
      const matchOpt = Array.from(selClass.options).find(opt => isClassEqual(opt.value, className));
      if (matchOpt) {
        selClass.value = matchOpt.value;
        currentClass = matchOpt.value;
      } else {
        const newOpt = document.createElement('option');
        newOpt.value = className;
        newOpt.textContent = className;
        selClass.appendChild(newOpt);
        selClass.value = className;
        currentClass = className;
      }
    }
  }
  updateAttendanceSubjectsDropdown(currentClass, subjectName);
  if (subjectName && subjectName !== 'all') {
    const selSub = document.getElementById('sel-subject');
    if (selSub) {
      const matchSub = Array.from(selSub.options).find(opt => isClassEqual(opt.value, subjectName));
      if (matchSub) {
        selSub.value = matchSub.value;
        currentSubject = matchSub.value;
      } else {
        const newOpt = document.createElement('option');
        newOpt.value = subjectName;
        newOpt.textContent = subjectName;
        selSub.appendChild(newOpt);
        selSub.value = subjectName;
        currentSubject = subjectName;
      }
    }
  } else {
    currentSubject = '';
  }

  const ok = await selectTab('attendance');
  if (!ok) return;
  loadAttendanceRoster();
}

// =========================================================================
// ================= STUDENT PORTAL & SELF-REGISTRATION SYSTEM =============
// =========================================================================
let currentStudentData = null;
let currentStudentPortalTab = 'profile';
let currentStudentTimetableDay = 'all';
let currentStudentTimetableSlots = [];

function setAuthPortalRole(role) {
  authPortalRole = role === 'student' ? 'student' : 'staff';
  updateAuthModalPortalUI();
}

// Teacher Share Modal
function openShareStudentPortalModal() {
  const modal = document.getElementById('modal-share-student-portal');
  if (!modal) return;
  const input = document.getElementById('share-student-portal-url');
  if (input) {
    input.value = `${window.location.origin}/?portal=student`;
  }
  modal.classList.remove('hidden');
}

function closeShareStudentPortalModal() {
  const modal = document.getElementById('modal-share-student-portal');
  if (modal) modal.classList.add('hidden');
}

function copyStudentPortalLink() {
  const input = document.getElementById('share-student-portal-url');
  if (!input) return;
  input.select();
  input.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(input.value).then(() => {
    showToast('Student Portal link copied to clipboard!');
    const btnLabel = document.getElementById('copy-portal-btn-label');
    if (btnLabel) {
      btnLabel.innerText = 'Copied!';
      setTimeout(() => { btnLabel.innerText = 'Copy'; }, 2000);
    }
  }).catch(() => {
    showToast('Link copied!');
  });
}

function shareStudentPortalWhatsApp() {
  const url = `${window.location.origin}/?portal=student`;
  const text = encodeURIComponent(`Hello students! Please open this link to enter your details, access your class timetable, and view school announcements:\n${url}`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function triggerNativeShareStudentLink() {
  const url = `${window.location.origin}/?portal=student`;
  if (navigator.share) {
    navigator.share({
      title: 'REGISTERLY Student Portal',
      text: 'Open this link to submit your details and view your class timetable & announcements:',
      url: url
    }).catch(() => {});
  } else {
    copyStudentPortalLink();
  }
}

// =========================================================================
// ================= ADVANCED REGISTERLY STUDENT PORTAL CONTROLLER =========
// =========================================================================
currentStudentPortalTab = 'home';
let currentClassesSubTab = 'timetable';
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth() + 1; // 1-12
let currentCalendarDaysMap = {};
let currentStudentAllSessions = [];
let currentStudentSessionsFilter = 'all';
let currentStudentAnnouncements = [];
let currentStudentEvents = [];
let currentStudentUpdatesFilter = 'all';
let currentStudentUpdatesSearch = '';
let currentStudentSubjectsList = [];
let currentStudentLeaveRequests = [];
currentStudentTimetableSlots = [];
currentStudentTimetableDay = 'all';

// Initialize Student Portal View
async function initStudentPortal() {
  try {
    // Hide guide and messages button from header in student link / portal
    const btnGuide = document.getElementById('header-guide-btn');
    const btnNotif = document.getElementById('header-notif-btn');
    if (btnGuide) btnGuide.classList.add('hidden');
    if (btnNotif) btnNotif.classList.add('hidden');

    // Populate class options in the registration form
    const classSelect = document.getElementById('spf-class');
    if (classSelect) {
      classSelect.innerHTML = '<option value="">Select your class</option>';
      let classes = [];
      try {
        const clsRes = await API.getClasses();
        classes = clsRes.data || [];
      } catch (_) {}
      classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        classSelect.appendChild(opt);
      });
    }

    // Teacher preview banner
    const teacherBanner = document.getElementById('sp-teacher-preview-banner');
    const teacherNameSpan = document.getElementById('sp-teacher-account-name');
    if (currentUser && currentUser.role !== 'student') {
      if (teacherBanner) teacherBanner.classList.remove('hidden');
      if (teacherNameSpan) teacherNameSpan.textContent = `${currentUser.name} (${currentUser.role})`;
    } else {
      if (teacherBanner) teacherBanner.classList.add('hidden');
    }

    // Time-based greeting
    const hr = new Date().getHours();
    const greetingText = hr < 12 ? 'Good Morning' : (hr < 17 ? 'Good Afternoon' : 'Good Evening');

    // Guest / Unauthenticated Student Handling
    if (!currentUser) {
      const nameEl = document.getElementById('sp-name');
      const avatarEl = document.getElementById('sp-avatar');
      const classBadgeEl = document.getElementById('sp-class-badge');
      const subtitleEl = document.getElementById('sp-subtitle');
      const greetEl = document.getElementById('sp-greeting');

      if (greetEl) greetEl.textContent = `${greetingText}, Welcome`;
      if (nameEl) nameEl.textContent = 'Welcome, Student';
      if (avatarEl) avatarEl.src = DEFAULT_AVATAR;
      if (classBadgeEl) classBadgeEl.classList.add('hidden');
      if (subtitleEl) subtitleEl.textContent = 'Sign in to access your student portal';

      const unregBanner = document.getElementById('sp-unregistered-banner');
      if (unregBanner) {
        unregBanner.classList.remove('hidden');
        unregBanner.className = "p-4 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-900 dark:text-teal-200 space-y-2";
        unregBanner.innerHTML = `
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="font-black text-sm flex items-center gap-1.5">
              <svg class="w-4 h-4 text-teal-700 dark:text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
              <span>Welcome to REGISTERLY Student Portal</span>
            </div>
            <button type="button" onclick="openAuthModal()" class="touch-btn px-3.5 py-1.5 rounded-xl custom-gradient-btn text-white text-xs font-black shadow-xs">Sign In / Register</button>
          </div>
          <p class="text-xs leading-relaxed opacity-90">Please sign in with your student email or Google account to access your personalized timetable, attendance calendar, and campus circulars.</p>
        `;
      }
      return;
    }

    const res = await API.getStudentPortalMe();
    if (!res.success) {
      showToast('Error loading student profile');
      return;
    }

    const user = res.user || currentUser;
    const student = res.data;
    currentStudentData = student;

    // Header updates
    const nameEl = document.getElementById('sp-name');
    const avatarEl = document.getElementById('sp-avatar');
    const classBadgeEl = document.getElementById('sp-class-badge');
    const subtitleEl = document.getElementById('sp-subtitle');
    const greetEl = document.getElementById('sp-greeting');

    const displayName = student ? student.name : (user.name || 'Student');
    if (greetEl) greetEl.textContent = `${greetingText}, ${displayName}`;
    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) avatarEl.src = (student && student.photoUrl) || (user && user.avatarUrl) || DEFAULT_AVATAR;

    if (student) {
      if (classBadgeEl) {
        classBadgeEl.textContent = `Class ${student.class || '-'}`;
        classBadgeEl.classList.remove('hidden');
      }
      if (subtitleEl) {
        const yearStr = student.academicStatus?.yearJoined ? `${student.academicStatus.yearJoined}-${Number(student.academicStatus.yearJoined) + 1}` : '2026-27';
        subtitleEl.textContent = `Roll: #${student.roll ?? '-'} • Student ID: ${student.studentId || '-'} • Year: ${yearStr}`;
      }

      // Populate Digital ID Card & Details
      renderStudentIdCard(student);
      populateStudentFormFields(student);
      populateProfileOrganizedSections(student);

      const unregBanner = document.getElementById('sp-unregistered-banner');
      if (student.registrationStatus === 'pending') {
        if (unregBanner) {
          unregBanner.className = "p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1";
          unregBanner.innerHTML = `
            <div class="font-black text-sm flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>Registration Submitted — Pending Teacher Verification</span>
            </div>
            <p class="text-xs leading-relaxed opacity-90">Your student registration has been received and queued in your teacher's Outcomers directory. Once verified, official records will be fully synchronized.</p>
          `;
          unregBanner.classList.remove('hidden');
        }
      } else {
        if (unregBanner) unregBanner.classList.add('hidden');
      }

      const formCard = document.getElementById('sp-form-card');
      if (formCard) formCard.classList.add('hidden');
      const toggleBtnText = document.getElementById('sp-toggle-edit-btn-text');
      if (toggleBtnText) toggleBtnText.textContent = 'Edit My Details';
      const formTitle = document.getElementById('sp-form-title');
      if (formTitle) formTitle.textContent = 'Edit My Details';
      const submitBtnText = document.getElementById('spf-submit-btn-text');
      if (submitBtnText) submitBtnText.textContent = 'Update Profile';

      // Default to Home Dashboard
      switchStudentPortalTab('home');
    } else {
      // First time self-registration
      if (classBadgeEl) classBadgeEl.classList.add('hidden');
      if (subtitleEl) subtitleEl.textContent = 'Profile registration pending';

      const unregBanner = document.getElementById('sp-unregistered-banner');
      if (unregBanner) unregBanner.classList.remove('hidden');
      const formCard = document.getElementById('sp-form-card');
      if (formCard) formCard.classList.remove('hidden');

      const nameInput = document.getElementById('spf-name');
      if (nameInput && user && user.name) nameInput.value = user.name;
      const previewEl = document.getElementById('spf-photo-preview');
      if (previewEl && user && user.avatarUrl) previewEl.src = user.avatarUrl;
      const photoUrlInput = document.getElementById('spf-photo-url');
      if (photoUrlInput && user && user.avatarUrl) photoUrlInput.value = user.avatarUrl;

      switchStudentPortalTab('profile');
    }
  } catch (err) {
    console.error('[StudentPortal Init Error]', err);
    showToast('Failed to load student portal');
  }
}

// Render PVC Digital Student ID Card
function renderStudentIdCard(student) {
  if (!student) return;
  const p = student.personalDetails || {};
  const a = student.address || {};
  const f = student.familyDetails || {};
  const ac = student.academicStatus || {};

  const nameEl = document.getElementById('sp-card-name');
  if (nameEl) nameEl.textContent = student.name || 'Student';

  const photoEl = document.getElementById('sp-card-photo');
  if (photoEl) photoEl.src = student.photoUrl || DEFAULT_AVATAR;

  const classEl = document.getElementById('sp-card-class');
  if (classEl) classEl.textContent = student.class || '-';

  const rollEl = document.getElementById('sp-card-roll');
  if (rollEl) rollEl.textContent = `#${student.roll ?? '-'}`;

  const idEl = document.getElementById('sp-card-id');
  if (idEl) idEl.textContent = String(student.studentId || '-');

  const yearEl = document.getElementById('sp-card-year');
  if (yearEl) {
    yearEl.textContent = ac.yearJoined ? `${ac.yearJoined}-${Number(ac.yearJoined) + 1}` : '2026-2027';
  }

  const contactEl = document.getElementById('sp-card-contact');
  if (contactEl) {
    contactEl.textContent = f.fatherMobile || f.motherNumber || f.guardianNumber || 'Institution Verified';
  }

  const verCodeEl = document.getElementById('sp-card-verification-code');
  if (verCodeEl) {
    verCodeEl.textContent = `ID-${student.studentId || '2000'}`;
  }

  const instNameEl = document.getElementById('sp-card-inst-name');
  if (instNameEl && appSettings && appSettings.schoolName) {
    instNameEl.textContent = appSettings.schoolName;
  }
}

// Populate the organized profile sections (Personal, Academic, Contact, Family)
function populateProfileOrganizedSections(student) {
  if (!student) return;
  const p = student.personalDetails || {};
  const a = student.address || {};
  const f = student.familyDetails || {};
  const ac = student.academicStatus || {};

  const pName = document.getElementById('sp-prof-name');
  if (pName) pName.textContent = student.name || '-';

  const pDob = document.getElementById('sp-prof-dob');
  if (pDob) pDob.textContent = p.dob || 'Not specified';

  const pGender = document.getElementById('sp-prof-gender');
  if (pGender) pGender.textContent = p.gender || 'Not specified';

  const pBlood = document.getElementById('sp-prof-blood');
  if (pBlood) pBlood.textContent = p.bloodGroup || 'Not specified';

  const pId = document.getElementById('sp-prof-id');
  if (pId) pId.textContent = String(student.studentId || '-');

  const pAdmNo = document.getElementById('sp-prof-admno');
  if (pAdmNo) pAdmNo.textContent = ac.admissionNo || `ADM-${student.studentId || '-'}`;

  const pClassRoll = document.getElementById('sp-prof-class-roll');
  if (pClassRoll) pClassRoll.textContent = `Class ${student.class || '-'} • Roll #${student.roll ?? '-'}`;

  const pAdmStatus = document.getElementById('sp-prof-admstatus');
  if (pAdmStatus) pAdmStatus.textContent = ac.admissionStatus || 'Confirmed';

  const pEmail = document.getElementById('sp-prof-email');
  if (pEmail) pEmail.textContent = p.studentEmail || (currentUser && currentUser.email) || '-';

  const pAddress = document.getElementById('sp-prof-address');
  if (pAddress) {
    const parts = [a.fullAddress, a.place, a.district, a.state, a.pinCode ? `PIN: ${a.pinCode}` : ''].filter(Boolean);
    pAddress.textContent = parts.length > 0 ? parts.join(', ') : 'Not specified';
  }

  const pFather = document.getElementById('sp-prof-father');
  if (pFather) pFather.textContent = f.fatherName ? `${f.fatherName} (${f.fatherMobile || 'No phone'})` : '-';

  const pMother = document.getElementById('sp-prof-mother');
  if (pMother) pMother.textContent = f.motherName ? `${f.motherName} (${f.motherNumber || 'No phone'})` : '-';
}

function populateStudentFormFields(student) {
  const p = student.personalDetails || {};
  const a = student.address || {};
  const f = student.familyDetails || {};

  const nameInput = document.getElementById('spf-name');
  if (nameInput) nameInput.value = student.name || '';

  const classSelect = document.getElementById('spf-class');
  if (classSelect) classSelect.value = student.class || '';

  const rollInput = document.getElementById('spf-roll');
  if (rollInput) rollInput.value = student.roll ?? '';

  const photoUrlInput = document.getElementById('spf-photo-url');
  if (photoUrlInput) photoUrlInput.value = student.photoUrl || '';
  const photoPreview = document.getElementById('spf-photo-preview');
  if (photoPreview) photoPreview.src = student.photoUrl || DEFAULT_AVATAR;

  const dobInput = document.getElementById('spf-dob');
  if (dobInput) dobInput.value = p.dob || '';

  const genderSelect = document.getElementById('spf-gender');
  if (genderSelect) genderSelect.value = p.gender || '';

  const bgSelect = document.getElementById('spf-blood-group');
  if (bgSelect) bgSelect.value = p.bloodGroup || '';

  const fullAddr = document.getElementById('spf-full-address');
  if (fullAddr) fullAddr.value = a.fullAddress || '';
  const place = document.getElementById('spf-place');
  if (place) place.value = a.place || '';
  const dist = document.getElementById('spf-district');
  if (dist) dist.value = a.district || '';
  const st = document.getElementById('spf-state');
  if (st) st.value = a.state || '';
  const pin = document.getElementById('spf-pincode');
  if (pin) pin.value = a.pinCode || '';

  const fName = document.getElementById('spf-father-name');
  if (fName) fName.value = f.fatherName || '';
  const fMob = document.getElementById('spf-father-mobile');
  if (fMob) fMob.value = f.fatherMobile || '';
  const mName = document.getElementById('spf-mother-name');
  if (mName) mName.value = f.motherName || '';
  const mMob = document.getElementById('spf-mother-mobile');
  if (mMob) mMob.value = f.motherNumber || '';
}

function toggleStudentEditForm() {
  const formCard = document.getElementById('sp-form-card');
  const toggleBtnText = document.getElementById('sp-toggle-edit-btn-text');
  if (!formCard) return;
  const isHidden = formCard.classList.contains('hidden');
  if (isHidden) {
    formCard.classList.remove('hidden');
    if (toggleBtnText) toggleBtnText.textContent = 'Hide Form';
    formCard.scrollIntoView({ behavior: 'smooth' });
  } else {
    formCard.classList.add('hidden');
    if (toggleBtnText) toggleBtnText.textContent = 'Edit My Details';
  }
}

async function handleStudentPhotoSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    showToast('Uploading photo...');
    const res = await API.uploadPhoto(file, 'students');
    const photoUrl = res.url || res.secure_url || res.photoUrl || (res.data && res.data.url);
    if (photoUrl) {
      const preview = document.getElementById('spf-photo-preview');
      if (preview) preview.src = photoUrl;
      const hidden = document.getElementById('spf-photo-url');
      if (hidden) hidden.value = photoUrl;
      showToast('Photo uploaded successfully');
    }
  } catch (err) {
    console.error('[Student Photo Upload Error]', err);
    showToast('Photo upload failed: ' + err.message);
  }
}

async function handleStudentDetailsSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('spf-submit-btn');
  const originalBtn = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Saving Details...</span>';
  }

  try {
    const name = document.getElementById('spf-name')?.value?.trim();
    const studentClass = document.getElementById('spf-class')?.value?.trim();
    const roll = document.getElementById('spf-roll')?.value?.trim();
    const photoUrl = document.getElementById('spf-photo-url')?.value?.trim();

    const payload = {
      name,
      class: studentClass,
      roll: Number(roll),
      photoUrl,
      personalDetails: {
        dob: document.getElementById('spf-dob')?.value?.trim(),
        gender: document.getElementById('spf-gender')?.value?.trim(),
        bloodGroup: document.getElementById('spf-blood-group')?.value?.trim()
      },
      address: {
        fullAddress: document.getElementById('spf-full-address')?.value?.trim(),
        place: document.getElementById('spf-place')?.value?.trim(),
        district: document.getElementById('spf-district')?.value?.trim(),
        state: document.getElementById('spf-state')?.value?.trim(),
        pinCode: document.getElementById('spf-pincode')?.value?.trim()
      },
      familyDetails: {
        fatherName: document.getElementById('spf-father-name')?.value?.trim(),
        fatherMobile: document.getElementById('spf-father-mobile')?.value?.trim(),
        motherName: document.getElementById('spf-mother-name')?.value?.trim(),
        motherNumber: document.getElementById('spf-mother-mobile')?.value?.trim()
      }
    };

    const isEdit = Boolean(currentStudentData);
    let res;
    if (isEdit) {
      res = await API.updateStudentDetails(payload);
    } else {
      res = await API.submitStudentDetails(payload);
    }

    if (res.success && res.data) {
      currentStudentData = res.data;
      showToast(res.message || 'Details saved successfully!');
      await initStudentPortal();
    } else {
      showToast(res.message || 'Failed to save details');
    }
  } catch (err) {
    console.error('[Student Details Save Error]', err);
    showToast(err.message || 'Error saving student details');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtn;
    }
  }
}

// Switch between the 5 primary Student Portal tabs
function switchStudentPortalTab(tab, subTab) {
  currentStudentPortalTab = tab;
  const tabs = ['home', 'classes', 'attendance', 'updates', 'profile'];

  tabs.forEach(t => {
    // Desktop top tabs
    const dBtn = document.getElementById(`sp-tab-${t}`);
    // Mobile bottom bar tabs
    const bBtn = document.getElementById(`sp-bnav-${t}`);
    // Content containers
    const content = document.getElementById(`sp-content-${t}`);

    if (t === tab) {
      if (dBtn) {
        dBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 whitespace-nowrap custom-gradient-btn text-white shadow-sm";
      }
      if (bBtn) {
        bBtn.className = "flex-1 flex flex-col items-center justify-center py-1 text-[#245b70] dark:text-cyan-400 font-black tab-transition scale-105";
      }
      if (content) content.classList.remove('hidden');
    } else {
      if (dBtn) {
        dBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold text-[var(--text-sub)] hover:text-[var(--text-main)] transition flex items-center justify-center gap-1.5 whitespace-nowrap";
      }
      if (bBtn) {
        bBtn.className = "flex-1 flex flex-col items-center justify-center py-1 text-[var(--text-sub)] hover:text-[#245b70] font-medium tab-transition";
      }
      if (content) content.classList.add('hidden');
    }
  });

  // Dispatch loader based on active tab
  if (tab === 'home') {
    loadStudentHomeDashboard();
  } else if (tab === 'classes') {
    loadStudentClasses(subTab || currentClassesSubTab);
  } else if (tab === 'attendance') {
    loadStudentAttendancePortal();
  } else if (tab === 'updates') {
    loadStudentUpdates();
  } else if (tab === 'profile') {
    loadStudentProfile();
  }

  // Smooth scroll to top of portal container
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------------------
// 1. HOME DASHBOARD CONTROLLER
// -------------------------------------------------------------------------
async function loadStudentHomeDashboard() {
  try {
    const res = await API.getStudentDashboard();
    if (!res || !res.success) return;

    const stats = res.stats || { percentage: null, present: 0, absent: 0, leave: 0, totalSessions: 0 };
    
    // Quick statistics
    const attPctEl = document.getElementById('sp-home-att-pct');
    if (attPctEl) {
      attPctEl.textContent = stats.percentage !== null ? `${stats.percentage}%` : 'N/A';
    }

    const attSubEl = document.getElementById('sp-home-att-sub');
    if (attSubEl) {
      attSubEl.textContent = `${stats.present || 0} of ${stats.totalSessions || 0} sessions`;
    }

    const presentEl = document.getElementById('sp-home-present-count');
    if (presentEl) presentEl.textContent = String(stats.present || 0);

    const subjectsEl = document.getElementById('sp-home-subjects-count');
    if (subjectsEl) subjectsEl.textContent = String(res.totalSubjects || 0);

    const noticesEl = document.getElementById('sp-home-notices-count');
    const totalNotices = (res.recentAnnouncements || []).length + (res.upcomingEvents || []).length;
    if (noticesEl) noticesEl.textContent = String(totalNotices);

    // Today's Day Name
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const dayNameEl = document.getElementById('sp-home-today-dayname');
    if (dayNameEl) dayNameEl.textContent = `${dayName} Schedule`;

    // Today's schedule slots
    const todaySlotsContainer = document.getElementById('sp-home-today-slots');
    if (todaySlotsContainer) {
      const slots = res.todaySchedule || [];
      if (slots.length === 0) {
        todaySlotsContainer.innerHTML = `
          <div class="p-6 text-center rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-1.5">
            <svg class="w-8 h-8 text-[var(--text-sub)] opacity-50 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <h4 class="text-xs sm:text-sm font-black text-[var(--text-main)]">No Classes Scheduled Today</h4>
            <p class="text-[11px] text-[var(--text-sub)]">Enjoy your day or check the full weekly timetable for upcoming classes.</p>
          </div>
        `;
      } else {
        todaySlotsContainer.innerHTML = slots.map((s, idx) => {
          return `
            <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-center justify-between gap-3 shadow-2xs hover:border-[#245b70]/40 transition">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center font-black text-xs flex-shrink-0">
                  ${(s.subject || 'SUB').substring(0, 3).toUpperCase()}
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="text-xs font-black text-[var(--text-main)] truncate">${s.subject || 'Subject'}</h4>
                    ${s.room ? `<span class="px-1.5 py-0.2 rounded-md bg-slate-500/10 text-[var(--text-sub)] font-bold text-[9px]">Room: ${s.room}</span>` : ''}
                  </div>
                  <p class="text-[10px] text-[var(--text-sub)] font-medium truncate">Teacher: <b>${s.teacherName || 'Faculty'}</b></p>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <span class="px-2.5 py-1 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[#245b70] dark:text-cyan-400 font-extrabold text-[11px] shadow-2xs">
                  ${s.timeSlot || '--:--'}
                </span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Recent announcements on home
    const homeAnnounceContainer = document.getElementById('sp-home-announcements-list');
    if (homeAnnounceContainer) {
      const announcements = res.recentAnnouncements || [];
      if (announcements.length === 0) {
        homeAnnounceContainer.innerHTML = `
          <div class="p-5 text-center rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] text-xs text-[var(--text-sub)]">
            No active campus circulars right now.
          </div>
        `;
      } else {
        homeAnnounceContainer.innerHTML = announcements.map(n => {
          const isImp = n.priority === 'important';
          const dateStr = n.publishedAt ? new Date(n.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
          return `
            <div onclick="openStudentNoticeModal('${n._id}', 'announcement')" class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] hover:border-[#245b70]/40 transition active:scale-98 cursor-pointer space-y-1 shadow-2xs">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  ${isImp ? '<span class="px-1.5 py-0.2 rounded bg-amber-500 text-white font-black text-[9px] uppercase">Alert</span>' : '<span class="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[var(--text-sub)] font-bold text-[9px]">Circular</span>'}
                  <h4 class="text-xs font-black text-[var(--text-main)] truncate">${n.title}</h4>
                </div>
                <span class="text-[10px] text-[var(--text-sub)] font-medium flex-shrink-0">${dateStr}</span>
              </div>
              <p class="text-[11px] text-[var(--text-sub)] line-clamp-2 leading-relaxed">${n.description || ''}</p>
            </div>
          `;
        }).join('');
      }
    }

    // Institution branding update
    if (res.institution && res.institution.schoolName) {
      const instNameEl = document.getElementById('sp-card-inst-name');
      if (instNameEl) instNameEl.textContent = res.institution.schoolName;
    }
  } catch (err) {
    console.error('[Student Home Dashboard Error]', err);
  }
}

// -------------------------------------------------------------------------
// 2. CLASSES & ACADEMICS CONTROLLER
// -------------------------------------------------------------------------
function switchClassesSubTab(subTab) {
  currentClassesSubTab = subTab;
  const subTabs = ['timetable', 'subjects', 'materials'];

  subTabs.forEach(st => {
    const btn = document.getElementById(`sp-csubtab-${st}`);
    const view = document.getElementById(`sp-classes-view-${st}`);
    if (st === subTab) {
      if (btn) btn.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-black custom-gradient-btn text-white transition shadow-2xs flex items-center justify-center gap-1.5";
      if (view) view.classList.remove('hidden');
    } else {
      if (btn) btn.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold text-[var(--text-sub)] hover:text-[var(--text-main)] transition flex items-center justify-center gap-1.5";
      if (view) view.classList.add('hidden');
    }
  });

  if (subTab === 'timetable') {
    loadStudentTimetable(currentStudentTimetableDay);
  } else if (subTab === 'subjects') {
    loadStudentSubjects();
  }
}

async function loadStudentClasses(subTab = 'timetable') {
  switchClassesSubTab(subTab);
}

async function loadStudentTimetable(day = 'all') {
  const container = document.getElementById('sp-timetable-slots');
  if (!container) return;
  container.innerHTML = '<div class="p-6 text-center text-xs text-[var(--text-sub)] font-bold">Loading timetable...</div>';

  try {
    const res = await API.getStudentTimetable(day);
    if (!res.success) {
      container.innerHTML = `<div class="p-6 text-center text-xs text-[var(--text-sub)]">${res.message || 'Unable to load timetable'}</div>`;
      return;
    }

    const slots = res.data || [];
    currentStudentTimetableSlots = slots;
    renderStudentTimetableSlots(slots);
  } catch (err) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-rose-500 font-bold">Failed to load timetable</div>';
  }
}

function filterStudentTimetable(day) {
  currentStudentTimetableDay = day;
  const days = ['all', 'today', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  days.forEach(d => {
    const btn = document.getElementById(`spt-day-${d}`);
    if (btn) {
      if (d === day) {
        btn.className = "px-2.5 py-1 rounded-xl text-xs font-bold bg-[#245b70] text-white transition flex-shrink-0 shadow-2xs";
      } else {
        btn.className = "px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--bg-page)] text-[var(--text-sub)] hover:text-[var(--text-main)] border border-[var(--border-color)] transition flex-shrink-0";
      }
    }
  });

  if (day === 'today') {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    loadStudentTimetable(todayName);
  } else {
    loadStudentTimetable(day);
  }
}

function renderStudentTimetableSlots(slots) {
  const container = document.getElementById('sp-timetable-slots');
  if (!container) return;

  if (!slots || slots.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-2">
        <svg class="w-10 h-10 text-[var(--text-sub)] opacity-50 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <h4 class="text-xs sm:text-sm font-black text-[var(--text-main)]">No Classes Scheduled</h4>
        <p class="text-[11px] text-[var(--text-sub)]">There are no timetable slots recorded for this selection yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = slots.map(s => {
    const daysLabel = Array.isArray(s.days) && s.days.length > 0 ? s.days.join(', ') : (s.day || 'All Days');
    return `
      <div class="p-3.5 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] hover:border-[#245b70]/40 transition flex items-center justify-between gap-3 shadow-2xs">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center font-black text-xs flex-shrink-0">
            ${(s.subject || 'SUB').substring(0, 3).toUpperCase()}
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-xs sm:text-sm font-black text-[var(--text-main)]">${s.subject || 'Subject'}</h4>
              <span class="px-2 py-0.2 rounded-md bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 font-bold text-[10px]">${daysLabel}</span>
              ${s.room ? `<span class="px-1.5 py-0.2 rounded-md bg-slate-500/10 text-[var(--text-sub)] font-bold text-[10px]">Room: ${s.room}</span>` : ''}
            </div>
            <p class="text-[11px] text-[var(--text-sub)] font-medium mt-0.5">Teacher: <b>${s.teacherName || s.teacherEmail || 'Teacher'}</b></p>
          </div>
        </div>
        <div class="text-right flex-shrink-0">
          <span class="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border-color)] text-[#245b70] dark:text-cyan-400 font-extrabold text-[11px] shadow-2xs">
            ${s.timeSlot || '--:--'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

async function loadStudentSubjects() {
  const container = document.getElementById('sp-subjects-grid');
  if (!container) return;
  container.innerHTML = '<div class="p-6 text-center text-xs text-[var(--text-sub)] font-bold col-span-2">Loading subjects...</div>';

  try {
    const res = await API.getStudentSubjects();
    const subjects = res.subjects || [];
    currentStudentSubjectsList = subjects;

    if (subjects.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-2 col-span-2">
          <svg class="w-10 h-10 text-[var(--text-sub)] opacity-50 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          <h4 class="text-xs sm:text-sm font-black text-[var(--text-main)]">No Subjects Enrolled</h4>
          <p class="text-[11px] text-[var(--text-sub)]">No subjects are assigned to your class yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = subjects.map(s => {
      const att = s.attendance || {};
      const pctStr = att.percentage !== null ? `${att.percentage}%` : 'N/A';
      return `
        <div class="p-4 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] hover:border-[#245b70]/40 transition space-y-3 shadow-2xs">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center font-black text-xs flex-shrink-0">
                ${(s.name || 'SUB').substring(0, 3).toUpperCase()}
              </div>
              <div class="min-w-0">
                <h4 class="text-xs sm:text-sm font-black text-[var(--text-main)] truncate">${s.name}</h4>
                <p class="text-[10px] text-[var(--text-sub)] font-medium truncate">Faculty: <b>${s.teacher || 'Assigned'}</b></p>
              </div>
            </div>
            ${s.subjectCode ? `<span class="px-2 py-0.5 rounded-md bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 font-mono text-[9px] font-bold flex-shrink-0">${s.subjectCode}</span>` : ''}
          </div>

          <!-- Subject Attendance Bar -->
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-[var(--text-sub)] font-semibold">Subject Attendance</span>
              <span class="font-extrabold text-[#245b70] dark:text-cyan-400">${pctStr}</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div class="h-full bg-teal-600 rounded-full" style="width: ${att.percentage || 0}%"></div>
            </div>
          </div>

          <div class="pt-1 flex items-center justify-between border-t border-[var(--border-color)]">
            <span class="text-[10px] text-[var(--text-sub)]">${att.present || 0} / ${att.totalSessions || 0} Sessions</span>
            <button type="button" onclick="openStudentSubjectModal('${s._id}')" class="text-xs font-bold text-[#245b70] dark:text-cyan-400 hover:underline flex items-center gap-1">
              <span>Details</span>
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-rose-500 font-bold col-span-2">Failed to load subjects</div>';
  }
}

function openStudentSubjectModal(subjectId) {
  const subj = currentStudentSubjectsList.find(s => String(s._id) === String(subjectId));
  if (!subj) return;

  const modal = document.getElementById('modal-student-subject-detail');
  if (!modal) return;

  const avatar = document.getElementById('ssd-avatar');
  if (avatar) avatar.textContent = (subj.name || 'SUB').substring(0, 3).toUpperCase();

  const nameEl = document.getElementById('ssd-name');
  if (nameEl) nameEl.textContent = subj.name;

  const codeEl = document.getElementById('ssd-code');
  if (codeEl) codeEl.textContent = subj.subjectCode ? `Code: ${subj.subjectCode}` : 'Code: General';

  const teacherEl = document.getElementById('ssd-teacher');
  if (teacherEl) teacherEl.textContent = subj.teacher || 'Not Assigned';

  const teacherEmailEl = document.getElementById('ssd-teacher-email');
  if (teacherEmailEl) teacherEmailEl.textContent = subj.teacherEmail ? `Email: ${subj.teacherEmail}` : '';

  const att = subj.attendance || {};
  const attPctEl = document.getElementById('ssd-att-pct');
  if (attPctEl) attPctEl.textContent = att.percentage !== null ? `${att.percentage}%` : 'N/A';

  const attDetailsEl = document.getElementById('ssd-att-details');
  if (attDetailsEl) attDetailsEl.textContent = `${att.present || 0} of ${att.totalSessions || 0} recorded sessions attended`;

  modal.classList.remove('hidden');
}

function closeStudentSubjectModal() {
  const modal = document.getElementById('modal-student-subject-detail');
  if (modal) modal.classList.add('hidden');
}

// -------------------------------------------------------------------------
// 3. ADVANCED ATTENDANCE PORTAL & CALENDAR CONTROLLER
// -------------------------------------------------------------------------
async function loadStudentAttendancePortal() {
  try {
    const [attRes, calRes] = await Promise.all([
      API.getStudentAttendance(),
      API.getStudentAttendanceCalendar(currentCalendarYear, currentCalendarMonth)
    ]);

    const stats = attRes.stats || { percentage: null, present: 0, absent: 0, leave: 0, totalSessions: 0 };
    currentStudentAllSessions = attRes.sessions || [];

    // KPI overview
    const pctEl = document.getElementById('sp-attendance-pct');
    if (pctEl) pctEl.textContent = stats.percentage !== null ? `${stats.percentage}%` : 'N/A';

    const presentEl = document.getElementById('sp-att-present');
    if (presentEl) presentEl.textContent = String(stats.present || 0);

    const absentEl = document.getElementById('sp-att-absent');
    if (absentEl) absentEl.textContent = String(stats.absent || 0);

    const leaveEl = document.getElementById('sp-att-leave');
    if (leaveEl) leaveEl.textContent = String(stats.leave || 0);

    const totalEl = document.getElementById('sp-att-total');
    if (totalEl) totalEl.textContent = String(stats.totalSessions || 0);

    // Monthly Calendar
    if (calRes && calRes.success) {
      currentCalendarDaysMap = calRes.days || {};
      renderStudentCalendar(currentCalendarYear, currentCalendarMonth);
    }

    // Subject breakdown
    loadSubjectAttendanceBreakdown();

    // Chronological sessions list
    renderStudentAttendanceSessions(currentStudentAllSessions, currentStudentSessionsFilter);

  } catch (err) {
    console.error('[Student Attendance Portal Error]', err);
  }
}

function navigateStudentCalendar(delta) {
  currentCalendarMonth += delta;
  if (currentCalendarMonth > 12) {
    currentCalendarMonth = 1;
    currentCalendarYear++;
  } else if (currentCalendarMonth < 1) {
    currentCalendarMonth = 12;
    currentCalendarYear--;
  }

  loadStudentAttendancePortal();
}

function renderStudentCalendar(year, month) {
  const labelEl = document.getElementById('sp-calendar-month-label');
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (labelEl) labelEl.textContent = `${monthNames[month - 1]} ${year}`;

  const grid = document.getElementById('sp-calendar-days-grid');
  if (!grid) return;

  // Days in month
  const totalDays = new Date(year, month, 0).getDate();
  // Day of week of 1st day (0 is Sun, 1 is Mon, ...)
  let startDay = new Date(year, month - 1, 1).getDay();
  // Adjust so Monday is 0, Sunday is 6
  startDay = (startDay + 6) % 7;

  let html = '';

  // Blank padding cells
  for (let i = 0; i < startDay; i++) {
    html += '<div class="h-10 rounded-xl bg-transparent"></div>';
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
  const todayDate = today.getDate();

  for (let d = 1; d <= totalDays; d++) {
    const dayData = currentCalendarDaysMap[d];
    let dotClass = 'bg-slate-300 dark:bg-slate-700';
    let bgClass = 'bg-[var(--bg-page)]';
    let textClass = 'text-[var(--text-main)]';

    if (dayData) {
      if (dayData.status === 'P') {
        dotClass = 'bg-emerald-500';
        bgClass = 'bg-emerald-500/10 border-emerald-500/30';
      } else if (dayData.status === 'A') {
        dotClass = 'bg-rose-500';
        bgClass = 'bg-rose-500/10 border-rose-500/30';
      } else if (dayData.status === 'L') {
        dotClass = 'bg-amber-500';
        bgClass = 'bg-amber-500/10 border-amber-500/30';
      }
    }

    const isToday = isCurrentMonth && d === todayDate;
    const ringClass = isToday ? 'ring-2 ring-[#245b70]' : '';

    html += `
      <button type="button" onclick="selectStudentCalendarDate(${d})" class="touch-btn h-10 rounded-xl ${bgClass} border border-[var(--border-color)] ${ringClass} flex flex-col items-center justify-center p-0.5 transition active:scale-95 group hover:border-[#245b70]/60">
        <span class="text-xs font-black ${textClass} leading-tight">${d}</span>
        <span class="w-1.5 h-1.5 rounded-full ${dotClass} mt-0.5"></span>
      </button>
    `;
  }

  grid.innerHTML = html;

  // Auto-select today or last available date in inspector
  if (isCurrentMonth) {
    selectStudentCalendarDate(todayDate);
  } else if (totalDays > 0) {
    selectStudentCalendarDate(1);
  }
}

function selectStudentCalendarDate(dayNum) {
  const dayData = currentCalendarDaysMap[dayNum];
  const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  
  const dateLabel = document.getElementById('sp-inspector-date');
  if (dateLabel) {
    const dObj = new Date(currentCalendarYear, currentCalendarMonth - 1, dayNum);
    const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long' });
    dateLabel.textContent = `${dayName}, ${dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  const badgeEl = document.getElementById('sp-inspector-status-badge');
  const sessionsEl = document.getElementById('sp-inspector-sessions');

  if (!dayData || !dayData.sessions || dayData.sessions.length === 0) {
    if (badgeEl) {
      badgeEl.className = "px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-[var(--text-sub)]";
      badgeEl.textContent = 'No Sessions Recorded';
    }
    if (sessionsEl) {
      sessionsEl.innerHTML = '<p class="text-xs text-[var(--text-sub)]">No attendance sessions were recorded for your class on this date.</p>';
    }
    return;
  }

  let badgeColor = 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300';
  let statusText = 'Present';
  if (dayData.status === 'A') {
    badgeColor = 'bg-rose-500/20 text-rose-800 dark:text-rose-300';
    statusText = 'Absent';
  } else if (dayData.status === 'L') {
    badgeColor = 'bg-amber-500/20 text-amber-800 dark:text-amber-300';
    statusText = 'Leave';
  }

  if (badgeEl) {
    badgeEl.className = `px-2 py-0.5 rounded-lg text-[10px] font-black ${badgeColor}`;
    badgeEl.textContent = statusText;
  }

  if (sessionsEl) {
    sessionsEl.innerHTML = dayData.sessions.map(s => {
      let sColor = 'text-emerald-600 dark:text-emerald-400';
      let sText = 'Present';
      if (s.status === 'A') { sColor = 'text-rose-600 dark:text-rose-400'; sText = 'Absent'; }
      else if (s.status === 'L') { sColor = 'text-amber-600 dark:text-amber-400'; sText = 'Leave'; }

      return `
        <div class="p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <h5 class="text-xs font-black text-[var(--text-main)]">${s.subject || 'General Attendance'}</h5>
            <p class="text-[10px] text-[var(--text-sub)] font-medium">${s.period ? `Period: ${s.period} • ` : ''}Marked by: ${s.markedBy || 'Administration'}</p>
            ${s.note ? `<p class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">Note: ${s.note}</p>` : ''}
          </div>
          <span class="text-xs font-black ${sColor}">${sText}</span>
        </div>
      `;
    }).join('');
  }
}

async function loadSubjectAttendanceBreakdown() {
  const container = document.getElementById('sp-subject-attendance-list');
  if (!container) return;

  try {
    const res = await API.getStudentSubjects();
    const subjects = res.subjects || [];
    if (subjects.length === 0) {
      container.innerHTML = '<div class="p-3 text-center text-xs text-[var(--text-sub)]">No subjects assigned yet.</div>';
      return;
    }

    container.innerHTML = subjects.map(s => {
      const att = s.attendance || {};
      const pct = att.percentage !== null ? att.percentage : null;
      const pctStr = pct !== null ? `${pct}%` : 'N/A';
      return `
        <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-1.5 shadow-2xs">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-[var(--text-main)]">${s.name}</span>
            <span class="text-xs font-black text-[#245b70] dark:text-cyan-400">${pctStr}</span>
          </div>
          <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div class="h-full bg-teal-600 rounded-full" style="width: ${pct || 0}%"></div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-[var(--text-sub)]">
            <span>Faculty: ${s.teacher || 'Assigned'}</span>
            <span>${att.present || 0} / ${att.totalSessions || 0} attended</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="p-3 text-center text-xs text-rose-500">Failed to load subject attendance</div>';
  }
}

function filterStudentAttendanceSessions(status) {
  currentStudentSessionsFilter = status;
  ['all', 'P', 'A', 'L'].forEach(st => {
    const btn = document.getElementById(`sp-afilt-${st}`);
    if (btn) {
      if (st === status) {
        btn.className = "px-2 py-1 rounded-lg text-[10px] font-bold bg-[#245b70] text-white";
      } else {
        btn.className = "px-2 py-1 rounded-lg text-[10px] font-bold bg-[var(--bg-page)] text-[var(--text-sub)]";
      }
    }
  });

  renderStudentAttendanceSessions(currentStudentAllSessions, status);
}

function renderStudentAttendanceSessions(sessions, filter = 'all') {
  const container = document.getElementById('sp-attendance-sessions');
  if (!container) return;

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);

  if (!filtered || filtered.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-xs text-[var(--text-sub)] font-medium">
        No attendance sessions matching this selection.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(s => {
    let badgeColor = 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30';
    let statusLabel = 'Present';
    if (s.status === 'A') {
      badgeColor = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
      statusLabel = 'Absent';
    } else if (s.status === 'L') {
      badgeColor = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      statusLabel = 'Leave';
    }

    return `
      <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-center justify-between gap-2 shadow-2xs">
        <div class="flex items-center gap-2.5">
          <span class="w-2.5 h-2.5 rounded-full ${s.status === 'P' ? 'bg-teal-500' : (s.status === 'A' ? 'bg-rose-500' : 'bg-amber-500')}"></span>
          <div>
            <h5 class="text-xs font-black text-[var(--text-main)]">${s.date || 'Date'}</h5>
            <p class="text-[10px] text-[var(--text-sub)] font-medium">${s.subject ? `Subject: ${s.subject}` : `Class: ${s.class || ''}`} ${s.period ? `• Period ${s.period}` : ''}</p>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-xl text-xs font-black border ${badgeColor}">
          ${statusLabel}
        </span>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------------------
// 4. CAMPUS UPDATES & CIRCULARS CONTROLLER
// -------------------------------------------------------------------------
async function loadStudentUpdates() {
  const container = document.getElementById('sp-announcements-list');
  if (!container) return;
  container.innerHTML = '<div class="p-6 text-center text-xs text-[var(--text-sub)] font-bold">Loading notices...</div>';

  try {
    const res = await API.getStudentAnnouncements();
    currentStudentAnnouncements = res.announcements || [];
    currentStudentEvents = res.events || [];

    renderFilteredStudentUpdates();
  } catch (err) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-rose-500 font-bold">Failed to load notices</div>';
  }
}

function filterStudentUpdates(category) {
  currentStudentUpdatesFilter = category;
  ['all', 'important', 'events'].forEach(cat => {
    const btn = document.getElementById(`sp-ufilt-${cat}`);
    if (btn) {
      if (cat === category) {
        btn.className = "px-2.5 py-1 rounded-xl text-xs font-bold bg-[#245b70] text-white transition flex-shrink-0 shadow-2xs";
      } else {
        btn.className = "px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--bg-page)] text-[var(--text-sub)] hover:text-[var(--text-main)] border border-[var(--border-color)] transition flex-shrink-0";
      }
    }
  });

  renderFilteredStudentUpdates();
}

function handleStudentUpdatesSearch(query) {
  currentStudentUpdatesSearch = (query || '').toLowerCase().trim();
  renderFilteredStudentUpdates();
}

function renderFilteredStudentUpdates() {
  const container = document.getElementById('sp-announcements-list');
  if (!container) return;

  let notices = [...currentStudentAnnouncements];
  let events = [...currentStudentEvents];

  if (currentStudentUpdatesFilter === 'important') {
    notices = notices.filter(n => n.priority === 'important');
    events = [];
  } else if (currentStudentUpdatesFilter === 'events') {
    notices = [];
  }

  if (currentStudentUpdatesSearch) {
    const q = currentStudentUpdatesSearch;
    notices = notices.filter(n => (n.title || '').toLowerCase().includes(q) || (n.description || '').toLowerCase().includes(q));
    events = events.filter(e => (e.name || '').toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q));
  }

  if (notices.length === 0 && events.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-2">
        <svg class="w-10 h-10 text-[var(--text-sub)] opacity-50 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <h4 class="text-xs sm:text-sm font-black text-[var(--text-main)]">Notice Board is Clean</h4>
        <p class="text-[11px] text-[var(--text-sub)]">No circulars or events match this selection right now.</p>
      </div>
    `;
    return;
  }

  let html = '';

  if (events.length > 0) {
    html += `
      <div class="space-y-2 mb-3">
        <h4 class="text-xs font-black text-[var(--text-sub)] uppercase tracking-wider">Upcoming Events</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${events.map(ev => `
            <div onclick="openStudentNoticeModal('${ev._id}', 'event')" class="p-3.5 rounded-2xl bg-[var(--bg-page)] border border-cyan-500/30 hover:border-cyan-500 transition active:scale-98 cursor-pointer space-y-1.5 shadow-2xs">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded-md bg-cyan-500 text-white font-black text-[9px] uppercase tracking-wider">${ev.status || 'Upcoming'}</span>
                <span class="text-[10px] font-bold text-[var(--text-sub)]">${ev.date || ''}</span>
              </div>
              <h5 class="text-xs sm:text-sm font-black text-[var(--text-main)]">${ev.name}</h5>
              ${ev.description ? `<p class="text-[11px] text-[var(--text-sub)] line-clamp-2">${ev.description}</p>` : ''}
              ${ev.location ? `<p class="text-[10px] text-cyan-700 dark:text-cyan-300 font-bold">Location: ${ev.location}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (notices.length > 0) {
    html += `
      <div class="space-y-2.5">
        <h4 class="text-xs font-black text-[var(--text-sub)] uppercase tracking-wider">School Circulars & Notices</h4>
        ${notices.map(n => {
          const isImp = n.priority === 'important';
          const dateStr = n.publishedAt ? new Date(n.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          return `
            <div onclick="openStudentNoticeModal('${n._id}', 'announcement')" class="p-4 rounded-2xl ${isImp ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[var(--bg-page)] border-[var(--border-color)]'} border hover:border-[#245b70]/40 transition active:scale-98 cursor-pointer space-y-2 shadow-2xs">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  ${isImp ? '<span class="px-2 py-0.5 rounded-md bg-amber-500 text-white font-black text-[9px] uppercase tracking-wider">Important</span>' : '<span class="px-2 py-0.5 rounded-md bg-slate-500/20 text-[var(--text-sub)] font-bold text-[9px]">Notice</span>'}
                  <h5 class="text-xs sm:text-sm font-black text-[var(--text-main)] truncate">${n.title}</h5>
                </div>
                <span class="text-[10px] text-[var(--text-sub)] font-medium flex-shrink-0">${dateStr}</span>
              </div>
              <p class="text-xs text-[var(--text-main)] opacity-90 leading-relaxed whitespace-pre-line line-clamp-3">${n.description}</p>
              <div class="text-[10px] text-[var(--text-sub)] font-semibold pt-1 border-t border-[var(--border-color)]/50 flex items-center justify-between">
                <span>Posted by: <b>${n.createdByName || 'Administration'}</b></span>
                <span class="text-[#245b70] dark:text-cyan-400 font-bold">Read Full -></span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
}

function openStudentNoticeModal(id, type) {
  const modal = document.getElementById('modal-student-notice-detail');
  if (!modal) return;

  let item = null;
  if (type === 'event') {
    item = currentStudentEvents.find(e => String(e._id) === String(id));
  } else {
    item = currentStudentAnnouncements.find(n => String(n._id) === String(id));
  }
  if (!item) return;

  const titleEl = document.getElementById('snd-title');
  const dateEl = document.getElementById('snd-date');
  const badgeEl = document.getElementById('snd-priority-badge');
  const contentEl = document.getElementById('snd-content');
  const authorEl = document.getElementById('snd-author');

  if (type === 'event') {
    if (titleEl) titleEl.textContent = item.name;
    if (dateEl) dateEl.textContent = `${item.date || ''} ${item.time || ''}`;
    if (badgeEl) {
      badgeEl.className = "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-cyan-500 text-white";
      badgeEl.textContent = item.status || 'Event';
    }
    if (contentEl) {
      contentEl.innerHTML = `
        <p>${item.description || 'No description provided'}</p>
        ${item.location ? `<p class="mt-2 font-bold text-cyan-700 dark:text-cyan-300">Venue: ${item.location}</p>` : ''}
      `;
    }
    if (authorEl) authorEl.textContent = 'School Calendar Event';
  } else {
    if (titleEl) titleEl.textContent = item.title;
    if (dateEl) dateEl.textContent = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
    if (badgeEl) {
      const isImp = item.priority === 'important';
      badgeEl.className = `px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${isImp ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`;
      badgeEl.textContent = isImp ? 'Important Circular' : 'General Notice';
    }
    if (contentEl) contentEl.textContent = item.description || '';
    if (authorEl) authorEl.textContent = `Posted by: ${item.createdByName || 'Administration'}`;
  }

  modal.classList.remove('hidden');
}

function closeStudentNoticeModal() {
  const modal = document.getElementById('modal-student-notice-detail');
  if (modal) modal.classList.add('hidden');
}

// -------------------------------------------------------------------------
// 5. PROFILE & LEAVE APPLICATION CONTROLLER
// -------------------------------------------------------------------------
async function loadStudentProfile() {
  loadStudentLeaveRequests();
}

function openStudentLeaveModal() {
  const modal = document.getElementById('modal-student-leave-request');
  if (!modal) return;
  const todayStr = new Date().toISOString().split('T')[0];
  const fromEl = document.getElementById('slr-from-date');
  const toEl = document.getElementById('slr-to-date');
  const reasonEl = document.getElementById('slr-reason');

  if (fromEl) fromEl.value = todayStr;
  if (toEl) toEl.value = todayStr;
  if (reasonEl) reasonEl.value = '';

  modal.classList.remove('hidden');
}

function closeStudentLeaveModal() {
  const modal = document.getElementById('modal-student-leave-request');
  if (modal) modal.classList.add('hidden');
}

async function handleStudentLeaveSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('slr-submit-btn');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Submitting...';
  }

  try {
    const fromDate = document.getElementById('slr-from-date')?.value?.trim();
    const toDate = document.getElementById('slr-to-date')?.value?.trim();
    const reason = document.getElementById('slr-reason')?.value?.trim();

    if (!fromDate || !toDate || !reason) {
      showToast('Please provide from date, to date, and reason');
      return;
    }

    const res = await API.submitStudentLeaveRequest({ fromDate, toDate, reason });
    if (res.success) {
      showToast(res.message || 'Leave request submitted successfully');
      closeStudentLeaveModal();
      loadStudentLeaveRequests();
    } else {
      showToast(res.message || 'Failed to submit leave request');
    }
  } catch (err) {
    showToast(err.message || 'Error submitting leave request');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

async function loadStudentLeaveRequests() {
  const container = document.getElementById('sp-my-leave-requests');
  if (!container) return;

  try {
    const res = await API.getStudentLeaveRequests();
    const requests = res.requests || [];
    currentStudentLeaveRequests = requests;

    if (requests.length === 0) {
      container.innerHTML = '<div class="p-3 text-center text-xs text-[var(--text-sub)]">No leave applications submitted yet.</div>';
      return;
    }

    container.innerHTML = requests.map(r => {
      let statusColor = 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
      let statusLabel = 'Pending Review';
      if (r.status === 'approved') {
        statusColor = 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
        statusLabel = 'Approved';
      } else if (r.status === 'rejected') {
        statusColor = 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30';
        statusLabel = 'Rejected';
      }

      return `
        <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-1.5 shadow-2xs">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-black text-[var(--text-main)]">${r.fromDate} to ${r.toDate}</span>
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-black border ${statusColor}">${statusLabel}</span>
          </div>
          <p class="text-xs text-[var(--text-sub)]">${r.reason || ''}</p>
          ${r.teacherRemarks ? `<p class="text-[10px] text-teal-700 dark:text-teal-300 font-semibold">Teacher Remark: ${r.teacherRemarks}</p>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="p-3 text-center text-xs text-rose-500">Failed to load leave requests</div>';
  }
}

async function handleStudentPasswordChange(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('sp-pw-current')?.value?.trim();
  const newPassword = document.getElementById('sp-pw-new')?.value?.trim();
  const btn = document.getElementById('sp-pw-btn');

  if (!newPassword || newPassword.length < 6) {
    showToast('New password must be at least 6 characters long');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Updating...';
  }

  try {
    const res = await API.changeStudentPassword({ currentPassword, newPassword });
    if (res.success) {
      showToast(res.message || 'Password updated successfully');
      document.getElementById('sp-pw-current').value = '';
      document.getElementById('sp-pw-new').value = '';
    } else {
      showToast(res.message || 'Failed to update password');
    }
  } catch (err) {
    showToast(err.message || 'Error updating password');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  }
}

function showStudentExamResultsNotice() {
  showToast('Semester examination marks and grading cards are being compiled by the examination board.');
}

function printStudentIdCard() {
  window.print();
}

function handleStudentLogout() {
  API.setToken(null);
  currentUser = null;
  currentStudentData = null;
  showToast('Logged out of student portal');
  window.location.href = '/?portal=student';
}

// =========================================================================
// ================= OUTCOMERS & DUAL-LINK ROUTING CONTROLLER ==============
// =========================================================================
let currentOutcomersList = [];
let currentOutcomersFilter = 'pending';
let currentApproveOutcomerId = null;

function copyTeacherPortalLink() {
  const url = `${window.location.origin}/?portal=teacher`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Teacher joining link copied to clipboard!');
  }).catch(() => {
    showToast('Link copied!');
  });
}

function shareTeacherPortalWhatsApp() {
  const url = `${window.location.origin}/?portal=teacher`;
  const text = encodeURIComponent(`Welcome teachers! Here is the direct link to access the REGISTERLY Teacher Portal:\n${url}`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function openOutcomersPage() {
  selectTab('outcomers');
}

function goBackFromOutcomers() {
  if (previousAppTab && previousAppTab !== 'outcomers') {
    selectTab(previousAppTab);
  } else {
    selectTab('settings');
  }
}

async function updateOutcomersBadges() {
  try {
    const res = await API.getOutcomers('pending');
    const count = (res.data || []).length;

    const settingsBadge = document.getElementById('settings-outcomers-badge');
    if (settingsBadge) {
      if (count > 0) {
        settingsBadge.textContent = `${count} Pending`;
        settingsBadge.classList.remove('hidden');
      } else {
        settingsBadge.classList.add('hidden');
      }
    }

    const studentsBadge = document.getElementById('students-outcomers-count');
    if (studentsBadge) {
      studentsBadge.textContent = String(count);
    }

    const headerBadge = document.getElementById('outcomers-header-badge');
    if (headerBadge) {
      headerBadge.textContent = `${count} Pending`;
    }

    const filterPendingCount = document.getElementById('outcomers-filter-pending-count');
    if (filterPendingCount) {
      filterPendingCount.textContent = String(count);
    }
  } catch (err) {
    console.warn('[Outcomers Badges Error]', err);
  }
}

async function loadOutcomers(status) {
  if (status) currentOutcomersFilter = status;
  const container = document.getElementById('outcomers-list-container');
  if (container) {
    container.innerHTML = '<div class="p-8 text-center text-xs text-[var(--text-sub)] font-bold">Loading outcomer submissions...</div>';
  }

  try {
    const res = await API.getOutcomers(currentOutcomersFilter);
    currentOutcomersList = res.data || [];
    renderOutcomers(currentOutcomersList);
    updateOutcomersBadges();
  } catch (err) {
    console.error('[Load Outcomers Error]', err);
    if (container) {
      container.innerHTML = `<div class="p-8 text-center text-xs text-rose-500 font-bold">Failed to load outcomers: ${err.message}</div>`;
    }
  }
}

function filterOutcomers(filter) {
  currentOutcomersFilter = filter;
  ['pending', 'approved', 'all'].forEach(f => {
    const btn = document.getElementById(`outcomers-tab-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = "px-3 py-1.5 rounded-xl text-xs font-black bg-amber-500 text-white shadow-2xs transition flex items-center gap-1.5";
      } else {
        btn.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--card-bg)] text-[var(--text-sub)] hover:text-[var(--text-main)] border border-[var(--border-color)] transition flex items-center gap-1.5";
      }
    }
  });
  loadOutcomers(filter);
}

function handleOutcomersSearch(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderOutcomers(currentOutcomersList);
    return;
  }
  const filtered = currentOutcomersList.filter(s => {
    const name = (s.name || '').toLowerCase();
    const cls = (s.class || '').toLowerCase();
    const email = (s.personalDetails?.studentEmail || '').toLowerCase();
    const phone = (s.familyDetails?.fatherMobile || '').toLowerCase();
    return name.includes(q) || cls.includes(q) || email.includes(q) || phone.includes(q);
  });
  renderOutcomers(filtered);
}

function renderOutcomers(list) {
  const container = document.getElementById('outcomers-list-container');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="p-10 text-center rounded-3xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-sm space-y-2.5">
        <div class="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h4 class="text-sm sm:text-base font-black text-[var(--text-main)]">No Outcomers Found</h4>
        <p class="text-xs text-[var(--text-sub)] max-w-md mx-auto">
          ${currentOutcomersFilter === 'pending'
            ? 'There are no pending student submissions waiting for verification. Share the Student Link above to let students submit their details.'
            : 'No student registrations match this filter.'}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(s => {
    const isPending = s.registrationStatus === 'pending';
    const p = s.personalDetails || {};
    const a = s.address || {};
    const f = s.familyDetails || {};
    const createdDate = s.createdAt ? new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const fullAddr = [a.fullAddress, a.place, a.district, a.state, a.pinCode ? `PIN: ${a.pinCode}` : ''].filter(Boolean).join(', ') || 'No address provided';

    return `
      <div class="bg-[var(--card-bg)] rounded-3xl p-4 sm:p-5 border ${isPending ? 'border-amber-500/40' : 'border-[var(--border-color)]'} shadow-sm space-y-3.5 transition-all">
        <!-- Top Row: Student Avatar, Name, Requested Class & Actions -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-color)] pb-3">
          <div class="flex items-center gap-3">
            <img src="${s.photoUrl || DEFAULT_AVATAR}" alt="${escapeHtml(s.name)}" class="w-13 h-13 rounded-2xl object-cover border-2 border-[var(--border-color)] bg-slate-200 flex-shrink-0">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-black text-sm sm:text-base text-[var(--text-main)]">${escapeHtml(s.name)}</h4>
                <span class="px-2 py-0.5 rounded-lg bg-[#245b70]/15 text-[#245b70] dark:text-cyan-300 font-extrabold text-xs">Class: ${escapeHtml(s.class || 'Unassigned')}</span>
                <span class="px-2 py-0.5 rounded-lg bg-slate-500/10 text-[var(--text-sub)] font-bold text-xs">Roll: #${s.roll ?? '-'}</span>
                ${isPending
                  ? '<span class="px-2 py-0.5 rounded-lg bg-amber-500 text-white font-black text-[10px] uppercase shadow-2xs">Pending Verification</span>'
                  : '<span class="px-2 py-0.5 rounded-lg bg-teal-500 text-white font-black text-[10px] uppercase shadow-2xs">Enrolled</span>'}
              </div>
              <p class="text-[11px] text-[var(--text-sub)] font-medium mt-0.5">Submitted: ${createdDate} • Email: ${escapeHtml(p.studentEmail || 'No email')}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 self-end sm:self-center">
            ${isPending ? `
              <button type="button" onclick="openApproveOutcomerModal('${s._id}')" class="touch-btn px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Verify & Add to Class</span>
              </button>
              <button type="button" onclick="triggerRejectOutcomer('${s._id}')" class="touch-btn px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1 transition active:scale-95">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                <span>Cancel</span>
              </button>
            ` : `
              <span class="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                <span>✓ Active in Roster (ID: ${s.studentId || '-'})</span>
              </span>
            `}
          </div>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          <div class="p-2.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)]">
            <span class="text-[10px] font-bold text-[var(--text-sub)] uppercase">DOB & Blood Group</span>
            <p class="font-extrabold text-[var(--text-main)] mt-0.5">${p.dob || 'Not specified'} • ${p.bloodGroup || 'Blood: -'} (${p.gender || '-'})</p>
          </div>
          <div class="p-2.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)]">
            <span class="text-[10px] font-bold text-[var(--text-sub)] uppercase">Father's Contact</span>
            <p class="font-extrabold text-[var(--text-main)] mt-0.5">
              ${f.fatherName || 'Not specified'} 
              ${f.fatherMobile ? `<a href="tel:${f.fatherMobile}" class="text-[#245b70] dark:text-cyan-400 underline font-black ml-1 inline-flex items-center gap-1"><svg class="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>${f.fatherMobile}</a>` : ''}
            </p>
          </div>
          <div class="p-2.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)]">
            <span class="text-[10px] font-bold text-[var(--text-sub)] uppercase">Mother's Contact</span>
            <p class="font-extrabold text-[var(--text-main)] mt-0.5">
              ${f.motherName || 'Not specified'}
              ${f.motherNumber ? `<a href="tel:${f.motherNumber}" class="text-[#245b70] dark:text-cyan-400 underline font-black ml-1 inline-flex items-center gap-1"><svg class="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>${f.motherNumber}</a>` : ''}
            </p>
          </div>
          <div class="p-2.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)] sm:col-span-2 lg:col-span-3">
            <span class="text-[10px] font-bold text-[var(--text-sub)] uppercase">Residential Address</span>
            <p class="font-extrabold text-[var(--text-main)] mt-0.5">${escapeHtml(fullAddr)}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openApproveOutcomerModal(id) {
  currentApproveOutcomerId = id;
  const student = currentOutcomersList.find(s => String(s._id) === String(id));
  if (!student) return;

  const modal = document.getElementById('modal-approve-outcomer');
  if (!modal) return;

  const avatar = document.getElementById('aom-avatar');
  if (avatar) avatar.src = student.photoUrl || DEFAULT_AVATAR;

  const nameEl = document.getElementById('aom-name');
  if (nameEl) nameEl.textContent = student.name;

  const emailEl = document.getElementById('aom-email');
  if (emailEl) emailEl.textContent = student.personalDetails?.studentEmail || `Requested: ${student.class || '-'}`;

  const studentIdInput = document.getElementById('aom-student-id');
  if (studentIdInput) studentIdInput.value = student._id;

  const classSelect = document.getElementById('aom-class-select');
  if (classSelect) {
    classSelect.innerHTML = '';
    classesList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      if (student.class && isClassEqual(c.name, student.class)) {
        opt.selected = true;
      }
      classSelect.appendChild(opt);
    });
  }

  const rollInput = document.getElementById('aom-roll');
  if (rollInput) {
    rollInput.value = student.roll ?? 1;
  }

  modal.classList.remove('hidden');
}

function closeApproveOutcomerModal() {
  const modal = document.getElementById('modal-approve-outcomer');
  if (modal) modal.classList.add('hidden');
  currentApproveOutcomerId = null;
}

async function submitApproveOutcomer(e) {
  e.preventDefault();
  if (!currentApproveOutcomerId) return;

  const btn = document.getElementById('aom-submit-btn');
  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Enrolling...</span>';
  }

  const assignedClass = document.getElementById('aom-class-select')?.value?.trim();
  const roll = document.getElementById('aom-roll')?.value?.trim();

  try {
    const res = await API.approveOutcomer(currentApproveOutcomerId, {
      class: assignedClass,
      roll: Number(roll)
    });

    if (res.success) {
      showToast(res.message || 'Student enrolled successfully!');
      closeApproveOutcomerModal();
      await loadOutcomers();
      await loadAttendanceRoster();
      renderStudentsDirectory();
    } else {
      showToast(res.message || 'Approval failed');
    }
  } catch (err) {
    console.error('[Approve Outcomer Error]', err);
    showToast(err.message || 'Error approving student');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

async function triggerRejectOutcomer(id) {
  const student = currentOutcomersList.find(s => String(s._id) === String(id));
  const sName = student ? student.name : 'this student';
  if (!confirm(`Are you sure you want to cancel the registration for ${sName}? This student will not be included in the roster.`)) {
    return;
  }

  try {
    const res = await API.rejectOutcomer(id);
    if (res.success) {
      showToast(res.message || 'Registration submission cancelled');
      await loadOutcomers();
    } else {
      showToast(res.message || 'Failed to cancel submission');
    }
  } catch (err) {
    console.error('[Reject Outcomer Error]', err);
    showToast(err.message || 'Error cancelling outcomer');
  }
}


