import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DataTable from '../../../components/admin/shared/DataTable';
import Modal from '../../../components/admin/shared/Modal';
import Pagination from '../../../components/admin/shared/Pagination';
import { notificationsAPI, teacherPanelAPI } from '../../../services/api';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'reclamations', label: 'Reclamations' },
  { key: 'students', label: 'Students' },
  { key: 'documents', label: 'Documents' },
  { key: 'profile', label: 'Profile' },
  { key: 'notifications', label: 'Notifications' },
];

const ANNOUNCEMENT_STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
];

const ANNOUNCEMENT_STATUS_FORM = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const ANNOUNCEMENT_TARGET_OPTIONS = [
  { value: 'students', label: 'Students' },
  { value: 'all', label: 'All users' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'administration', label: 'Administration' },
];

const ANNOUNCEMENT_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const RECLAMATION_STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const RECLAMATION_STATUS_FORM = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const inputClassName =
  'rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

const textareaClassName =
  'rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 min-h-[96px]';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatFileSize(value) {
  if (!value || Number.isNaN(Number(value))) return '-';

  const size = Number(value);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function statusBadgeClass(status) {
  if (status === 'published' || status === 'approved') {
    return 'bg-green-50 text-green-700';
  }

  if (status === 'draft' || status === 'pending' || status === 'scheduled') {
    return 'bg-amber-50 text-amber-700';
  }

  if (status === 'rejected' || status === 'archived') {
    return 'bg-red-50 text-red-700';
  }

  return 'bg-blue-50 text-blue-700';
}

function toRelativeTime(value) {
  if (!value) return 'just now';

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'just now';

  const diffSeconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName || 'download';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function StatusBadge({ status, label }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}>
      {label}
    </span>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">{title}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink-secondary">{subtitle}</p>
    </article>
  );
}

function buildAnnouncementFormData(form, files, isEdit = false) {
  const payload = new FormData();

  if (form.title !== undefined) payload.append('title', form.title);
  if (form.description !== undefined) payload.append('description', form.description);
  if (form.typeName !== undefined) payload.append('typeName', form.typeName);
  if (form.status !== undefined) payload.append('status', form.status);
  if (form.target !== undefined) payload.append('target', form.target);
  if (form.priority !== undefined) payload.append('priority', form.priority);

  if (form.moduleId !== undefined && form.moduleId !== null && form.moduleId !== '') {
    payload.append('moduleId', String(form.moduleId));
  }

  if (form.scheduleAt !== undefined && form.scheduleAt) {
    payload.append('scheduleAt', form.scheduleAt);
  }

  if (form.expiresAt !== undefined && form.expiresAt) {
    payload.append('expiresAt', form.expiresAt);
  }

  if (isEdit && Array.isArray(form.removeDocumentIds) && form.removeDocumentIds.length > 0) {
    payload.append('removeDocumentIds', form.removeDocumentIds.join(','));
  }

  if (Array.isArray(files)) {
    files.forEach((file) => {
      payload.append('files', file);
    });
  }

  return payload;
}

function buildDocumentFormData(form, file) {
  const payload = new FormData();
  payload.append('title', form.title || '');

  if (form.moduleId) {
    payload.append('moduleId', String(form.moduleId));
  }

  if (form.announcementId) {
    payload.append('announcementId', String(form.announcementId));
  }

  if (file) {
    payload.append('file', file);
  }

  return payload;
}

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [courses, setCourses] = useState([]);

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsPagination, setAnnouncementsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [announcementFilters, setAnnouncementFilters] = useState({
    search: '',
    moduleId: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 10,
  });
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementModalMode, setAnnouncementModalMode] = useState('create');
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementDeleteModal, setAnnouncementDeleteModal] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    description: '',
    moduleId: '',
    typeName: '',
    status: 'published',
    target: 'students',
    priority: 'normal',
    scheduleAt: '',
    expiresAt: '',
    removeDocumentIds: [],
  });
  const [announcementFiles, setAnnouncementFiles] = useState([]);

  const [reclamationsLoading, setReclamationsLoading] = useState(false);
  const [reclamations, setReclamations] = useState([]);
  const [reclamationsPagination, setReclamationsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [reclamationFilters, setReclamationFilters] = useState({
    search: '',
    moduleId: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 10,
  });
  const [reclamationModal, setReclamationModal] = useState(null);
  const [reclamationSubmitting, setReclamationSubmitting] = useState(false);
  const [reclamationForm, setReclamationForm] = useState({
    status: 'pending',
    response: '',
    internalNote: '',
  });

  const [studentsLoading, setStudentsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [studentsPagination, setStudentsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [studentFilters, setStudentFilters] = useState({
    search: '',
    moduleId: '',
    page: 1,
    limit: 10,
  });
  const [studentHistoryModal, setStudentHistoryModal] = useState(null);
  const [studentHistoryLoading, setStudentHistoryLoading] = useState(false);

  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsPagination, setDocumentsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [documentFilters, setDocumentFilters] = useState({
    search: '',
    moduleId: '',
    page: 1,
    limit: 10,
  });
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentModalMode, setDocumentModalMode] = useState('create');
  const [documentSubmitting, setDocumentSubmitting] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentDeleteModal, setDocumentDeleteModal] = useState(null);
  const [documentForm, setDocumentForm] = useState({
    title: '',
    moduleId: '',
    announcementId: '',
  });
  const [documentFile, setDocumentFile] = useState(null);

  const [announcementOptions, setAnnouncementOptions] = useState([]);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileForm, setProfileForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    bureau: '',
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setError('');

    try {
      const response = await teacherPanelAPI.getDashboard();
      const data = response?.data || null;
      setDashboardData(data);
      if (Array.isArray(data?.courses)) {
        setCourses(data.courses);
      }
    } catch (loadError) {
      setError(loadError.message || 'Failed to load dashboard data.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    setError('');

    try {
      const response = await teacherPanelAPI.getAnnouncements({
        search: announcementFilters.search,
        moduleId: announcementFilters.moduleId || undefined,
        status: announcementFilters.status || undefined,
        dateFrom: announcementFilters.dateFrom || undefined,
        dateTo: announcementFilters.dateTo || undefined,
        page: announcementFilters.page,
        limit: announcementFilters.limit,
      });

      setAnnouncements(Array.isArray(response?.data) ? response.data : []);
      setAnnouncementsPagination(response?.pagination || { page: 1, totalPages: 1, total: 0 });
      if (Array.isArray(response?.courses)) {
        setCourses(response.courses);
      }
    } catch (loadError) {
      setError(loadError.message || 'Failed to load announcements.');
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [announcementFilters]);

  const loadReclamations = useCallback(async () => {
    setReclamationsLoading(true);
    setError('');

    try {
      const response = await teacherPanelAPI.getReclamations({
        search: reclamationFilters.search,
        moduleId: reclamationFilters.moduleId || undefined,
        status: reclamationFilters.status || undefined,
        dateFrom: reclamationFilters.dateFrom || undefined,
        dateTo: reclamationFilters.dateTo || undefined,
        page: reclamationFilters.page,
        limit: reclamationFilters.limit,
      });

      setReclamations(Array.isArray(response?.data) ? response.data : []);
      setReclamationsPagination(response?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load reclamations.');
    } finally {
      setReclamationsLoading(false);
    }
  }, [reclamationFilters]);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    setError('');

    try {
      const response = await teacherPanelAPI.getStudents({
        search: studentFilters.search,
        moduleId: studentFilters.moduleId || undefined,
        page: studentFilters.page,
        limit: studentFilters.limit,
      });

      setStudents(Array.isArray(response?.data) ? response.data : []);
      setStudentsPagination(response?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load students.');
    } finally {
      setStudentsLoading(false);
    }
  }, [studentFilters]);

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setError('');

    try {
      const response = await teacherPanelAPI.getDocuments({
        search: documentFilters.search,
        moduleId: documentFilters.moduleId || undefined,
        page: documentFilters.page,
        limit: documentFilters.limit,
      });

      setDocuments(Array.isArray(response?.data) ? response.data : []);
      setDocumentsPagination(response?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load documents.');
    } finally {
      setDocumentsLoading(false);
    }
  }, [documentFilters]);

  const loadAnnouncementOptions = useCallback(async () => {
    try {
      const response = await teacherPanelAPI.getAnnouncements({ page: 1, limit: 200 });
      setAnnouncementOptions(Array.isArray(response?.data) ? response.data : []);
    } catch (_error) {
      setAnnouncementOptions([]);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setError('');

    try {
      const response = await teacherPanelAPI.getProfile();
      const data = response?.data || null;
      setProfileData(data);
      setProfileForm({
        nom: data?.nom || '',
        prenom: data?.prenom || '',
        email: data?.email || '',
        telephone: data?.telephone || '',
        bureau: data?.bureau || '',
      });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load profile.');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setError('');

    try {
      const response = await notificationsAPI.getList({ page: 1, limit: 100 });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setNotifications(rows);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load notifications.');
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    }
  }, [activeTab, loadDashboard]);

  useEffect(() => {
    if (activeTab === 'announcements') {
      loadAnnouncements();
    }
  }, [activeTab, loadAnnouncements]);

  useEffect(() => {
    if (activeTab === 'reclamations') {
      loadReclamations();
    }
  }, [activeTab, loadReclamations]);

  useEffect(() => {
    if (activeTab === 'students') {
      loadStudents();
    }
  }, [activeTab, loadStudents]);

  useEffect(() => {
    if (activeTab === 'documents') {
      loadDocuments();
      loadAnnouncementOptions();
    }
  }, [activeTab, loadDocuments, loadAnnouncementOptions]);

  useEffect(() => {
    if (activeTab === 'profile') {
      loadProfile();
    }
  }, [activeTab, loadProfile]);

  useEffect(() => {
    if (activeTab === 'notifications') {
      loadNotifications();
    }
  }, [activeTab, loadNotifications]);

  const openCreateAnnouncementModal = () => {
    setAnnouncementModalMode('create');
    setSelectedAnnouncement(null);
    setAnnouncementFiles([]);
    setAnnouncementForm({
      title: '',
      description: '',
      moduleId: courses[0]?.moduleId || '',
      typeName: '',
      status: 'published',
      target: 'students',
      priority: 'normal',
      scheduleAt: '',
      expiresAt: '',
      removeDocumentIds: [],
    });
    setAnnouncementModalOpen(true);
  };

  const openEditAnnouncementModal = (announcement) => {
    setAnnouncementModalMode('edit');
    setSelectedAnnouncement(announcement);
    setAnnouncementFiles([]);
    setAnnouncementForm({
      title: announcement?.title || '',
      description: announcement?.description || '',
      moduleId: announcement?.module?.id || '',
      typeName: announcement?.type?.name || '',
      status: announcement?.rawStatus || announcement?.status || 'draft',
      target: announcement?.target || 'students',
      priority: announcement?.priority || 'normal',
      scheduleAt: formatDateTimeInput(announcement?.scheduleAt),
      expiresAt: formatDateInput(announcement?.expiresAt),
      removeDocumentIds: [],
    });
    setAnnouncementModalOpen(true);
  };

  const submitAnnouncement = async () => {
    setAnnouncementSubmitting(true);
    setError('');

    try {
      const payload = buildAnnouncementFormData(
        announcementForm,
        announcementFiles,
        announcementModalMode === 'edit'
      );

      if (announcementModalMode === 'create') {
        await teacherPanelAPI.createAnnouncement(payload);
        setSuccessMessage('Announcement created successfully.');
      } else if (selectedAnnouncement?.id) {
        await teacherPanelAPI.updateAnnouncement(selectedAnnouncement.id, payload);
        setSuccessMessage('Announcement updated successfully.');
      }

      setAnnouncementModalOpen(false);
      await Promise.all([loadAnnouncements(), loadDashboard()]);
    } catch (submitError) {
      setError(submitError.message || 'Failed to save announcement.');
    } finally {
      setAnnouncementSubmitting(false);
    }
  };

  const toggleAnnouncementStatus = async (announcement, nextStatus) => {
    setError('');
    try {
      const payload = new FormData();
      payload.append('status', nextStatus);
      await teacherPanelAPI.updateAnnouncement(announcement.id, payload);
      setSuccessMessage('Announcement status updated.');
      await Promise.all([loadAnnouncements(), loadDashboard()]);
    } catch (submitError) {
      setError(submitError.message || 'Failed to update announcement status.');
    }
  };

  const confirmDeleteAnnouncement = async () => {
    if (!announcementDeleteModal?.id) return;

    setError('');
    try {
      await teacherPanelAPI.deleteAnnouncement(announcementDeleteModal.id);
      setAnnouncementDeleteModal(null);
      setSuccessMessage('Announcement deleted successfully.');
      await Promise.all([loadAnnouncements(), loadDashboard()]);
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete announcement.');
    }
  };

  const openReclamationModal = (reclamation) => {
    setReclamationModal(reclamation);
    setReclamationForm({
      status: reclamation?.status || 'pending',
      response: reclamation?.response || '',
      internalNote: reclamation?.internalNote || '',
    });
  };

  const submitReclamation = async () => {
    if (!reclamationModal?.id) return;

    setReclamationSubmitting(true);
    setError('');

    try {
      await teacherPanelAPI.updateReclamationStatus(reclamationModal.id, {
        status: reclamationForm.status,
        response: reclamationForm.response,
        internalNote: reclamationForm.internalNote,
      });

      setReclamationModal(null);
      setSuccessMessage('Reclamation updated successfully.');
      await Promise.all([loadReclamations(), loadDashboard()]);
    } catch (submitError) {
      setError(submitError.message || 'Failed to update reclamation.');
    } finally {
      setReclamationSubmitting(false);
    }
  };

  const openStudentHistoryModal = async (student) => {
    setStudentHistoryLoading(true);
    setStudentHistoryModal({ student, data: null });
    setError('');

    try {
      const response = await teacherPanelAPI.getStudentReclamationHistory(student.id);
      setStudentHistoryModal({ student, data: response?.data || null });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load student history.');
      setStudentHistoryModal({ student, data: { student, reclamations: [] } });
    } finally {
      setStudentHistoryLoading(false);
    }
  };

  const openCreateDocumentModal = () => {
    setDocumentModalMode('create');
    setSelectedDocument(null);
    setDocumentFile(null);
    setDocumentForm({
      title: '',
      moduleId: courses[0]?.moduleId || '',
      announcementId: '',
    });
    setDocumentModalOpen(true);
  };

  const openEditDocumentModal = (document) => {
    setDocumentModalMode('edit');
    setSelectedDocument(document);
    setDocumentFile(null);
    setDocumentForm({
      title: document?.title || '',
      moduleId: document?.module?.id || '',
      announcementId: document?.announcement?.id || '',
    });
    setDocumentModalOpen(true);
  };

  const submitDocument = async () => {
    setDocumentSubmitting(true);
    setError('');

    try {
      if (documentModalMode === 'create' && !documentFile) {
        throw new Error('Please attach a document file.');
      }

      const payload = buildDocumentFormData(documentForm, documentFile);

      if (documentModalMode === 'create') {
        await teacherPanelAPI.createDocument(payload);
        setSuccessMessage('Document uploaded successfully.');
      } else if (selectedDocument?.id) {
        await teacherPanelAPI.updateDocument(selectedDocument.id, payload);
        setSuccessMessage('Document updated successfully.');
      }

      setDocumentModalOpen(false);
      await loadDocuments();
    } catch (submitError) {
      setError(submitError.message || 'Failed to save document.');
    } finally {
      setDocumentSubmitting(false);
    }
  };

  const confirmDeleteDocument = async () => {
    if (!documentDeleteModal?.id) return;

    setError('');
    try {
      await teacherPanelAPI.deleteDocument(documentDeleteModal.id);
      setDocumentDeleteModal(null);
      setSuccessMessage('Document deleted successfully.');
      await loadDocuments();
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete document.');
    }
  };

  const handleDownloadDocument = async (documentId) => {
    setError('');
    try {
      const { blob, fileName } = await teacherPanelAPI.downloadDocument(documentId);
      triggerDownload(blob, fileName);
    } catch (downloadError) {
      setError(downloadError.message || 'Failed to download document.');
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setProfileSubmitting(true);
    setError('');

    try {
      const response = await teacherPanelAPI.updateProfile(profileForm);
      setProfileData(response?.data || null);
      setSuccessMessage('Profile updated successfully.');
    } catch (submitError) {
      setError(submitError.message || 'Failed to update profile.');
    } finally {
      setProfileSubmitting(false);
    }
  };

  const submitPasswordChange = async (event) => {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setPasswordSubmitting(true);
    setError('');

    try {
      await teacherPanelAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccessMessage('Password changed successfully.');
    } catch (submitError) {
      setError(submitError.message || 'Failed to change password.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    setNotificationsBusy(true);
    setError('');

    try {
      await notificationsAPI.markAsRead(notificationId);
      setNotifications((previous) =>
        previous.map((item) => (item.id === notificationId ? { ...item, read: true } : item))
      );
    } catch (updateError) {
      setError(updateError.message || 'Failed to update notification.');
    } finally {
      setNotificationsBusy(false);
    }
  };

  const markAllNotificationsAsRead = async () => {
    setNotificationsBusy(true);
    setError('');

    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
    } catch (updateError) {
      setError(updateError.message || 'Failed to update notifications.');
    } finally {
      setNotificationsBusy(false);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => (showUnreadOnly ? !item.read : true)),
    [notifications, showUnreadOnly]
  );

  const announcementColumns = [
      {
        key: 'title',
        label: 'Announcement',
        render: (row) => (
          <div>
            <p className="font-semibold text-ink">{row.title}</p>
            <p className="mt-1 text-xs text-ink-tertiary">{row.module?.name || 'No module'} {row.module?.code ? `(${row.module.code})` : ''}</p>
            <p className="mt-1 text-xs text-ink-tertiary">Type: {row.type?.name || 'General'}</p>
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => (
          <StatusBadge status={row.status} label={String(row.status || '').toUpperCase()} />
        ),
      },
      {
        key: 'schedule',
        label: 'Schedule',
        render: (row) => (
          <div className="text-xs text-ink-tertiary">
            <p>Published: {formatDate(row.publishedAt)}</p>
            <p>Scheduled: {formatDate(row.scheduleAt)}</p>
          </div>
        ),
      },
      {
        key: 'attachments',
        label: 'Files',
        render: (row) => (
          <span className="text-xs text-ink-tertiary">{Array.isArray(row.attachments) ? row.attachments.length : 0}</span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openEditAnnouncementModal(row)}
              className="rounded-md border border-edge px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink"
            >
              Edit
            </button>
            {row.rawStatus === 'published' ? (
              <button
                type="button"
                onClick={() => toggleAnnouncementStatus(row, 'draft')}
                className="rounded-md border border-edge-strong bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => toggleAnnouncementStatus(row, 'published')}
                className="rounded-md border border-edge-strong bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
              >
                Publish
              </button>
            )}
            <button
              type="button"
              onClick={() => setAnnouncementDeleteModal(row)}
              className="rounded-md border border-edge-strong bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
            >
              Delete
            </button>
          </div>
        ),
      },
    ];

  const reclamationColumns = [
      {
        key: 'title',
        label: 'Reclamation',
        render: (row) => (
          <div>
            <p className="font-semibold text-ink">{row.title}</p>
            <p className="mt-1 text-xs text-ink-tertiary">{row.type}</p>
            <p className="mt-1 text-xs text-ink-tertiary">Created: {formatDate(row.createdAt)}</p>
          </div>
        ),
      },
      {
        key: 'student',
        label: 'Student',
        render: (row) => (
          <div>
            <p className="font-medium text-ink">{row.student?.prenom} {row.student?.nom}</p>
            <p className="text-xs text-ink-tertiary">{row.student?.matricule || '-'}</p>
            <p className="text-xs text-ink-tertiary">{row.student?.email || '-'}</p>
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => (
          <StatusBadge status={row.status} label={String(row.status || '').toUpperCase()} />
        ),
      },
      {
        key: 'modules',
        label: 'Related Modules',
        render: (row) => (
          <div className="space-y-1 text-xs text-ink-tertiary">
            {(row.relatedModules || []).slice(0, 3).map((module) => (
              <p key={`${row.id}-${module.id}`}>{module.name} ({module.code})</p>
            ))}
            {!row.relatedModules?.length ? <p>-</p> : null}
          </div>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <button
            type="button"
            onClick={() => openReclamationModal(row)}
            className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
          >
            Review
          </button>
        ),
      },
    ];

  const studentColumns = [
      {
        key: 'identity',
        label: 'Student',
        render: (row) => (
          <div>
            <p className="font-semibold text-ink">{row.prenom} {row.nom}</p>
            <p className="text-xs text-ink-tertiary">{row.matricule}</p>
            <p className="text-xs text-ink-tertiary">{row.email}</p>
          </div>
        ),
      },
      {
        key: 'promo',
        label: 'Promo',
        render: (row) => (
          <div className="text-xs text-ink-tertiary">
            <p>{row.promo?.nom || '-'}</p>
            <p>{row.promo?.section || '-'}</p>
          </div>
        ),
      },
      {
        key: 'courses',
        label: 'Your Courses',
        render: (row) => (
          <div className="space-y-1 text-xs text-ink-tertiary">
            {(row.relatedCourses || []).slice(0, 3).map((course) => (
              <p key={`${row.id}-${course.moduleId}`}>{course.moduleName} ({course.moduleCode})</p>
            ))}
          </div>
        ),
      },
      {
        key: 'reclamationsCount',
        label: 'Reclamations',
        render: (row) => (
          <span className="text-sm font-semibold text-ink">{row.reclamationsCount || 0}</span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <button
            type="button"
            onClick={() => openStudentHistoryModal(row)}
            className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
          >
            History
          </button>
        ),
      },
    ];

  const documentColumns = [
      {
        key: 'title',
        label: 'Document',
        render: (row) => (
          <div>
            <p className="font-semibold text-ink">{row.title}</p>
            <p className="text-xs text-ink-tertiary">{row.fileName}</p>
            <p className="text-xs text-ink-tertiary">{formatFileSize(row.fileSize)}</p>
          </div>
        ),
      },
      {
        key: 'module',
        label: 'Module',
        render: (row) => (
          <p className="text-xs text-ink-tertiary">
            {row.module?.name ? `${row.module.name} (${row.module.code || ''})` : 'No module'}
          </p>
        ),
      },
      {
        key: 'announcement',
        label: 'Announcement',
        render: (row) => (
          <p className="text-xs text-ink-tertiary">{row.announcement?.title || '-'}</p>
        ),
      },
      {
        key: 'updatedAt',
        label: 'Updated',
        render: (row) => (
          <p className="text-xs text-ink-tertiary">{formatDate(row.updatedAt)}</p>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadDocument(row.id)}
              className="rounded-md border border-edge px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink"
            >
              Download
            </button>
            <button
              type="button"
              onClick={() => openEditDocumentModal(row)}
              className="rounded-md border border-edge px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDocumentDeleteModal(row)}
              className="rounded-md border border-edge-strong bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
            >
              Delete
            </button>
          </div>
        ),
      },
    ];

  const moduleFilterOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    courses.forEach((course) => {
      if (!seen.has(course.moduleId)) {
        seen.add(course.moduleId);
        options.push({
          value: course.moduleId,
          label: `${course.moduleName} (${course.moduleCode})`,
        });
      }
    });

    return options;
  }, [courses]);

  return (
    <div className="space-y-6 max-w-[1400px] min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.20),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.20),transparent_35%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Teacher Workspace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Course Command Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary md:text-base">
            Manage announcements, respond to reclamations, track student activity, publish course documents, and keep your profile and notifications up to date from one interface.
          </p>

          {error ? (
            <div className="mt-4 rounded-xl border border-edge-strong bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-4 rounded-xl border border-edge-strong bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? 'bg-brand text-white'
                    : 'border border-edge bg-surface text-ink-secondary hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeTab === 'dashboard' ? (
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Announcements"
              value={dashboardLoading ? '...' : dashboardData?.summary?.announcements ?? 0}
              subtitle="Published or draft course announcements"
            />
            <StatCard
              title="Reclamations"
              value={dashboardLoading ? '...' : dashboardData?.summary?.reclamations ?? 0}
              subtitle="Student reclamations from your promos"
            />
            <StatCard
              title="Assigned Modules"
              value={moduleFilterOptions.length}
              subtitle="Distinct modules currently assigned to you"
            />
            <StatCard
              title="Unread Notifications"
              value={unreadCount}
              subtitle="Platform events requiring attention"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Recent Announcements</h2>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('announcements');
                    setAnnouncementModalOpen(false);
                  }}
                  className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
                >
                  View all
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {(dashboardData?.recentAnnouncements || []).slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-xl border border-edge-subtle bg-canvas px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{item.title}</p>
                        <p className="mt-1 text-xs text-ink-tertiary">{item.module?.name || 'No module'} {item.module?.code ? `(${item.module.code})` : ''}</p>
                      </div>
                      <StatusBadge status={item.status} label={String(item.status || '').toUpperCase()} />
                    </div>
                    <p className="mt-2 text-xs text-ink-tertiary">Updated: {formatDate(item.updatedAt)}</p>
                  </div>
                ))}

                {!dashboardData?.recentAnnouncements?.length ? (
                  <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-ink-tertiary">
                    No recent announcements.
                  </p>
                ) : null}
              </div>
            </article>

            <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Recent Reclamations</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('reclamations')}
                  className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
                >
                  View all
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {(dashboardData?.recentReclamations || []).slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-xl border border-edge-subtle bg-canvas px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{item.title}</p>
                        <p className="mt-1 text-xs text-ink-tertiary">{item.student?.fullName || 'Unknown student'}</p>
                      </div>
                      <StatusBadge status={item.status} label={String(item.status || '').toUpperCase()} />
                    </div>
                    <p className="mt-2 text-xs text-ink-tertiary">Created: {formatDate(item.createdAt)}</p>
                  </div>
                ))}

                {!dashboardData?.recentReclamations?.length ? (
                  <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-ink-tertiary">
                    No recent reclamations.
                  </p>
                ) : null}
              </div>
            </article>
          </div>

          <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Your Teaching Assignments</h2>
            <p className="mt-1 text-sm text-ink-tertiary">Modules and promos currently linked to your profile.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(dashboardData?.courses || []).map((course) => (
                <div key={`${course.enseignementId}-${course.moduleId}`} className="rounded-xl border border-edge-subtle bg-canvas px-4 py-3">
                  <p className="font-semibold text-ink">{course.moduleName}</p>
                  <p className="text-xs text-ink-tertiary">{course.moduleCode}</p>
                  <p className="mt-2 text-sm text-ink-secondary">{course.promoName}</p>
                  <p className="text-xs text-ink-tertiary">Section: {course.section}</p>
                </div>
              ))}
              {!dashboardData?.courses?.length ? (
                <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-ink-tertiary md:col-span-2 xl:col-span-3">
                  No course assignments available.
                </p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'announcements' ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-edge bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Announcements Management</h2>
              <button
                type="button"
                onClick={openCreateAnnouncementModal}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                New Announcement
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input
                value={announcementFilters.search}
                onChange={(event) => setAnnouncementFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                placeholder="Search title or content"
                className={`${inputClassName} xl:col-span-2`}
              />

              <select
                value={announcementFilters.moduleId}
                onChange={(event) => setAnnouncementFilters((prev) => ({ ...prev, moduleId: event.target.value, page: 1 }))}
                className={inputClassName}
              >
                <option value="">All modules</option>
                {moduleFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <select
                value={announcementFilters.status}
                onChange={(event) => setAnnouncementFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
                className={inputClassName}
              >
                {ANNOUNCEMENT_STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <input
                type="date"
                value={announcementFilters.dateFrom}
                onChange={(event) => setAnnouncementFilters((prev) => ({ ...prev, dateFrom: event.target.value, page: 1 }))}
                className={inputClassName}
              />

              <input
                type="date"
                value={announcementFilters.dateTo}
                onChange={(event) => setAnnouncementFilters((prev) => ({ ...prev, dateTo: event.target.value, page: 1 }))}
                className={inputClassName}
              />
            </div>
          </div>

          <DataTable
            columns={announcementColumns}
            rows={announcements}
            loading={announcementsLoading}
            emptyMessage="No announcements found."
          />

          <Pagination
            page={announcementsPagination.page || 1}
            totalPages={announcementsPagination.totalPages || 1}
            onPageChange={(page) => setAnnouncementFilters((prev) => ({ ...prev, page }))}
          />
        </section>
      ) : null}

      {activeTab === 'reclamations' ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-edge bg-surface p-4 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Reclamation Management</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input
                value={reclamationFilters.search}
                onChange={(event) => setReclamationFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                placeholder="Search by student, title, or text"
                className={`${inputClassName} xl:col-span-2`}
              />

              <select
                value={reclamationFilters.moduleId}
                onChange={(event) => setReclamationFilters((prev) => ({ ...prev, moduleId: event.target.value, page: 1 }))}
                className={inputClassName}
              >
                <option value="">All modules</option>
                {moduleFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <select
                value={reclamationFilters.status}
                onChange={(event) => setReclamationFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
                className={inputClassName}
              >
                {RECLAMATION_STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <input
                type="date"
                value={reclamationFilters.dateFrom}
                onChange={(event) => setReclamationFilters((prev) => ({ ...prev, dateFrom: event.target.value, page: 1 }))}
                className={inputClassName}
              />

              <input
                type="date"
                value={reclamationFilters.dateTo}
                onChange={(event) => setReclamationFilters((prev) => ({ ...prev, dateTo: event.target.value, page: 1 }))}
                className={inputClassName}
              />
            </div>
          </div>

          <DataTable
            columns={reclamationColumns}
            rows={reclamations}
            loading={reclamationsLoading}
            emptyMessage="No reclamations found for current filters."
          />

          <Pagination
            page={reclamationsPagination.page || 1}
            totalPages={reclamationsPagination.totalPages || 1}
            onPageChange={(page) => setReclamationFilters((prev) => ({ ...prev, page }))}
          />
        </section>
      ) : null}

      {activeTab === 'students' ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-edge bg-surface p-4 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Student Overview</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={studentFilters.search}
                onChange={(event) => setStudentFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                placeholder="Search by name, email, or matricule"
                className={`${inputClassName} xl:col-span-2`}
              />

              <select
                value={studentFilters.moduleId}
                onChange={(event) => setStudentFilters((prev) => ({ ...prev, moduleId: event.target.value, page: 1 }))}
                className={inputClassName}
              >
                <option value="">All modules</option>
                {moduleFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <DataTable
            columns={studentColumns}
            rows={students}
            loading={studentsLoading}
            emptyMessage="No students found for this filter."
          />

          <Pagination
            page={studentsPagination.page || 1}
            totalPages={studentsPagination.totalPages || 1}
            onPageChange={(page) => setStudentFilters((prev) => ({ ...prev, page }))}
          />
        </section>
      ) : null}

      {activeTab === 'documents' ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-edge bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Document Management</h2>
              <button
                type="button"
                onClick={openCreateDocumentModal}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                Upload Document
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={documentFilters.search}
                onChange={(event) => setDocumentFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                placeholder="Search title, module, or file"
                className={`${inputClassName} xl:col-span-2`}
              />

              <select
                value={documentFilters.moduleId}
                onChange={(event) => setDocumentFilters((prev) => ({ ...prev, moduleId: event.target.value, page: 1 }))}
                className={inputClassName}
              >
                <option value="">All modules</option>
                {moduleFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <DataTable
            columns={documentColumns}
            rows={documents}
            loading={documentsLoading}
            emptyMessage="No documents found."
          />

          <Pagination
            page={documentsPagination.page || 1}
            totalPages={documentsPagination.totalPages || 1}
            onPageChange={(page) => setDocumentFilters((prev) => ({ ...prev, page }))}
          />
        </section>
      ) : null}

      {activeTab === 'profile' ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Profile Details</h2>
            <p className="mt-1 text-sm text-ink-tertiary">Update your visible identity and contact information.</p>

            {profileLoading ? (
              <div className="mt-4 h-10 w-10 animate-spin rounded-full border-2 border-edge-strong border-t-brand" />
            ) : (
              <form className="mt-4 space-y-3" onSubmit={submitProfile}>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className={inputClassName}
                    placeholder="First name"
                    value={profileForm.prenom}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, prenom: event.target.value }))}
                  />
                  <input
                    className={inputClassName}
                    placeholder="Last name"
                    value={profileForm.nom}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, nom: event.target.value }))}
                  />
                </div>

                <input
                  className={inputClassName}
                  placeholder="Email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                />

                <input
                  className={inputClassName}
                  placeholder="Phone"
                  value={profileForm.telephone}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, telephone: event.target.value }))}
                />

                <input
                  className={inputClassName}
                  placeholder="Office"
                  value={profileForm.bureau}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, bureau: event.target.value }))}
                />

                <button
                  type="submit"
                  disabled={profileSubmitting}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
                >
                  {profileSubmitting ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            )}

            {profileData?.grade ? (
              <p className="mt-4 text-xs text-ink-tertiary">Academic Grade: {profileData.grade}</p>
            ) : null}
          </article>

          <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Security</h2>
            <p className="mt-1 text-sm text-ink-tertiary">Change your password using your current password.</p>

            <form className="mt-4 space-y-3" onSubmit={submitPasswordChange}>
              <input
                className={inputClassName}
                type="password"
                placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              />

              <input
                className={inputClassName}
                type="password"
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              />

              <input
                className={inputClassName}
                type="password"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              />

              <button
                type="submit"
                disabled={passwordSubmitting}
                className="rounded-lg border border-edge bg-surface px-4 py-2 text-sm font-semibold text-ink-secondary hover:text-ink disabled:opacity-60"
              >
                {passwordSubmitting ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </article>
        </section>
      ) : null}

      {activeTab === 'notifications' ? (
        <section className="space-y-4 rounded-2xl border border-edge bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Notifications</h2>
              <p className="mt-1 text-sm text-ink-tertiary">Stay synced with updates about announcements and reclamations.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUnreadOnly((value) => !value)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  showUnreadOnly
                    ? 'border-brand bg-brand-light text-brand'
                    : 'border-edge bg-surface text-ink-secondary hover:text-ink'
                }`}
              >
                {showUnreadOnly ? 'Unread only' : 'Show unread only'}
              </button>

              <button
                type="button"
                disabled={notificationsBusy || !unreadCount}
                onClick={markAllNotificationsAsRead}
                className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink disabled:opacity-50"
              >
                Mark all read
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-edge-subtle bg-canvas px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-ink-tertiary">Unread</p>
            <p className="mt-1 text-2xl font-bold text-ink">{unreadCount}</p>
          </div>

          <div className="divide-y divide-edge-subtle rounded-xl border border-edge-subtle bg-canvas">
            {notificationsLoading ? (
              <div className="px-4 py-10 text-center text-sm text-ink-tertiary">Loading notifications...</div>
            ) : null}

            {!notificationsLoading && !visibleNotifications.length ? (
              <div className="px-4 py-10 text-center text-sm text-ink-tertiary">No notifications available.</div>
            ) : null}

            {!notificationsLoading && visibleNotifications.map((item) => (
              <article key={item.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!item.read ? <StatusBadge status="pending" label="UNREAD" /> : <StatusBadge status="published" label="READ" />}
                    </div>
                    <p className="mt-2 font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-sm text-ink-secondary">{item.message}</p>
                    {!item.read ? (
                      <button
                        type="button"
                        onClick={() => markNotificationAsRead(item.id)}
                        disabled={notificationsBusy}
                        className="mt-2 rounded-md border border-edge px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink disabled:opacity-60"
                      >
                        Mark as read
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-ink-tertiary">{toRelativeTime(item.createdAt)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <Modal
        open={announcementModalOpen}
        onClose={() => setAnnouncementModalOpen(false)}
        title={announcementModalMode === 'create' ? 'Create Announcement' : 'Edit Announcement'}
        description="Publish course updates, add attachments, and optionally schedule publication."
        footer={(
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAnnouncementModalOpen(false)}
              className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitAnnouncement}
              disabled={announcementSubmitting}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {announcementSubmitting ? 'Saving...' : announcementModalMode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3">
          <input
            className={inputClassName}
            placeholder="Title"
            value={announcementForm.title}
            onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, title: event.target.value }))}
          />

          <textarea
            className={textareaClassName}
            placeholder="Description"
            value={announcementForm.description}
            onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, description: event.target.value }))}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <select
              className={inputClassName}
              value={announcementForm.moduleId}
              onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, moduleId: event.target.value }))}
            >
              <option value="">Select module</option>
              {moduleFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <input
              className={inputClassName}
              placeholder="Type (optional)"
              value={announcementForm.typeName}
              onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, typeName: event.target.value }))}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <select
              className={inputClassName}
              value={announcementForm.status}
              onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              {ANNOUNCEMENT_STATUS_FORM.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              className={inputClassName}
              value={announcementForm.target}
              onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, target: event.target.value }))}
            >
              {ANNOUNCEMENT_TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              className={inputClassName}
              value={announcementForm.priority}
              onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, priority: event.target.value }))}
            >
              {ANNOUNCEMENT_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-ink-secondary">
              <span>Schedule (optional)</span>
              <input
                type="datetime-local"
                className={inputClassName}
                value={announcementForm.scheduleAt}
                onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, scheduleAt: event.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm text-ink-secondary">
              <span>Expires at (optional)</span>
              <input
                type="date"
                className={inputClassName}
                value={announcementForm.expiresAt}
                onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
              />
            </label>
          </div>

          <label className="space-y-1 text-sm text-ink-secondary">
            <span>Attachments</span>
            <input
              type="file"
              multiple
              className={inputClassName}
              onChange={(event) => setAnnouncementFiles(Array.from(event.target.files || []))}
            />
          </label>

          {announcementModalMode === 'edit' && selectedAnnouncement?.attachments?.length ? (
            <div className="rounded-xl border border-edge-subtle bg-canvas px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">Current Attachments</p>
              <div className="mt-2 space-y-2">
                {selectedAnnouncement.attachments.map((attachment) => {
                  const checked = announcementForm.removeDocumentIds.includes(attachment.id);
                  return (
                    <label key={attachment.id} className="flex items-center justify-between gap-3 text-sm text-ink-secondary">
                      <span>{attachment.fileName || attachment.storedPath}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setAnnouncementForm((prev) => {
                            const current = prev.removeDocumentIds || [];
                            if (event.target.checked) {
                              return { ...prev, removeDocumentIds: Array.from(new Set([...current, attachment.id])) };
                            }
                            return { ...prev, removeDocumentIds: current.filter((item) => item !== attachment.id) };
                          });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-ink-tertiary">Check files to remove them when saving.</p>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(announcementDeleteModal)}
        onClose={() => setAnnouncementDeleteModal(null)}
        title="Delete Announcement"
        description="This action permanently removes the announcement and all linked attachments."
        maxWidth="max-w-lg"
        footer={(
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAnnouncementDeleteModal(null)}
              className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteAnnouncement}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        )}
      >
        <p className="text-sm text-ink-secondary">
          Are you sure you want to delete <span className="font-semibold text-ink">{announcementDeleteModal?.title}</span>?
        </p>
      </Modal>

      <Modal
        open={Boolean(reclamationModal)}
        onClose={() => setReclamationModal(null)}
        title="Review Reclamation"
        description="Update status, add a student-facing response, and save an internal note."
        footer={(
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setReclamationModal(null)}
              className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitReclamation}
              disabled={reclamationSubmitting}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {reclamationSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-secondary">
            <span className="font-semibold text-ink">{reclamationModal?.title}</span>
            <br />
            {reclamationModal?.description}
          </p>

          <select
            className={inputClassName}
            value={reclamationForm.status}
            onChange={(event) => setReclamationForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            {RECLAMATION_STATUS_FORM.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <textarea
            className={textareaClassName}
            placeholder="Response visible to student"
            value={reclamationForm.response}
            onChange={(event) => setReclamationForm((prev) => ({ ...prev, response: event.target.value }))}
          />

          <textarea
            className={textareaClassName}
            placeholder="Internal note (visible only to staff)"
            value={reclamationForm.internalNote}
            onChange={(event) => setReclamationForm((prev) => ({ ...prev, internalNote: event.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(studentHistoryModal)}
        onClose={() => setStudentHistoryModal(null)}
        title={`Student History${studentHistoryModal?.student ? ` - ${studentHistoryModal.student.prenom} ${studentHistoryModal.student.nom}` : ''}`}
        description="Reclamation timeline for this student in your teaching scope."
        maxWidth="max-w-3xl"
      >
        {studentHistoryLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge-strong border-t-brand" />
          </div>
        ) : (
          <div className="space-y-3">
            {(studentHistoryModal?.data?.reclamations || []).map((item) => (
              <article key={item.id} className="rounded-xl border border-edge-subtle bg-canvas px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{item.title}</p>
                  <StatusBadge status={item.status} label={String(item.status || '').toUpperCase()} />
                </div>
                <p className="mt-1 text-sm text-ink-secondary">{item.description || '-'}</p>
                <p className="mt-2 text-xs text-ink-tertiary">Response: {item.response || '-'}</p>
                <p className="text-xs text-ink-tertiary">Internal note: {item.internalNote || '-'}</p>
                <p className="text-xs text-ink-tertiary">Created: {formatDate(item.createdAt)}</p>
              </article>
            ))}

            {!studentHistoryModal?.data?.reclamations?.length ? (
              <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-ink-tertiary">
                No reclamation history available.
              </p>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        title={documentModalMode === 'create' ? 'Upload Document' : 'Edit Document'}
        description="Attach files to a module and optionally link them to an announcement."
        footer={(
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDocumentModalOpen(false)}
              className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitDocument}
              disabled={documentSubmitting}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {documentSubmitting ? 'Saving...' : documentModalMode === 'create' ? 'Upload' : 'Save'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3">
          <input
            className={inputClassName}
            placeholder="Document title"
            value={documentForm.title}
            onChange={(event) => setDocumentForm((prev) => ({ ...prev, title: event.target.value }))}
          />

          <select
            className={inputClassName}
            value={documentForm.moduleId}
            onChange={(event) => setDocumentForm((prev) => ({ ...prev, moduleId: event.target.value }))}
          >
            <option value="">No module</option>
            {moduleFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            className={inputClassName}
            value={documentForm.announcementId}
            onChange={(event) => setDocumentForm((prev) => ({ ...prev, announcementId: event.target.value }))}
          >
            <option value="">No announcement</option>
            {announcementOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.title}</option>
            ))}
          </select>

          <label className="space-y-1 text-sm text-ink-secondary">
            <span>{documentModalMode === 'create' ? 'Select file' : 'Replace file (optional)'}</span>
            <input
              type="file"
              className={inputClassName}
              onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
            />
          </label>

          {selectedDocument?.fileName && documentModalMode === 'edit' ? (
            <p className="text-xs text-ink-tertiary">Current file: {selectedDocument.fileName}</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(documentDeleteModal)}
        onClose={() => setDocumentDeleteModal(null)}
        title="Delete Document"
        description="This action permanently removes the file from the server."
        maxWidth="max-w-lg"
        footer={(
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDocumentDeleteModal(null)}
              className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteDocument}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        )}
      >
        <p className="text-sm text-ink-secondary">
          Are you sure you want to delete <span className="font-semibold text-ink">{documentDeleteModal?.title}</span>?
        </p>
      </Modal>
    </div>
  );
}

