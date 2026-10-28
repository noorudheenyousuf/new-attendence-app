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
  async register(name, email, password) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token) this.setToken(res.token);
    return res;
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

  async updateProfile(name, avatarUrl) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, avatarUrl })
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

  async addClass(name, classTeacher, assignedSubjects = []) {
    return this.request('/classes', {
      method: 'POST',
      body: JSON.stringify({ name, classTeacher, assignedSubjects })
    });
  },

  async updateClass(id, name, classTeacher, assignedSubjects = []) {
    return this.request(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, classTeacher, assignedSubjects })
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

  // Attendance
  async getAttendance(date, className, subject = 'all') {
    const params = new URLSearchParams({ date, class: className, subject });
    return this.request(`/attendance?${params.toString()}`);
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

  async updateAdminSettings(appName, schoolName) {
    return this.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ appName, schoolName })
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

  async markMessagesRead() {
    return this.request('/messages/mark-read', {
      method: 'POST'
    });
  },

  // Timetable API
  async getTimetable(className, day) {
    let url = '/timetable';
    const params = new URLSearchParams();
    if (className && className !== 'all') params.append('class', className);
    if (day && day !== 'all') params.append('day', day);
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

  async deleteTimetableSlot(id) {
    return this.request(`/timetable/${id}`, {
      method: 'DELETE'
    });
  }
};
