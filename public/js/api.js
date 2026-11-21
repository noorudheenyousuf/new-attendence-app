// API Client for REGISTERLY Full-Stack Backend
const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('registerly_token');
  },

  setToken(token) {
    if (token) localStorage.setItem('registerly_token', token);
    else localStorage.removeItem('registerly_token');
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }
      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error);
      throw error;
    }
  },

  // Auth Endpoints
  async register(name, email, password, extra = {}) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, ...extra })
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  async login(email, password, extra = {}) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...extra })
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  async requestForgotPasswordOtp(phone, identifier = '') {
    return this.request('/auth/forgot-password/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, identifier })
    });
  },

  async resetPasswordWithOtp(phone, identifier, otp, newPassword) {
    return this.request('/auth/forgot-password/reset-password', {
      method: 'POST',
      body: JSON.stringify({ phone, identifier, otp, newPassword })
    });
  },

  async getNextStudentRoll(className) {
    const params = new URLSearchParams({ class: className });
    return this.request(`/student-portal/next-roll?${params.toString()}`);
  },

  async getGoogleClientId() {
    return this.request('/auth/google-client-id');
  },

  async googleLogin(payload) {
    const body = typeof payload === 'string' ? { credential: payload } : payload;
    const res = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async updateProfile(dataOrName, avatarUrl, phone) {
    const payload = (typeof dataOrName === 'object' && dataOrName !== null)
      ? dataOrName
      : { name: dataOrName, avatarUrl, phone };
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // Storage & Photo Upload (External Cloudinary / Local Fallback)
  async uploadPhoto(fileOrBlob, folder = 'students') {
    const formData = new FormData();
    formData.append('photo', fileOrBlob);
    formData.append('folder', folder);

    const token = this.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${this.baseUrl}/upload/photo`, {
      method: 'POST',
      headers,
      body: formData
    });
    return res.json();
  },

  async getUploadStatus() {
    return this.request('/upload/status');
  },

  // Classes
  async getClasses() {
    return this.request('/classes');
  },

  async reorderClasses(orderedIds) {
    return this.request('/classes/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds })
    });
  },

  async addClass(name, classTeacher, assignedSubjects = [], classTeacherEmail = '') {
    return this.request('/classes', {
      method: 'POST',
      body: JSON.stringify({ name, classTeacher, assignedSubjects, classTeacherEmail })
    });
  },

  async updateClass(id, name, classTeacher, assignedSubjects = [], classTeacherEmail = '') {
    return this.request(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, classTeacher, assignedSubjects, classTeacherEmail })
    });
  },

  async deleteClass(id) {
    return this.request(`/classes/${id}`, {
      method: 'DELETE'
    });
  },

  // Subjects
  async getSubjects() {
    return this.request('/subjects');
  },

  async reorderSubjects(orderedIds) {
    return this.request('/subjects/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds })
    });
  },

  async addSubject(data) {
    return this.request('/subjects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateSubject(id, data) {
    return this.request(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteSubject(id) {
    return this.request(`/subjects/${id}`, {
      method: 'DELETE'
    });
  },

  // Students
  async getStudents(classFilter = 'all', search = '') {
    const params = new URLSearchParams();
    if (classFilter && classFilter !== 'all') params.append('class', classFilter);
    if (search) params.append('search', search);
    return this.request(`/students?${params.toString()}`);
  },

  async getNextStudentId() {
    return this.request('/students/next-id');
  },

  async addStudent(data) {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateStudent(id, data) {
    return this.request(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteStudent(id) {
    return this.request(`/students/${id}`, {
      method: 'DELETE'
    });
  },

  async getStudentById(id) {
    return this.request(`/students/${encodeURIComponent(id)}`);
  },

  async addStudentRemark(studentId, text, subject = '') {
    return this.request(`/students/${encodeURIComponent(studentId)}/remarks`, {
      method: 'POST',
      body: JSON.stringify({ text, subject })
    });
  },

  async editStudentRemark(studentId, remarkId, text) {
    return this.request(`/students/${encodeURIComponent(studentId)}/remarks/${encodeURIComponent(remarkId)}`, {
      method: 'PUT',
      body: JSON.stringify({ text })
    });
  },

  async deleteStudentRemark(studentId, remarkId) {
    return this.request(`/students/${encodeURIComponent(studentId)}/remarks/${encodeURIComponent(remarkId)}`, {
      method: 'DELETE'
    });
  },

  // Attendance
  async getAttendance(date, className, subject) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (className && className !== 'undefined' && className !== 'null') {
      params.append('class', className);
    }
    if (subject && subject !== 'undefined' && subject !== 'null') {
      params.append('subject', subject);
    }
    const query = params.toString();
    return this.request(`/attendance${query ? `?${query}` : ''}`);
  },

  async saveAttendance(data) {
    return this.request('/attendance', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteAttendance(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/attendance?${query}`, {
      method: 'DELETE'
    });
  },

  // Reports
  async getClassReport(className, year = 'all', period = 'all-year', subject = 'whole') {
    const params = new URLSearchParams({ class: className, year, period, subject });
    return this.request(`/reports/class?${params.toString()}`);
  },

  async getStudentLogs(studentId) {
    return this.request(`/reports/student-logs/${studentId}`);
  },

  // Admin
  async getAdminSettings() {
    return this.request('/admin/settings');
  },

  async updateAdminSettings(appName, schoolName, extra = {}) {
    let payload = {};
    if (typeof appName === 'object' && appName !== null) {
      payload = appName;
    } else {
      payload = { appName, schoolName, ...extra };
    }
    return this.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // Teachers API
  async getTeachers(year, classFilter) {
    let url = '/teachers';
    const params = new URLSearchParams();
    if (year && year !== 'all') params.append('year', year);
    if (classFilter && classFilter !== 'all') params.append('class', classFilter);
    const qs = params.toString();
    return this.request(qs ? `${url}?${qs}` : url);
  },

  async getTeacherById(id) {
    return this.request(`/teachers/${id}`);
  },

  async getTeacherLogs(id, year, classFilter) {
    let url = `/teachers/${id}/logs`;
    const params = new URLSearchParams();
    if (year && year !== 'all') params.append('year', year);
    if (classFilter && classFilter !== 'all') params.append('class', classFilter);
    const qs = params.toString();
    return this.request(qs ? `${url}?${qs}` : url);
  },

  async addTeacher(teacherData) {
    const body = (typeof teacherData === 'object' && teacherData !== null)
      ? teacherData
      : { name: arguments[0], email: arguments[1], password: arguments[2] };
    return this.request('/teachers', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  async editTeacher(id, updateData) {
    const body = (typeof updateData === 'object' && updateData !== null)
      ? updateData
      : { name: updateData };
    return this.request(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  async makeTeacherAdmin(id) {
    return this.request(`/admin/teachers/${id}/toggle-admin`, {
      method: 'PUT'
    });
  },

  async toggleTeacherAdmin(id) {
    return this.request(`/admin/teachers/${id}/toggle-admin`, {
      method: 'PUT'
    });
  },

  async reorderTeachers(orderedIds) {
    return this.request('/teachers/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds })
    });
  },

  async deleteTeacher(id) {
    return this.request(`/teachers/${id}`, {
      method: 'DELETE'
    });
  },

  async clearData() {
    return this.request('/admin/clear-data', {
      method: 'POST'
    });
  },

  async resetApp() {
    return this.request('/admin/reset-app', {
      method: 'POST'
    });
  },

  // Backup (Admin Only)
  async importBackup(data) {
    return this.request('/backup/import', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Logs
  async getLogs() {
    return this.request('/logs');
  },

  async undoLog(logId) {
    return this.request(`/logs/${logId}/undo`, {
      method: 'POST'
    });
  },

  // Edit / Delete button access toggle (Admin only)
  async toggleEditDeleteAccess(enabled) {
    return this.request('/admin/toggle-edit-delete-access', {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
  },

  // Student Details Print/Export access toggle (Admin only)
  async toggleStudentPrintAccess(enabled) {
    return this.request('/admin/toggle-student-print-access', {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
  },

  // Student Form Builder / Custom Fields Configuration
  async saveStudentFormFields(fields) {
    return this.request('/admin/student-fields', {
      method: 'PUT',
      body: JSON.stringify({ fields })
    });
  },

  // Messages API (Notifications & Teacher Broadcast)
  async getMessages() {
    return this.request('/messages');
  },

  async sendMessage(text) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  async editMessage(id, text) {
    return this.request(`/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ text })
    });
  },

  async deleteMessage(id) {
    return this.request(`/messages/${id}`, {
      method: 'DELETE'
    });
  },

  async clearAllMessages() {
    return this.request('/messages', {
      method: 'DELETE'
    });
  },

  async markMessagesRead() {
    return this.request('/messages/mark-read', {
      method: 'POST'
    });
  },

  // Timetable API (strictly mapped to teacher email)
  async getTimetable(className, day, teacherEmail) {
    let url = '/timetable';
    const params = new URLSearchParams();
    if (className && className !== 'all') params.append('class', className);
    if (day && day !== 'all') params.append('day', day);
    let finalEmail = teacherEmail;
    if (arguments.length >= 4 && arguments[3]) {
      finalEmail = arguments[3];
    }
    if (finalEmail && finalEmail !== 'all' && finalEmail.includes('@')) {
      params.append('teacherEmail', finalEmail.trim().toLowerCase());
    }
    const qs = params.toString();
    return this.request(qs ? `${url}?${qs}` : url);
  },

  async createTimetableSlot(slotData) {
    return this.request('/timetable', {
      method: 'POST',
      body: JSON.stringify(slotData)
    });
  },

  async updateTimetableSlot(id, slotData) {
    return this.request(`/timetable/${id}`, {
      method: 'PUT',
      body: JSON.stringify(slotData)
    });
  },

  async reorderTimetable(orderedIds) {
    return this.request('/timetable/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds })
    });
  },

  async deleteTimetableSlot(id) {
    return this.request(`/timetable/${id}`, {
      method: 'DELETE'
    });
  },


  // Change Password API
  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  // ===================== PERSONAL WORKSPACE (Private Corner) API =====================

  async getPrivateClasses() {
    return this.request('/classes?scope=private');
  },

  async addPrivateClass(name, classTeacher, assignedSubjects = []) {
    return this.request('/classes', {
      method: 'POST',
      body: JSON.stringify({ name, classTeacher, assignedSubjects, isPrivate: true })
    });
  },

  async getPrivateSubjects() {
    return this.request('/subjects?scope=private');
  },

  async addPrivateSubject(data) {
    return this.request('/subjects', {
      method: 'POST',
      body: JSON.stringify({ ...data, isPrivate: true })
    });
  },

  async getPrivateStudents(classFilter = 'all', search = '') {
    const params = new URLSearchParams({ scope: 'private' });
    if (classFilter && classFilter !== 'all') params.append('class', classFilter);
    if (search) params.append('search', search);
    return this.request(`/students?${params.toString()}`);
  },

  async getPublicStudents(classFilter = 'all') {
    const params = new URLSearchParams({ scope: 'public' });
    if (classFilter && classFilter !== 'all') params.append('class', classFilter);
    return this.request(`/students?${params.toString()}`);
  },

  async getNextPrivateStudentId() {
    return this.request('/students/next-id?scope=private');
  },

  async addPrivateStudent(data) {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify({ ...data, isPrivate: true })
    });
  },

  // ===================== STUDENT PORTAL API =====================
  async getStudentPortalMe() {
    return this.request('/student-portal/me');
  },

  async submitStudentDetails(data) {
    return this.request('/student-portal/submit-details', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async linkExistingStudentProfile(data) {
    return this.request('/student-portal/link-existing', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getStudentAppAccess(studentId) {
    return this.request(`/students/${encodeURIComponent(studentId)}/app-access`);
  },

  async generateStudentConnectCode(studentObjId) {
    return this.request(`/students/${encodeURIComponent(studentObjId)}/generate-connect-code`, {
      method: 'POST'
    });
  },

  async linkStudentToUser(studentObjId, userId) {
    return this.request(`/students/${encodeURIComponent(studentObjId)}/link-user`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async unlinkStudentFromUser(studentObjId) {
    return this.request(`/students/${encodeURIComponent(studentObjId)}/unlink-user`, {
      method: 'POST'
    });
  },

  async mergeOutcomerIntoStudent(outcomerId, targetStudentId) {
    return this.request(`/students/outcomers/${encodeURIComponent(outcomerId)}/merge-into/${encodeURIComponent(targetStudentId)}`, {
      method: 'POST'
    });
  },

  async updateStudentDetails(data) {
    return this.request('/student-portal/update-details', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getStudentTimetable(day = 'all') {
    const params = new URLSearchParams();
    if (day && day !== 'all') params.append('day', day);
    return this.request(`/student-portal/timetable?${params.toString()}`);
  },

  async getStudentAnnouncements() {
    return this.request('/student-portal/announcements');
  },

  // --- Announcements & Events (Admin CRUD + Public/Teacher Read) ---
  async getAnnouncements() {
    return this.request('/announcements');
  },

  async createAnnouncement(data) {
    return this.request('/announcements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateAnnouncement(id, data) {
    return this.request(`/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteAnnouncement(id) {
    return this.request(`/announcements/${id}`, {
      method: 'DELETE'
    });
  },

  async getEvents(upcoming = false) {
    return this.request(`/events${upcoming ? '?upcoming=true' : ''}`);
  },

  async createEvent(data) {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateEvent(id, data) {
    return this.request(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteEvent(id) {
    return this.request(`/events/${id}`, {
      method: 'DELETE'
    });
  },

  async getStudentAttendance() {
    return this.request('/student-portal/attendance');
  },

  async getStudentDashboard() {
    return this.request('/student-portal/dashboard');
  },

  async getStudentSubjects() {
    return this.request('/student-portal/subjects');
  },

  async getStudentAttendanceCalendar(year, month) {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    return this.request(`/student-portal/attendance-calendar?${params.toString()}`);
  },

  async getStudentLeaveRequests() {
    return this.request('/student-portal/leave-requests');
  },

  async submitStudentLeaveRequest(data) {
    return this.request('/student-portal/leave-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getStudentMaterials() {
    return this.request('/student-portal/materials');
  },

  async getStudentExamResults() {
    return this.request('/student-portal/exam-results');
  },

  async changeStudentPassword(data) {
    return this.request('/student-portal/change-password', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // ===================== OUTCOMERS API (Teacher Review & Enrollment) =====================
  async getOutcomers(status = 'pending') {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    return this.request(`/students/outcomers?${params.toString()}`);
  },

  async approveOutcomer(id, data = {}) {
    return this.request(`/students/outcomers/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async rejectOutcomer(id, permanent = false) {
    const qs = permanent ? '?permanent=true' : '';
    return this.request(`/students/outcomers/${id}/reject${qs}`, {
      method: 'DELETE'
    });
  },

  // ===================== ACADEMIC YEAR, PROMOTION & ARCHIVE API =====================
  async getPromotionOverview(scope = 'public') {
    const params = new URLSearchParams({ scope });
    return this.request(`/promotion/overview?${params.toString()}`);
  },

  async previewPromotion(payload) {
    return this.request('/promotion/preview', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async executePromotion(payload) {
    return this.request('/promotion/execute', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async undoPromotion(batchId) {
    return this.request(`/promotion/undo/${encodeURIComponent(batchId)}`, {
      method: 'POST'
    });
  },

  async reorderClassRolls(payload) {
    return this.request('/promotion/reorder-rolls', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getPromotionDirectory(params = {}) {
    const qs = new URLSearchParams();
    if (params.type) qs.append('type', params.type);
    if (params.year && params.year !== 'all') qs.append('year', params.year);
    if (params.lastClass && params.lastClass !== 'all') qs.append('lastClass', params.lastClass);
    if (params.search) qs.append('search', params.search);
    if (params.scope) qs.append('scope', params.scope);
    return this.request(`/promotion/directory?${qs.toString()}`);
  },

  async readmitStudent(id, payload = {}) {
    return this.request(`/promotion/readmit/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async cleanupYearAttendance(payload = {}) {
    return this.request('/backup/cleanup-year', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
