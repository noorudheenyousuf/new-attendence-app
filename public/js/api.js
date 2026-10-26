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

  async googleLogin(name, email, avatarUrl) {
    const res = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ name, email, avatarUrl })
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  async getMe() {
    return this.request('/auth/me');
  },

  // Classes
  async getClasses() {
    return this.request('/classes');
  },

  async addClass(name, classTeacher) {
    return this.request('/classes', {
      method: 'POST',
      body: JSON.stringify({ name, classTeacher })
    });
  },

  async updateClass(id, name, classTeacher) {
    return this.request(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, classTeacher })
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

  // Reports
  async getClassReport(className, period = 'all-year', subject = 'whole') {
    const params = new URLSearchParams({ class: className, period, subject });
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

  async getTeachers() {
    return this.request('/admin/teachers');
  },

  async addTeacher(name, email, password) {
    return this.request('/admin/teachers', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
  },

  async editTeacher(id, name) {
    return this.request(`/admin/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
  },

  async makeTeacherAdmin(id) {
    return this.request(`/admin/teachers/${id}/make-admin`, {
      method: 'PUT'
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
  }
};
