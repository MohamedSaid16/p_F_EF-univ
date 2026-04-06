/*
  Centralized API client for the University Platform.
  Base URL defaults to http://localhost:5000 in development.
  Credentials: 'include' sends httpOnly cookies (JWT access + refresh tokens).
  Auto-refresh: on 401, tries /refresh-token once then retries the original request.
*/

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function resolveMediaUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${API_BASE}${normalized}`;
}

let isRefreshing = false;
let refreshQueue = [];

function processQueue(error) {
  refreshQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()));
  refreshQueue = [];
}

async function request(endpoint, options = {}, _isRetry = false) {
  const url = `${API_BASE}${endpoint}`;
  const isFormDataBody = typeof FormData !== 'undefined' && options?.body instanceof FormData;

  const res = await fetch(url, {
    headers: {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    credentials: 'include', // send httpOnly cookies
    ...options,
  });

  // Rate limiter returns HTML, not JSON
  if (res.status === 429) {
    const error = new Error('Too many attempts. Please wait a few minutes and try again.');
    error.status = 429;
    error.code = 'RATE_LIMITED';
    throw error;
  }

  // Auto-refresh on 401 (skip if this IS the refresh call or a retry)
  if (res.status === 401 && !_isRetry && !endpoint.includes('/refresh-token')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/api/v1/auth/refresh-token`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!refreshRes.ok) {
          const refreshError = new Error('Session expired. Please sign in again.');
          refreshError.status = refreshRes.status;
          throw refreshError;
        }
        processQueue(null);
      } catch (refreshErr) {
        processQueue(refreshErr);
        throw refreshErr;
      } finally {
        isRefreshing = false;
      }
    } else {
      // Another refresh is in-flight — wait for it
      await new Promise((resolve, reject) => refreshQueue.push({ resolve, reject }));
    }
    // Retry the original request once
    return request(endpoint, options, true);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    const error = new Error('Server error. Please try again later.');
    error.status = res.status;
    throw error;
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.message || 'Something went wrong';
    const error = new Error(message);
    error.status = res.status;
    error.code = data?.error?.code;
    throw error;
  }

  return data;
}

function buildQueryString(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) {
    return '';
  }

  const query = new URLSearchParams();
  entries.forEach(([key, value]) => query.set(key, String(value)));
  return `?${query.toString()}`;
}

async function downloadFile(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    let message = 'Failed to download file';
    try {
      const payload = await res.json();
      message = payload?.error?.message || payload?.message || message;
    } catch {
      // ignore JSON parse errors for binary responses
    }

    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  const disposition = res.headers.get('content-disposition') || '';
  const utf8NameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const simpleNameMatch = disposition.match(/filename="?([^";]+)"?/i);

  const rawFileName = utf8NameMatch?.[1] || simpleNameMatch?.[1] || 'download';
  const fileName = decodeURIComponent(rawFileName);
  const blob = await res.blob();

  return { blob, fileName };
}

/* ── Auth API ───────────────────────────────────────────────── */

export const authAPI = {
  login: (email, password) =>
    request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (userData) =>
    request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  logout: () =>
    request('/api/v1/auth/logout', { method: 'POST' }),

  refreshToken: () =>
    request('/api/v1/auth/refresh-token', { method: 'POST' }),

  getMe: () =>
    request('/api/v1/auth/me'),

  getRbacCatalog: () =>
    request('/api/v1/auth/rbac/catalog'),

  verifyEmail: (token) =>
    request(`/api/v1/auth/verify-email/${token}`),

  resendVerification: (email) =>
    request('/api/v1/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  changePassword: (currentPassword, newPassword) =>
    request('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  uploadProfilePhoto: (file) => {
    const formData = new FormData();
    formData.append('photo', file);

    return request('/api/v1/auth/profile/photo', {
      method: 'POST',
      body: formData,
    });
  },

  removeProfilePhoto: () =>
    request('/api/v1/auth/profile/photo', {
      method: 'DELETE',
    }),


  forgotPassword: (email) =>
    request('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token, newPassword) =>
    request('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  /* Admin-only endpoints */
  adminCreateUser: (userData) =>
    request('/api/v1/auth/admin/create-user', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  adminImportUsersExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return request('/api/v1/auth/admin/import-users-excel', {
      method: 'POST',
      body: formData,
    });
  },

  adminResetPassword: (userId) =>
    request(`/api/v1/auth/admin/reset-password/${userId}`, {
      method: 'POST',
    }),

  adminGetUsers: () =>
    request('/api/v1/auth/admin/users'),

  adminGetRoles: () =>
    request('/api/v1/auth/admin/roles'),

  adminGetAcademicOptions: () =>
    request('/api/v1/auth/admin/academic/options'),

  adminCreateSpecialite: (payload) =>
    request('/api/v1/auth/admin/academic/specialites', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminCreatePromo: (payload) =>
    request('/api/v1/auth/admin/academic/promos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminCreateModule: (payload) =>
    request('/api/v1/auth/admin/academic/modules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminGetAcademicAssignments: () =>
    request('/api/v1/auth/admin/academic/assignments'),

  adminAssignStudentPromo: (userId, promoId) =>
    request(`/api/v1/auth/admin/academic/assignments/students/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ promoId }),
    }),

  adminAssignTeacherModules: (userId, payload) =>
    request(`/api/v1/auth/admin/academic/assignments/teachers/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  adminUpdateUserRoles: (userId, roleNames) =>
    request(`/api/v1/auth/admin/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleNames }),
    }),

  adminUpdateUserStatus: (userId, status) =>
    request(`/api/v1/auth/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
};

export const adminPanelAPI = {
  getOverview: () =>
    request('/api/v1/admin/dashboard/overview'),

  getAuditLogs: (params = {}) =>
    request(`/api/v1/admin/audit-logs${buildQueryString(params)}`),

  getUsers: (params = {}) =>
    request(`/api/v1/admin/users${buildQueryString(params)}`),

  updateUserRole: (userId, role) =>
    request(`/api/v1/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  deleteUser: (userId) =>
    request(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
    }),

  getAnnouncements: (params = {}) =>
    request(`/api/v1/admin/announcements${buildQueryString(params)}`),

  createAnnouncement: (formData) =>
    request('/api/v1/admin/announcements', {
      method: 'POST',
      body: formData,
    }),

  updateAnnouncement: (announcementId, formData) =>
    request(`/api/v1/admin/announcements/${announcementId}`, {
      method: 'PATCH',
      body: formData,
    }),

  deleteAnnouncement: (announcementId) =>
    request(`/api/v1/admin/announcements/${announcementId}`, {
      method: 'DELETE',
    }),

  getReclamations: (params = {}) =>
    request(`/api/v1/admin/reclamations${buildQueryString(params)}`),

  updateReclamationStatus: (reclamationId, payload) =>
    request(`/api/v1/admin/reclamations/${reclamationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getDocuments: (params = {}) =>
    request(`/api/v1/admin/documents${buildQueryString(params)}`),

  deleteDocument: (kind, documentId) =>
    request(`/api/v1/admin/documents/${kind}/${documentId}`, {
      method: 'DELETE',
    }),

  getRequestWorkflowHistory: (category, requestId) =>
    request(`/api/v1/requests/admin/${category}/${requestId}/workflow`),

  downloadDocument: (kind, documentId) =>
    downloadFile(`/api/v1/admin/documents/${kind}/${documentId}/download`),
};

export const notificationsAPI = {
  getList: (params = {}) =>
    request(`/api/v1/notifications${buildQueryString(params)}`),

  getUnreadCount: () =>
    request('/api/v1/notifications/unread-count'),

  markAsRead: (notificationId) =>
    request(`/api/v1/notifications/${notificationId}/read`, {
      method: 'PUT',
    }),

  markAllAsRead: () =>
    request('/api/v1/notifications/read-all', {
      method: 'PUT',
    }),

  deleteOne: (notificationId) =>
    request(`/api/v1/notifications/${notificationId}`, {
      method: 'DELETE',
    }),

  clearAll: () =>
    request('/api/v1/notifications', {
      method: 'DELETE',
    }),
};

export const teacherPanelAPI = {
  getDashboard: () =>
    request('/api/v1/teacher/dashboard'),

  getAnnouncements: (params = {}) =>
    request(`/api/v1/teacher/announcements${buildQueryString(params)}`),

  createAnnouncement: (formData) =>
    request('/api/v1/teacher/announcements', {
      method: 'POST',
      body: formData,
    }),

  updateAnnouncement: (announcementId, formData) =>
    request(`/api/v1/teacher/announcements/${announcementId}`, {
      method: 'PATCH',
      body: formData,
    }),

  deleteAnnouncement: (announcementId) =>
    request(`/api/v1/teacher/announcements/${announcementId}`, {
      method: 'DELETE',
    }),

  getReclamations: (params = {}) =>
    request(`/api/v1/teacher/reclamations${buildQueryString(params)}`),

  updateReclamationStatus: (reclamationId, payload) =>
    request(`/api/v1/teacher/reclamations/${reclamationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getStudents: (params = {}) =>
    request(`/api/v1/teacher/students${buildQueryString(params)}`),

  getStudentReclamationHistory: (studentId) =>
    request(`/api/v1/teacher/students/${studentId}/reclamations`),

  getDocuments: (params = {}) =>
    request(`/api/v1/teacher/documents${buildQueryString(params)}`),

  createDocument: (formData) =>
    request('/api/v1/teacher/documents', {
      method: 'POST',
      body: formData,
    }),

  updateDocument: (documentId, formData) =>
    request(`/api/v1/teacher/documents/${documentId}`, {
      method: 'PATCH',
      body: formData,
    }),

  deleteDocument: (documentId) =>
    request(`/api/v1/teacher/documents/${documentId}`, {
      method: 'DELETE',
    }),

  downloadDocument: (documentId) =>
    downloadFile(`/api/v1/teacher/documents/${documentId}/download`),

  getProfile: () =>
    request('/api/v1/teacher/profile'),

  updateProfile: (payload) =>
    request('/api/v1/teacher/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (currentPassword, newPassword) =>
    request('/api/v1/teacher/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export const studentPanelAPI = {
  getDashboard: () =>
    request('/api/v1/student/panel/dashboard'),

  getAnnouncements: (params = {}) =>
    request(`/api/v1/student/panel/announcements${buildQueryString(params)}`),

  getAnnouncementDetails: (announcementId) =>
    request(`/api/v1/student/panel/announcements/${announcementId}`),

  downloadAnnouncementDocument: (announcementId, documentId) =>
    downloadFile(`/api/v1/student/panel/announcements/${announcementId}/documents/${documentId}/download`),

  getReclamationTypes: () =>
    request('/api/v1/student/panel/reclamation-types'),

  createReclamation: (formData) =>
    request('/api/v1/student/panel/reclamations', {
      method: 'POST',
      body: formData,
    }),

  getReclamations: (params = {}) =>
    request(`/api/v1/student/panel/reclamations${buildQueryString(params)}`),

  getReclamationDetails: (reclamationId) =>
    request(`/api/v1/student/panel/reclamations/${reclamationId}`),

  downloadReclamationDocument: (reclamationId, documentId) =>
    downloadFile(`/api/v1/student/panel/reclamations/${reclamationId}/documents/${documentId}/download`),

  getDocuments: (params = {}) =>
    request(`/api/v1/student/panel/documents${buildQueryString(params)}`),

  downloadDocument: (kind, documentId) =>
    downloadFile(`/api/v1/student/panel/documents/${kind}/${documentId}/download`),

  getProfile: () =>
    request('/api/v1/student/panel/profile'),

  updateProfile: (payload) =>
    request('/api/v1/student/panel/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (currentPassword, newPassword) =>
    request('/api/v1/student/panel/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export const messagesAPI = {
  getInbox: () =>
    request('/api/v1/messages/inbox'),

  getCapabilities: () =>
    request('/api/v1/messages/capabilities'),

  send: ({ mode, recipientUserId, title, content }) =>
    request('/api/v1/messages/send', {
      method: 'POST',
      body: JSON.stringify({ mode, recipientUserId, title, content }),
    }),
};

export default request;
