// Main Application Controller for REGISTERLY
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
let currentSubject = 'all';

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  initServiceWorker();
  await loadCurrentUser();
  await loadAppSettings();
  await loadClasses();
  await loadSubjects();
  await loadAttendanceRoster();
  await loadReport();
  await loadActivityLogs();
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
  try {
    const res = await API.getMe();
    if (res.success && res.user) {
      currentUser = res.user;
      currentRole = currentUser.role;
      updateUserUI();
    }
  } catch (error) {
    // If not logged in yet, try default admin
    currentUser = {
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@stxavier.edu',
      role: 'admin',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
    };
    currentRole = 'admin';
    updateUserUI();
  }
}

function updateUserUI() {
  if (!currentUser) return;

  // Header Profile
  const headerName = document.getElementById('header-profile-name');
  const headerRole = document.getElementById('header-profile-role');
  const headerAvatar = document.getElementById('user-avatar-img');
  if (headerName) headerName.innerText = currentUser.name;
  if (headerRole) headerRole.innerText = currentUser.role === 'admin' ? 'Admin' : 'Teacher';
  if (headerAvatar) headerAvatar.src = currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face';

  // Settings Card
  const settingsName = document.getElementById('settings-name-display');
  const settingsEmail = document.getElementById('settings-email-display');
  const settingsRole = document.getElementById('settings-role-badge');
  const settingsAvatar = document.getElementById('settings-avatar-img');
  if (settingsName) settingsName.innerText = currentUser.name;
  if (settingsEmail) settingsEmail.innerText = currentUser.email;
  if (settingsRole) settingsRole.innerText = currentUser.role === 'admin' ? 'Admin (First Account)' : 'Teacher';
  if (settingsAvatar) settingsAvatar.src = currentUser.avatarUrl;

  // Visibility based on Role:
  // USER DIRECTIVE: "other acounts show in setting only profile div and activity logs , sign out"
  const adminSection = document.getElementById('admin-settings-section');
  if (adminSection) {
    if (currentUser.role === 'admin') {
      adminSection.classList.remove('hidden');
    } else {
      adminSection.classList.add('hidden');
    }
  }

  // Reload activity logs to show/hide Undo button based on role
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
}

// ================= APP SETTINGS (App Name & School Name) =================
async function loadAppSettings() {
  try {
    const res = await API.getAdminSettings();
    if (res.success && res.data) {
      const appNameEl = document.getElementById('header-app-name');
      const schoolNameEl = document.getElementById('school-name-display');
      const adminAppInput = document.getElementById('admin-input-app-name');
      const adminSchoolInput = document.getElementById('admin-input-school-name');

      if (appNameEl) appNameEl.innerText = res.data.appName || 'REGISTERLY';
      if (schoolNameEl) schoolNameEl.innerText = res.data.schoolName || '';
      if (adminAppInput) adminAppInput.value = res.data.appName || 'REGISTERLY';
      if (adminSchoolInput) adminSchoolInput.value = res.data.schoolName || '';
    }
  } catch (error) {
    console.log('[Settings Load]', error);
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
}

function renderClassesList() {
  const container = document.getElementById('class-cards-container');
  if (!container) return;

  if (classesList.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No classes added yet. Click "Add Class" to create one.</div>`;
    return;
  }

  container.innerHTML = classesList.map(c => `
    <div class="bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl text-white font-black text-sm flex items-center justify-center custom-gradient-header flex-shrink-0">
          ${c.name.replace(/[^0-9]/g, '') || c.name.slice(0, 3)}
        </div>
        <div>
          <h3 class="font-bold text-[var(--text-main)] text-sm">${c.name}</h3>
          <p class="text-xs text-[var(--text-sub)]">Class Teacher: ${c.classTeacher}</p>
        </div>
      </div>
      <button onclick="deleteClass('${c._id}', '${c.name}')" title="Delete Class" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center transition">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
  `).join('');
}

async function handleSaveClass(e) {
  e.preventDefault();
  const name = document.getElementById('input-class-name').value.trim();
  const classTeacher = document.getElementById('input-class-teacher').value.trim();
  try {
    const res = await API.addClass(name, classTeacher);
    if (res.success) {
      showToast(`Class "${name}" added!`);
      closeClassModal();
      document.getElementById('input-class-name').value = '';
      document.getElementById('input-class-teacher').value = '';
      await loadClasses();
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

function populateSubjectDropdowns() {
  const selSubject = document.getElementById('sel-subject');
  const repSubject = document.getElementById('report-subject');

  // USER DIRECTIVE: "only show main name in filters not in the bracket"
  const optionsHtml = subjectsList.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  if (selSubject) {
    selSubject.innerHTML = `<option value="all">All Subjects</option>` + optionsHtml;
  }
  if (repSubject) {
    repSubject.innerHTML = `<option value="whole">All Subjects</option>` + optionsHtml;
  }
}

function renderSubjectsList() {
  const container = document.getElementById('subject-cards-container');
  if (!container) return;

  if (subjectsList.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No subjects added yet.</div>`;
    return;
  }

  container.innerHTML = subjectsList.map(s => `
    <div class="bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-[var(--text-main)] text-sm">${s.name}</h3>
          <span class="text-[10px] font-black px-1.5 py-0.2 rounded bg-[#245b70]/10 text-[#245b70]">${s.subjectCode}</span>
        </div>
        ${s.teacher ? `<p class="text-xs text-[var(--text-sub)] mt-0.5">Teacher: ${s.teacher}</p>` : ''}
        <div class="text-[11px] text-[#245b70] font-semibold mt-0.5">Classes: ${s.assignedClasses.join(', ') || 'None'}</div>
      </div>
      <div class="flex items-center gap-1.5">
        <button onclick="openEditSubjectModal('${s._id}', '${s.name}', '${s.subjectCode}', '${s.teacher || ''}', '${s.assignedClasses.join(', ')}')" title="Edit Subject" class="w-8 h-8 rounded-xl bg-[var(--bg-page)] text-[var(--text-main)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button onclick="deleteSubject('${s._id}', '${s.name}')" title="Delete Subject" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `).join('');
}

async function handleSaveSubject(e) {
  e.preventDefault();
  const name = document.getElementById('input-sub-name').value.trim();
  const subjectCode = document.getElementById('input-sub-code').value.trim();
  const teacher = document.getElementById('input-sub-teacher').value.trim();
  const assignedClasses = document.getElementById('input-sub-classes').value.trim();

  try {
    const res = await API.addSubject({ name, subjectCode, teacher, assignedClasses });
    if (res.success) {
      showToast(`Subject "${name}" added!`);
      closeSubjectModal();
      document.getElementById('input-sub-name').value = '';
      document.getElementById('input-sub-code').value = '';
      document.getElementById('input-sub-teacher').value = '';
      document.getElementById('input-sub-classes').value = '';
      await loadSubjects();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

let activeEditSubjectId = null;
function openEditSubjectModal(id, name, code, teacher, classes) {
  activeEditSubjectId = id;
  document.getElementById('edit-sub-name').value = name;
  document.getElementById('edit-sub-code').value = code;
  document.getElementById('edit-sub-teacher').value = teacher;
  document.getElementById('edit-sub-classes').value = classes;
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
  const teacher = document.getElementById('edit-sub-teacher').value.trim();
  const assignedClasses = document.getElementById('edit-sub-classes').value.trim();

  try {
    const res = await API.updateSubject(activeEditSubjectId, { name, subjectCode, teacher, assignedClasses });
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

    if (attRes.success && attRes.data && Array.isArray(attRes.data.records)) {
      attendanceRecords = attRes.data.records;
    } else {
      // Default to Present
      attendanceRecords = studentsList.map(st => ({
        studentId: st.studentId,
        status: 'P',
        note: ''
      }));
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
        <!-- Student Info: Photo & Name ONLY (No ID and No Roll) -->
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative flex-shrink-0">
            <img src="${st.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face'}" alt="${st.name}" class="w-11 h-11 rounded-xl object-cover border border-[var(--border-color)]">
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
      showToast('Attendance saved & logged successfully!');
      await loadActivityLogs();
      await loadReport();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

function changeDate(delta) {
  const d = new Date(currentDateStr);
  d.setDate(d.getDate() + delta);
  currentDateStr = d.toISOString().slice(0, 10);

  const displayEl = document.getElementById('current-date');
  const dayEl = document.getElementById('current-day');
  if (displayEl) displayEl.innerText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (dayEl) {
    const todayStr = new Date().toISOString().slice(0, 10);
    dayEl.innerText = currentDateStr === todayStr ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
  }

  loadAttendanceRoster();
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
  const repPeriodEl = document.getElementById('report-period');
  const repSubEl = document.getElementById('report-subject');

  const repClass = repClassEl ? repClassEl.value : (currentClass || 'Class 10');
  const repPeriod = repPeriodEl ? repPeriodEl.value : 'all-year';
  const repSubject = repSubEl ? repSubEl.value : 'whole';

  try {
    const res = await API.getClassReport(repClass, repPeriod, repSubject);
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
    tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-xs text-[var(--text-sub)]">No attendance records found for this selection.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td class="py-2.5 px-2">
        <!-- Roll No with rounded square border solid background -->
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#245b70] text-white font-black text-xs shadow-sm">
          ${row.roll}
        </span>
      </td>
      <td class="py-2.5 px-2 font-bold">
        <div class="flex items-center gap-2">
          <img src="${row.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=60&h=60&fit=crop&crop=face'}" class="w-7 h-7 rounded-lg object-cover">
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
      <td class="py-2.5 px-2 text-center no-print">
        <!-- Action: Button named "Log" -->
        <button onclick="openStudentLogModal(${row.studentId}, '${row.name}', ${row.roll})" class="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#245b70]/10 hover:bg-[#245b70] hover:text-white text-[#245b70] transition shadow-sm">
          Log
        </button>
      </td>
    </tr>
  `).join('');
}

// Student Log Modal (When clicking "Log")
async function openStudentLogModal(studentId, name, roll) {
  document.getElementById('log-modal-title').innerText = `Attendance Logs - ${name}`;
  document.getElementById('log-modal-subtitle').innerText = `Roll #${roll} • ID: ${studentId}`;
  const listContainer = document.getElementById('student-logs-list');
  if (listContainer) listContainer.innerHTML = `<div class="p-3 text-xs text-center">Loading logs...</div>`;

  document.getElementById('modal-student-log').classList.remove('hidden');

  try {
    const res = await API.getStudentLogs(studentId);
    if (res.success && res.logs) {
      if (res.logs.length === 0) {
        listContainer.innerHTML = `<div class="p-3 text-xs text-center text-[var(--text-sub)]">No attendance sessions recorded yet.</div>`;
        return;
      }

      listContainer.innerHTML = res.logs.map(log => `
        <div class="p-2.5 rounded-xl bg-[var(--bg-page)] flex items-center justify-between text-xs border border-[var(--border-color)]">
          <div>
            <div class="font-bold text-[var(--text-main)]">${log.date}</div>
            <div class="text-[10px] text-[var(--text-sub)]">${log.period} ${log.note ? '• ' + log.note : ''}</div>
          </div>
          <span class="px-2.5 py-0.5 rounded-md font-black text-xs ${
            log.status === 'P' ? 'bg-emerald-100 text-emerald-800' :
            log.status === 'A' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
          }">${log.statusText}</span>
        </div>
      `).join('');
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
// "add class filter in add students, and when update student show the all inputs to edit"
// "add edit and delete to students"
async function renderStudentsDirectory() {
  const container = document.getElementById('student-directory-cards');
  const classFilterEl = document.getElementById('student-class-filter');
  const filterClass = classFilterEl ? classFilterEl.value : 'all';

  try {
    const res = await API.getStudents(filterClass);
    if (res.success) {
      const students = res.data;
      if (!container) return;

      if (students.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-sub)]">No students found.</div>`;
        return;
      }

      container.innerHTML = students.map(st => `
        <div id="student-card-${st.studentId}" class="bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--border-color)] shadow-sm space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5 min-w-0">
              <img src="${st.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face'}" class="w-11 h-11 rounded-xl object-cover border border-[var(--border-color)] flex-shrink-0">
              <div class="truncate">
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-[var(--text-main)] text-sm truncate">${st.name}</span>
                  <span class="text-[10px] font-black bg-[#245b70]/10 text-[#245b70] px-1.5 py-0.2 rounded flex-shrink-0">ID: ${st.studentId}</span>
                </div>
                <p class="text-xs text-[var(--text-sub)] truncate">${st.class} • Roll: ${st.roll}</p>
              </div>
            </div>

            <!-- Edit and Delete Buttons -->
            <div class="flex items-center gap-1 flex-shrink-0">
              <button onclick="openEditStudentModal('${st._id}')" title="Edit Student (All fields)" class="w-8 h-8 rounded-xl bg-[var(--bg-page)] text-[var(--text-main)] hover:bg-[#245b70] hover:text-white flex items-center justify-center transition">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button onclick="confirmDeleteStudent('${st._id}', '${st.name}', ${st.studentId})" title="Delete Student" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center transition">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.log('[Students Directory Load]', error);
  }
}

// Add Student Modal (Auto Student ID starting at 2000, read-only)
async function openStudentModal() {
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
  const admissionStatus = document.getElementById('new-student-admission').value;
  const rank = document.getElementById('new-student-rank').value.trim();
  const previousCollege = document.getElementById('new-student-college').value.trim();

  const payload = {
    name,
    class: studentClass,
    roll,
    address: { fullAddress, place, district, state },
    familyDetails: { fatherName, motherName, fatherMobile, fatherWhatsapp },
    academicStatus: { admissionStatus, rank, previousCollege }
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

    document.getElementById('edit-student-modal-title').innerText = `Edit Student: ${student.name}`;
    document.getElementById('edit-student-id').value = student.studentId;
    document.getElementById('edit-preview-photo').src = student.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face';
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
    document.getElementById('edit-student-admission').value = (student.academicStatus && student.academicStatus.admissionStatus) || 'Confirmed';
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
  const admissionStatus = document.getElementById('edit-student-admission').value;
  const rank = document.getElementById('edit-student-rank').value.trim();
  const previousCollege = document.getElementById('edit-student-college').value.trim();

  const payload = {
    name,
    class: studentClass,
    roll,
    address: { fullAddress, place, district, state },
    familyDetails: { fatherName, motherName, fatherMobile, fatherWhatsapp },
    academicStatus: { admissionStatus, rank, previousCollege }
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
      container.innerHTML = teachers.map(t => `
        <div class="p-2.5 bg-white dark:bg-slate-900 rounded-xl border flex items-center justify-between">
          <div>
            <div class="font-bold text-[var(--text-main)] text-xs">
              ${t.name}
              ${t.role === 'admin' ? '<span class="text-[9px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded ml-1">Admin</span>' : '<span class="text-[9px] font-bold text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded ml-1">Teacher</span>'}
            </div>
            <div class="text-[10px] text-[var(--text-sub)]">${t.email}</div>
          </div>
          <div class="flex items-center gap-1.5">
            ${t.role !== 'admin' ? `
              <button onclick="makeTeacherAdmin('${t._id}', '${t.name}')" class="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#245b70] text-white">
                Make Admin
              </button>
            ` : '<span class="text-xs font-bold text-emerald-600">Active Admin</span>'}
            <button onclick="editTeacherName('${t._id}', '${t.name}')" class="px-2 py-1 rounded-lg text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              Edit
            </button>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.log('[Teachers Load]', error);
  }
}

async function makeTeacherAdmin(id, name) {
  try {
    const res = await API.makeTeacherAdmin(id);
    if (res.success) {
      showToast(`${name} is now an Admin!`);
      await loadAdminTeachersList();
    }
  } catch (error) {
    showToast(error.message, true);
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
function exportBackupData() {
  window.location.href = '/api/backup/export';
  showToast('Admin: Database Backup downloading...');
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

// Signout
function handleSignout() {
  API.setToken(null);
  showToast('Signed out successfully');
  openAuthModal();
}

// ================= TAB NAVIGATION =================
function selectTopTab(tab) {
  ['attendance', 'report', 'settings', 'classes', 'subjects', 'students'].forEach(v => {
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

  ['classes', 'subjects', 'students'].forEach(t => {
    const btn = document.getElementById(`bottom-tab-${t}`);
    if (btn) btn.className = "flex-1 flex flex-col items-center justify-center py-1 text-[var(--text-sub)] hover:text-[#245b70] font-medium tab-transition";
  });

  if (tab === 'report') loadReport();
  if (tab === 'settings') loadActivityLogs();
}

function selectBottomTab(tab) {
  ['attendance', 'report', 'settings', 'classes', 'subjects', 'students'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`view-${tab}`);
  if (activeEl) activeEl.classList.remove('hidden');

  ['classes', 'subjects', 'students'].forEach(t => {
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
}

// Modal triggers
function openClassModal() { document.getElementById('modal-add-class').classList.remove('hidden'); }
function closeClassModal() { document.getElementById('modal-add-class').classList.add('hidden'); }
function openSubjectModal() { document.getElementById('modal-add-subject').classList.remove('hidden'); }
function closeSubjectModal() { document.getElementById('modal-add-subject').classList.add('hidden'); }
function openAuthModal() { document.getElementById('auth-modal').classList.remove('hidden'); }
function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }

async function handleEmailLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    const res = await API.login(email, password);
    if (res.success) {
      showToast('Logged in successfully!');
      closeAuthModal();
      await loadCurrentUser();
      await loadAttendanceRoster();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

async function fakeGoogleLogin() {
  try {
    const res = await API.googleLogin('Sarah Jenkins', 'sarah.jenkins@stxavier.edu');
    if (res.success) {
      showToast('Signed in with Google');
      closeAuthModal();
      await loadCurrentUser();
      await loadAttendanceRoster();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}
