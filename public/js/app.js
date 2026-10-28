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
let currentDateStr = new Date().toISOString().slice(0, 10);
let currentClass = 'Class 10';
let currentSubject = '';

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

let appSettings = { appName: 'REGISTERLY', schoolName: '', allowNonAdminEditDelete: false };

function canUserEditDelete() {
  if (currentUser && currentUser.role === 'admin') return true;
  return Boolean(appSettings && appSettings.allowNonAdminEditDelete);
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
  initServiceWorker();
  updateDateDisplay();
  selectTopTab('attendance');
  try {
    await initGoogleAuth();
    await loadCurrentUser();
    await loadAppSettings();
    await loadClasses();
    await loadSubjects();
    await loadTeachersData();
    await loadAttendanceRoster();
    await loadReport();
    await loadActivityLogs();
    await checkUnreadMessages();
  } catch (err) {
    console.error('[App Init Error]', err);
  } finally {
    hideSplashLoader();
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
    showToast('To install in Chrome, open menu (⋮) > "Install app" or "Add to Home screen"');
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

  // Reload activity logs
  loadActivityLogs();
}

// Dark Mode Toggle with Sun SVG
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  const body = document.getElementById('app-body');
  if (isDarkMode) {
    body.classList.add('dark-mode');
    document.documentElement.classList.add('dark');
    showToast('Dark Mode Activated');
  } else {
    body.classList.remove('dark-mode');
    document.documentElement.classList.remove('dark');
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
    }
  } catch (error) {
    console.log('[Settings Load]', error);
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
    selClass.innerHTML = optionsHtml;
    if (classesList.length > 0) currentClass = classesList[0].name;
  }
  if (repClass) repClass.innerHTML = optionsHtml;
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

  container.innerHTML = classesList.map((c, index) => `
    <div class="drag-item bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center justify-between"
         draggable="true"
         ondragstart="handleClassDragStart(event, ${index})"
         ondragover="handleClassDragOver(event, ${index})"
         ondragleave="handleClassDragLeave(event)"
         ondragend="handleClassDragEnd(event)"
         ondrop="handleClassDrop(event, ${index})">
      <div class="flex items-center gap-3">
        <!-- Drag Handle Icon -->
        <div class="text-[var(--text-sub)] hover:text-[#245b70] cursor-grab active:cursor-grabbing p-1" title="Drag to reorder class">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>
        <div class="w-10 h-10 rounded-xl text-white font-black text-sm flex items-center justify-center custom-gradient-header flex-shrink-0">
          ${c.name.replace(/[^0-9]/g, '') || c.name.slice(0, 3)}
        </div>
        <div class="min-w-0">
          <h3 class="font-bold text-[var(--text-main)] text-sm">${escapeHtml(c.name)}</h3>
          <p class="text-xs text-[var(--text-sub)]">Class Teacher: ${escapeHtml(c.classTeacher)}</p>
          <div class="mt-1 flex items-center gap-1 flex-wrap">
            <span class="text-[10px] font-bold text-[var(--text-sub)] mr-0.5 uppercase tracking-wide">Subjects:</span>
            ${(c.assignedSubjects && c.assignedSubjects.length > 0)
              ? c.assignedSubjects.map(sub => `
                  <span class="subject-chip" title="Assigned Subject: ${escapeHtml(sub)}">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#245b70] dark:bg-teal-400"></span>
                    <span>${escapeHtml(sub)}</span>
                  </span>
                `).join('')
              : `<span class="text-xs text-[var(--text-sub)] italic">None</span>`
            }
          </div>
        </div>
      </div>
      ${canUserEditDelete() ? `
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button onclick="openEditClassModal('${c._id}')" title="Edit Class" class="w-8 h-8 rounded-xl bg-[var(--bg-page)] text-[var(--text-main)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button onclick="deleteClass('${c._id}', '${c.name.replace(/'/g, "\\'")}')" title="Delete Class" class="w-8 h-8 rounded-xl btn-delete flex items-center justify-center transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
      ` : ''}
    </div>
  `).join('');
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
  const cls = (classesList || []).find(c => c.name === className);
  if (cls && Array.isArray(cls.assignedSubjects) && cls.assignedSubjects.length > 0) {
    const matched = subjectsList.filter(s => cls.assignedSubjects.includes(s.name));
    if (matched.length > 0) {
      return matched;
    }
  }
  return subjectsList;
}

function updateAttendanceSubjectsDropdown(selectedClass) {
  const selSubject = document.getElementById('sel-subject');
  if (!selSubject) return;

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
  updateAttendanceSubjectsDropdown(currentClass);
  await loadAttendanceRoster();
}

function populateSubjectDropdowns() {
  const selClassEl = document.getElementById('sel-class');
  const targetClass = selClassEl ? selClassEl.value : currentClass;
  updateAttendanceSubjectsDropdown(targetClass);

  const repSubject = document.getElementById('report-subject');
  if (repSubject) {
    const allOptionsHtml = subjectsList.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    repSubject.innerHTML = `<option value="whole">All Subjects</option>` + allOptionsHtml;
  }
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
async function loadAttendanceRoster() {
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

          <button onclick="setStudentStatus(${st.studentId}, 'L')" class="w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center transition-all ${
            isL ? 'bg-amber-500 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-amber-50 hover:text-amber-700'
          }">L</button>
        </div>
      </div>
    `;
  }).join('');

  updateAttendanceStats();
}

function setStudentStatus(studentId, status) {
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
    const todayStr = new Date().toISOString().slice(0, 10);
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);

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
  document.getElementById('log-modal-subtitle').innerText = `Roll #${roll} • ID: ${studentId}`;

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
      : allStudents.filter(s => s.class === filterClass).length;

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
    let students = filterClass === 'all' ? allStudents : allStudents.filter(s => s.class === filterClass);

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
            <div class="flex items-center gap-2.5 min-w-0">
              <img src="${st.photoUrl || DEFAULT_AVATAR}" class="w-11 h-11 rounded-xl object-cover border border-[#245b70] flex-shrink-0 shadow-sm">
              <div class="truncate">
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-[var(--text-main)] text-sm truncate">${st.name}</span>
                  <span class="text-[10px] font-black bg-[#245b70]/10 text-[#245b70] px-1.5 py-0.2 rounded flex-shrink-0">ID: ${st.studentId}</span>
                </div>
                <p class="text-xs text-[var(--text-sub)] truncate">${st.class} • Roll: ${st.roll}</p>
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
        ? allStudents.filter(s => s.class === selectedClass).length
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

// Add Student Modal (Auto Student ID starting at 2000, read-only)
async function openStudentModal() {
  newStudentPhotoUrl = '';
  newStudentBase64Photo = '';
  const preview = document.getElementById('new-preview-photo');
  if (preview) preview.src = DEFAULT_AVATAR;

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
  const name = document.getElementById('new-student-name').value.trim();
  const studentClass = document.getElementById('new-student-class').value;
  const roll = document.getElementById('new-student-roll').value;
  const fullAddress = document.getElementById('new-student-address').value.trim();
  const place = document.getElementById('new-student-place').value.trim();
  const district = document.getElementById('new-student-district').value.trim();
  const state = document.getElementById('new-student-state').value.trim();
  const fatherName = document.getElementById('new-student-father').value.trim();
  const motherName = document.getElementById('new-student-mother').value.trim();
  const fatherMobile = document.getElementById('new-student-mobile-normal').value.trim();
  const fatherWhatsapp = document.getElementById('new-student-mobile-wa').value.trim();
  const yearJoined = document.getElementById('new-student-year-joined').value.trim() || '2024';
  const rank = document.getElementById('new-student-rank').value.trim();
  const previousCollege = document.getElementById('new-student-college').value.trim();

  const photoUrl = newStudentPhotoUrl || newStudentBase64Photo || DEFAULT_AVATAR;

  const payload = {
    name,
    class: studentClass,
    roll,
    photoUrl,
    address: { fullAddress, place, district, state },
    familyDetails: { fatherName, motherName, fatherMobile, fatherWhatsapp },
    academicStatus: { yearJoined, rank, previousCollege }
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
    document.getElementById('edit-student-name').value = student.name || '';
    document.getElementById('edit-student-class').value = student.class || '';
    document.getElementById('edit-student-roll').value = student.roll || '';
    document.getElementById('edit-student-address').value = (student.address && student.address.fullAddress) || '';
    document.getElementById('edit-student-place').value = (student.address && student.address.place) || '';
    document.getElementById('edit-student-district').value = (student.address && student.address.district) || '';
    document.getElementById('edit-student-state').value = (student.address && student.address.state) || '';
    document.getElementById('edit-student-father').value = (student.familyDetails && student.familyDetails.fatherName) || '';
    document.getElementById('edit-student-mother').value = (student.familyDetails && student.familyDetails.motherName) || '';
    document.getElementById('edit-student-mobile-normal').value = (student.familyDetails && student.familyDetails.fatherMobile) || '';
    document.getElementById('edit-student-mobile-wa').value = (student.familyDetails && student.familyDetails.fatherWhatsapp) || '';
    
    // Academic Status: Year Joined in the College
    const yr = (student.academicStatus && (student.academicStatus.yearJoined || student.academicStatus.admissionStatus)) || '2024';
    document.getElementById('edit-student-year-joined').value = yr;
    document.getElementById('edit-student-rank').value = (student.academicStatus && student.academicStatus.rank) || '';
    document.getElementById('edit-student-college').value = (student.academicStatus && student.academicStatus.previousCollege) || '';

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

  const name = document.getElementById('edit-student-name').value.trim();
  const studentClass = document.getElementById('edit-student-class').value;
  const roll = document.getElementById('edit-student-roll').value;
  const fullAddress = document.getElementById('edit-student-address').value.trim();
  const place = document.getElementById('edit-student-place').value.trim();
  const district = document.getElementById('edit-student-district').value.trim();
  const state = document.getElementById('edit-student-state').value.trim();
  const fatherName = document.getElementById('edit-student-father').value.trim();
  const motherName = document.getElementById('edit-student-mother').value.trim();
  const fatherMobile = document.getElementById('edit-student-mobile-normal').value.trim();
  const fatherWhatsapp = document.getElementById('edit-student-mobile-wa').value.trim();
  const yearJoined = document.getElementById('edit-student-year-joined').value.trim();
  const rank = document.getElementById('edit-student-rank').value.trim();
  const previousCollege = document.getElementById('edit-student-college').value.trim();

  const payload = {
    name,
    class: studentClass,
    roll,
    photoUrl: editStudentPhotoUrl || editStudentBase64Photo,
    address: { fullAddress, place, district, state },
    familyDetails: { fatherName, motherName, fatherMobile, fatherWhatsapp },
    academicStatus: { yearJoined, rank, previousCollege }
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

  document.getElementById('details-student-address').innerText = (student.address && student.address.fullAddress) || '—';
  document.getElementById('details-student-place').innerText = (student.address && student.address.place) || '—';
  document.getElementById('details-student-district').innerText = (student.address && student.address.district) || '—';
  document.getElementById('details-student-state').innerText = (student.address && student.address.state) || '—';

  document.getElementById('details-student-father').innerText = (student.familyDetails && student.familyDetails.fatherName) || '—';
  document.getElementById('details-student-mother').innerText = (student.familyDetails && student.familyDetails.motherName) || '—';
  document.getElementById('details-student-mobile').innerText = (student.familyDetails && student.familyDetails.fatherMobile) || '—';
  document.getElementById('details-student-wa').innerText = (student.familyDetails && student.familyDetails.fatherWhatsapp) || '—';

  const yr = (student.academicStatus && (student.academicStatus.yearJoined || student.academicStatus.admissionStatus)) || '—';
  document.getElementById('details-student-year').innerText = yr;
  document.getElementById('details-student-rank').innerText = (student.academicStatus && student.academicStatus.rank) || '—';
  document.getElementById('details-student-college').innerText = (student.academicStatus && student.academicStatus.previousCollege) || '—';

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
async function loadActivityLogs() {
  const container = document.getElementById('activity-logs-container');
  if (!container) return;

  try {
    const res = await API.getLogs();
    if (res.success && res.data) {
      const logs = res.data;
      if (logs.length === 0) {
        container.innerHTML = `<div class="p-3 text-xs text-center text-[var(--text-sub)]">No recent activity logs.</div>`;
        return;
      }

      // Check if current user is admin
      const isAdmin = currentUser && currentUser.role === 'admin';

      container.innerHTML = logs.map(log => `
        <div id="log-item-${log._id}" class="p-2.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-center justify-between gap-2 ${log.isUndone ? 'opacity-50' : ''}">
          <div>
            <div class="font-bold text-[var(--text-main)] text-xs">${log.action}</div>
            <div class="text-[10px] text-[var(--text-sub)]">${log.details || ''}</div>
            <div class="text-[9px] text-[#245b70] font-semibold mt-0.5">by ${log.performedBy}</div>
          </div>
          ${log.isUndone ? `
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Reverted</span>
          ` : (isAdmin && log.canUndo ? `
            <!-- UNDO BUTTON: ONLY shown for Admin accounts as explicitly requested! -->
            <button onclick="undoLog('${log._id}', '${log.action}')" class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 hover:bg-amber-200 active:scale-95 transition">
              Undo
            </button>
          ` : '')}
        </div>
      `).join('');
    }
  } catch (error) {
    console.log('[Logs Load]', error);
  }
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

// ================= ADMIN PANEL & TEACHERS LIST =================
function openAdminPanel() {
  document.getElementById('modal-admin-panel').classList.remove('hidden');
  loadAdminTeachersList();
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
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const res = await API.importBackup(data);
    if (res.success) {
      showToast('Admin: Database successfully restored from backup!');
      await loadClasses();
      await loadSubjects();
      await loadAttendanceRoster();
      await loadReport();
    }
  } catch (error) {
    showToast('Invalid backup file or restore failed', true);
  }
}

// ================= DATA CONTROLS (ADMIN ONLY) =================
// USER DIRECTIVE:
// "clear data for only clear data of attendence of whole class, not teachers, students, class ,subjects,details"
async function handleClearDataPrompt() {
  const confirmed = confirm(
    "⚠️ CLEAR ATTENDANCE DATA:\n\n" +
    "Are you sure you want to clear attendance records? Teachers, students, classes, subjects, and student details will NOT be deleted."
  );
  if (!confirmed) return;

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
    "⚠️ FULL APP RESET (LIKE NEW):\n\n" +
    "Are you sure you want to wipe all app data like new? All students, classes, subjects, attendance, logs, and settings will be completely reset."
  );
  if (!confirmed) return;

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

  if (tab === 'report') loadReport();
  if (tab === 'settings') loadActivityLogs();
}

function selectBottomTab(tab) {
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
  if (iconEl) iconEl.innerText = isError ? '⚠️' : '✅';
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
    let yearOptions = `<option value="all">All Years (Total)</option>`;
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
  const defaultLabel = isClassTeacher ? '-- Select Class Teacher (optional) --' : '-- Select Teacher (optional) --';

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
        <div class="bg-[var(--card-bg)] p-3.5 sm:p-4 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition space-y-3">
          <!-- Top Row: Avatar, Name, Email, Status & Actions -->
          <div class="flex items-start justify-between gap-2.5">
            <div class="flex items-center gap-3 min-w-0">
              <img src="${avatar}" alt="${escapeHtml(t.name)}" class="w-12 h-12 rounded-2xl object-cover border border-[#245b70] shadow-sm flex-shrink-0">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h3 class="font-extrabold text-sm sm:text-base text-[var(--text-main)] truncate">${escapeHtml(t.name)}</h3>
                  ${roleBadge}
                  ${googleStatusBadge}
                </div>
                <p class="text-xs text-[var(--text-sub)] font-medium truncate mt-0.5">${t.email ? escapeHtml(t.email) : '<span class="text-slate-400 italic font-normal">No email linked</span>'}</p>
                <!-- Year & Filter Summary Badge -->
                <div class="text-[10px] text-[#245b70] dark:text-cyan-400 font-semibold mt-0.5 flex items-center gap-1">
                  <span>${selectedYear === 'all' ? 'All Years' : selectedYear}</span>
                  <span>•</span>
                  <span>${selectedClass === 'all' ? 'All Classes' : selectedClass}:</span>
                  <span class="font-bold">${currentSessions} sessions</span>
                </div>
              </div>
            </div>

            <!-- Action buttons: Log, Edit, Delete -->
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button onclick="openTeacherLogModal('${t._id}')" class="px-2.5 py-1.5 rounded-xl bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 hover:bg-[#245b70] hover:text-white text-xs font-bold transition flex items-center gap-1 shadow-sm" title="View attendance session logs">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span>${sessionButtonLabel}</span>
              </button>

              ${canUserEditDelete() ? `
              <button onclick="openEditTeacherModal('${t._id}')" title="Edit Teacher" class="w-8 h-8 rounded-xl bg-[var(--bg-page)] text-[var(--text-main)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>

              <button onclick="handleDeleteTeacher('${t._id}', this.getAttribute('data-name'))" data-name="${escapeHtml(t.name)}" title="Delete Teacher" class="w-8 h-8 rounded-xl btn-delete flex items-center justify-center transition">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
              ` : ''}
            </div>
          </div>

          <!-- Bottom: Subjects to teach (Classes row removed as instructed) -->
          <div class="bg-[var(--bg-page)] p-2.5 rounded-xl border border-[var(--border-color)] space-y-1 text-xs">
            <div class="flex items-start gap-2">
              <span class="font-bold text-[var(--text-sub)] min-w-[65px] pt-0.5">Subjects:</span>
              <div class="flex flex-wrap gap-1 flex-1">${subjectsPills}</div>
            </div>
          </div>
        </div>
      `;
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
    const yearEl = document.getElementById('teachers-filter-year');
    const classEl = document.getElementById('teachers-filter-class');
    const selectedYear = yearEl ? yearEl.value : 'all';
    const selectedClass = classEl ? classEl.value : 'all';

    const res = await API.getTeacherLogs(teacherId, selectedYear, selectedClass);
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

      // Populate Class Filter inside Log Modal
      if (filterSelect) {
        let optionsHtml = `<option value="all">All Classes (${stats.totalSessions} sessions)</option>`;
        (stats.classesList || []).forEach(cl => {
          const count = currentTeacherSessions.filter(s => s.class === cl).length;
          optionsHtml += `<option value="${escapeHtml(cl)}">${escapeHtml(cl)} (${count})</option>`;
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
  const filterSelect = document.getElementById('tlog-filter-class');
  const selectedClass = filterSelect ? filterSelect.value : 'all';

  if (!sessionsContainer) return;

  let filtered = currentTeacherSessions || [];
  if (selectedClass !== 'all') {
    filtered = filtered.filter(s => s.class === selectedClass);
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

        <!-- Present / Absent / Late Badges -->
        <div class="flex items-center gap-1.5 flex-shrink-0 text-[11px] font-bold">
          <span class="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">${summary.present} P</span>
          <span class="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">${summary.absent} A</span>
          <span class="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">${summary.late} L</span>
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
    const data = await API.getMessages();
    const messages = data.messages || data || [];
    cachedMessages = messages;
    const myId = currentUser && (currentUser._id || currentUser.id);
    const unreadCount = messages.filter(m => {
      const readBy = m.readBy || [];
      return !readBy.includes(String(myId));
    }).length;
    const badge = document.getElementById('unread-msg-badge');
    if (badge) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      if (unreadCount > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  } catch (err) {
    // silently fail — not critical
  }
}

async function openMessagesModal() {
  const modal = document.getElementById('modal-messages');
  if (modal) modal.classList.remove('hidden');
  await loadMessages();
  try { await API.markMessagesRead(); } catch(_) {}
  const badge = document.getElementById('unread-msg-badge');
  if (badge) badge.classList.add('hidden');
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
    const data = await API.getMessages();
    const messages = data.messages || data || [];
    cachedMessages = messages;
    if (messages.length === 0) {
      container.innerHTML = `<div class="text-center text-xs text-[var(--text-sub)] py-8 italic">No messages yet. Be the first to post!</div>`;
      return;
    }
    const myId = currentUser && (currentUser._id || currentUser.id);
    container.innerHTML = messages.slice().reverse().map(m => {
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
            <div class="${isMine ? 'bg-[#245b70] text-white' : 'bg-[var(--bg-page)] text-[var(--text-main)]'} px-3 py-2 rounded-2xl ${isMine ? 'rounded-tr-md' : 'rounded-tl-md'} text-xs font-medium border ${isMine ? 'border-[#245b70]' : 'border-[var(--border-color)]'} shadow-sm">
              ${escapeHtml(m.text)}
            </div>
          </div>
        </div>
      `;
    }).join('');
    // scroll to bottom
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
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
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
let currentTimetableDay = 'Monday';
let timetableEditingSlotId = null;

async function openTimetableModal() {
  const modal = document.getElementById('modal-timetable');
  if (modal) modal.classList.remove('hidden');

  // Populate class filter
  const classFilter = document.getElementById('timetable-filter-class');
  if (classFilter) {
    classFilter.innerHTML = `<option value="all">All Classes</option>` +
      classesList.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
  }

  // Reset to Monday
  currentTimetableDay = 'Monday';
  _updateTimetableDayTabs();
  await renderTimetableSlots();
}

function closeTimetableModal() {
  const modal = document.getElementById('modal-timetable');
  if (modal) modal.classList.add('hidden');
}

function _updateTimetableDayTabs() {
  document.querySelectorAll('.tt-day-btn').forEach(btn => {
    const day = btn.getAttribute('data-day');
    if (day === currentTimetableDay) {
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
    const data = await API.getTimetable(selectedClass === 'all' ? '' : selectedClass, currentTimetableDay);
    const slots = data.slots || data || [];

    if (slots.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-xs text-[var(--text-sub)]">
          <svg class="w-10 h-10 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          No slots for ${escapeHtml(currentTimetableDay)}${selectedClass !== 'all' ? ' · ' + escapeHtml(selectedClass) : ''}. Add one!
        </div>`;
      return;
    }

    container.innerHTML = slots.map(slot => {
      const editDelBtns = canUserEditDelete() ? `
        <div class="flex gap-1 flex-shrink-0">
          <button onclick="openAddTimetableSlotModal('${escapeHtml(String(slot._id))}')" title="Edit Slot" class="w-7 h-7 rounded-lg bg-[var(--bg-page)] text-[var(--text-sub)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition border border-[var(--border-color)]">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button onclick="deleteTimetableSlot('${escapeHtml(String(slot._id))}')" title="Delete Slot" class="w-7 h-7 rounded-lg btn-delete flex items-center justify-center transition">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>` : '';

      return `
        <div class="bg-[var(--bg-page)] p-3 rounded-2xl border border-[var(--border-color)] flex items-center justify-between gap-3 hover:border-[#245b70] transition shadow-sm">
          <div class="flex items-center gap-3 min-w-0">
            <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-[#245b70]/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-[#245b70] dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div class="min-w-0 space-y-0.5">
              <p class="font-extrabold text-xs text-[var(--text-main)]">${escapeHtml(slot.timeSlot || slot.time || '')}</p>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">${escapeHtml(slot.subject || '')}</span>
                <span class="px-2 py-0.5 rounded-lg bg-[#245b70]/10 text-[#245b70] dark:text-cyan-300 font-bold text-[10px]">${escapeHtml(slot.class || '')}</span>
                ${slot.teacher ? `<span class="text-[10px] text-[var(--text-sub)] font-semibold">· ${escapeHtml(slot.teacher)}</span>` : ''}
                ${slot.room ? `<span class="text-[10px] text-[var(--text-sub)]">· ${escapeHtml(slot.room)}</span>` : ''}
              </div>
            </div>
          </div>
          ${editDelBtns}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-6">Failed to load timetable: ${escapeHtml(err.message)}</div>`;
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

  // Populate day dropdown
  const daySelect = document.getElementById('slot-input-day');
  if (daySelect) {
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    daySelect.innerHTML = days.map(d => `<option value="${d}" ${d === currentTimetableDay ? 'selected' : ''}>${d}</option>`).join('');
  }

  // Populate class dropdown
  const classSelect = document.getElementById('slot-input-class');
  if (classSelect) {
    classSelect.innerHTML = `<option value="">Select class…</option>` +
      classesList.map(c => `<option value="${escapeHtml(c.name || c)}">${escapeHtml(c.name || c)}</option>`).join('');
  }

  // Populate subject dropdown
  const subjectSelect = document.getElementById('slot-input-subject');
  if (subjectSelect) {
    subjectSelect.innerHTML = `<option value="">Select subject…</option>` +
      subjectsList.map(s => `<option value="${escapeHtml(s.name || s)}">${escapeHtml(s.name || s)}</option>`).join('');
  }

  // Populate teacher dropdown
  const teacherSelect = document.getElementById('slot-input-teacher');
  if (teacherSelect) {
    teacherSelect.innerHTML = `<option value="">Select teacher (optional)…</option>` +
      (cachedTeachersList || []).map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('');
  }

  // If editing, pre-fill values
  if (slotId) {
    try {
      const data = await API.getTimetable('', '');
      const slots = data.slots || data || [];
      const slot = slots.find(s => String(s._id) === String(slotId));
      if (slot) {
        if (daySelect) daySelect.value = slot.day || currentTimetableDay;
        const timeInput = document.getElementById('slot-input-time');
        if (timeInput) timeInput.value = slot.timeSlot || slot.time || '';
        if (classSelect) classSelect.value = slot.class || '';
        if (subjectSelect) subjectSelect.value = slot.subject || '';
        if (teacherSelect) teacherSelect.value = slot.teacher || '';
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

  const slotData = {
    day: (document.getElementById('slot-input-day') || {}).value || '',
    timeSlot: (document.getElementById('slot-input-time') || {}).value || '',
    class: (document.getElementById('slot-input-class') || {}).value || '',
    subject: (document.getElementById('slot-input-subject') || {}).value || '',
    teacher: (document.getElementById('slot-input-teacher') || {}).value || '',
    room: (document.getElementById('slot-input-room') || {}).value || '',
  };

  if (!slotData.day || !slotData.timeSlot || !slotData.class || !slotData.subject) {
    showToast('Day, Time, Class and Subject are required.', true);
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    if (slotId) {
      await API.updateTimetableSlot(slotId, slotData);
      showToast('Timetable slot updated!');
    } else {
      await API.createTimetableSlot(slotData);
      showToast('Timetable slot added!');
    }
    closeAddTimetableSlotModal();
    // update day to match what was saved
    currentTimetableDay = slotData.day;
    _updateTimetableDayTabs();
    await renderTimetableSlots();
  } catch (err) {
    showToast('Failed to save slot: ' + err.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = slotId ? 'Save Changes' : 'Add Slot'; }
  }
}

async function deleteTimetableSlot(id) {
  if (!confirm('Delete this timetable slot?')) return;
  try {
    await API.deleteTimetableSlot(id);
    showToast('Slot deleted.');
    await renderTimetableSlots();
  } catch (err) {
    showToast('Failed to delete slot: ' + err.message, true);
  }
}
