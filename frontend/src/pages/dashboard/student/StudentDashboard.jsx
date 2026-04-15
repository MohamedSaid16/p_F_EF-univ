import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DataTable from '../../../components/admin/shared/DataTable';
import Modal from '../../../components/admin/shared/Modal';
import Pagination from '../../../components/admin/shared/Pagination';
import { notificationsAPI, studentPanelAPI } from '../../../services/api';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'reclamations', label: 'Reclamations' },
  { key: 'documents', label: 'Documents' },
  { key: 'profile', label: 'Profile' },
  { key: 'notifications', label: 'Notifications' },
];

const reclamationStatusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const documentKindOptions = [
  { value: '', label: 'All kinds' },
  { value: 'announcement', label: 'Announcement documents' },
  { value: 'reclamation', label: 'Reclamation documents' },
];

const reclamationPriorityOptions = [
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const inputClassName =
  'rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

const textareaClassName =
  'rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 min-h-[100px]';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
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
  if (status === 'approved' || status === 'published') {
    return 'bg-green-50 text-green-700';
  }

  if (status === 'pending' || status === 'scheduled') {
    return 'bg-amber-50 text-amber-700';
  }

  if (status === 'rejected') {
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

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [modules, setModules] = useState([]);

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementPagination, setAnnouncementPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [announcementTypes, setAnnouncementTypes] = useState([]);
  const [announcementFilters, setAnnouncementFilters] = useState({
    search: '',
    moduleId: '',
    typeId: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 10,
  });
  const [announcementDetail, setAnnouncementDetail] = useState(null);
  const [announcementDetailLoading, setAnnouncementDetailLoading] = useState(false);

  const [reclamationsLoading, setReclamationsLoading] = useState(false);
  const [reclamations, setReclamations] = useState([]);
  const [reclamationPagination, setReclamationPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [reclamationTypes, setReclamationTypes] = useState([]);
  const [reclamationFilters, setReclamationFilters] = useState({
    search: '',
    status: '',
    typeId: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 10,
  });
  const [reclamationModalOpen, setReclamationModalOpen] = useState(false);
  const [reclamationSubmitting, setReclamationSubmitting] = useState(false);
  const [reclamationForm, setReclamationForm] = useState({
    title: '',
    description: '',
    typeId: '',
    priority: 'normal',
  });
  const [reclamationFiles, setReclamationFiles] = useState([]);
  const [selectedReclamation, setSelectedReclamation] = useState(null);
  const [reclamationDetailLoading, setReclamationDetailLoading] = useState(false);

  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsPagination, setDocumentsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [documentFilters, setDocumentFilters] = useState({
    search: '',
    kind: '',
    page: 1,
    limit: 10,
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileForm, setProfileForm] = useState({
    email: '',
    telephone: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

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
      const response = await studentPanelAPI.getDashboard();
      const data = response?.data || null;
      setDashboardData(data);
      setModules(Array.isArray(data?.modules) ? data.modules : []);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load dashboard.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadReclamationTypes = useCallback(async () => {
    try {
      const response = await studentPanelAPI.getReclamationTypes();
      const rows = Array.isArray(response?.data) ? response.data : [];
      setReclamationTypes(rows);
    } catch (_error) {
      setReclamationTypes([]);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    setError('');

    try {
      const response = await studentPanelAPI.getAnnouncements({
        search: announcementFilters.search,
        moduleId: announcementFilters.moduleId || undefined,
        typeId: announcementFilters.typeId || undefined,
        dateFrom: announcementFilters.dateFrom || undefined,
        dateTo: announcementFilters.dateTo || undefined,
        page: announcementFilters.page,
        limit: announcementFilters.limit,
      });

      setAnnouncements(Array.isArray(response?.data) ? response.data : []);
      setAnnouncementPagination(response?.pagination || { page: 1, totalPages: 1, total: 0 });
      setModules(Array.isArray(response?.modules) ? response.modules : []);
      setAnnouncementTypes(Array.isArray(response?.types) ? response.types : []);
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
      const response = await studentPanelAPI.getReclamations({
        search: reclamationFilters.search,
        status: reclamationFilters.status || undefined,
        typeId: reclamationFilters.typeId || undefined,
        dateFrom: reclamationFilters.dateFrom || undefined,
        dateTo: reclamationFilters.dateTo || undefined,
        page: reclamationFilters.page,
        limit: reclamationFilters.limit,
      });

      setReclamations(Array.isArray(response?.data) ? response.data : []);
      setReclamationPagination(response?.pagination || { page: 1, totalPages: 1, total: 0 });
      if (Array.isArray(response?.types) && response.types.length > 0) {
        setReclamationTypes(response.types);
      }
    } catch (loadError) {
      setError(loadError.message || 'Failed to load reclamations.');
    } finally {
      setReclamationsLoading(false);
    }
  }, [reclamationFilters]);

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setError('');

    try {
      const response = await studentPanelAPI.getDocuments({
        search: documentFilters.search,
        kind: documentFilters.kind || undefined,
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

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setError('');

    try {
      const response = await studentPanelAPI.getProfile();
      const data = response?.data || null;
      setProfileData(data);
      setProfileForm({
        email: data?.email || '',
        telephone: data?.telephone || '',
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
      setNotifications(Array.isArray(response?.data) ? response.data : []);
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
      loadReclamationTypes();
      loadReclamations();
    }
  }, [activeTab, loadReclamationTypes, loadReclamations]);

  useEffect(() => {
    if (activeTab === 'documents') {
      loadDocuments();
    }
  }, [activeTab, loadDocuments]);

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

  const openAnnouncementDetails = async (announcementId) => {
    setAnnouncementDetailLoading(true);
    setError('');

    try {
      const response = await studentPanelAPI.getAnnouncementDetails(announcementId);
      setAnnouncementDetail(response?.data || null);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load announcement details.');
      setAnnouncementDetail(null);
    } finally {
      setAnnouncementDetailLoading(false);
    }
  };

  const downloadAnnouncementAttachment = async (announcementId, documentId) => {
    setError('');

    try {
      const { blob, fileName } = await studentPanelAPI.downloadAnnouncementDocument(
        announcementId,
        documentId
      );
      triggerDownload(blob, fileName);
    } catch (downloadError) {
      setError(downloadError.message || 'Failed to download file.');
    }
  };

  const submitReclamation = async () => {
    setReclamationSubmitting(true);
    setError('');

    try {
      const payload = new FormData();
      payload.append('title', reclamationForm.title);
      payload.append('description', reclamationForm.description);
      payload.append('priority', reclamationForm.priority);

      if (reclamationForm.typeId) {
        payload.append('typeId', String(reclamationForm.typeId));
      }

      reclamationFiles.forEach((file) => {
        payload.append('files', file);
      });

      await studentPanelAPI.createReclamation(payload);
      setSuccessMessage('Reclamation submitted successfully.');
      setReclamationModalOpen(false);
      setReclamationForm({
        title: '',
        description: '',
        typeId: '',
        priority: 'normal',
      });
      setReclamationFiles([]);
      await Promise.all([loadReclamations(), loadDashboard()]);
    } catch (submitError) {
      setError(submitError.message || 'Failed to submit reclamation.');
    } finally {
      setReclamationSubmitting(false);
    }
  };

  const openReclamationDetails = async (reclamationId) => {
    setReclamationDetailLoading(true);
    setError('');

    try {
      const response = await studentPanelAPI.getReclamationDetails(reclamationId);
      setSelectedReclamation(response?.data || null);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load reclamation details.');
      setSelectedReclamation(null);
    } finally {
      setReclamationDetailLoading(false);
    }
  };

  const downloadReclamationAttachment = async (reclamationId, documentId) => {
    setError('');

    try {
      const { blob, fileName } = await studentPanelAPI.downloadReclamationDocument(
        reclamationId,
        documentId
      );
      triggerDownload(blob, fileName);
    } catch (downloadError) {
      setError(downloadError.message || 'Failed to download file.');
    }
  };

  const downloadDocument = async (kind, documentId) => {
    setError('');

    try {
      const { blob, fileName } = await studentPanelAPI.downloadDocument(kind, documentId);
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
      const response = await studentPanelAPI.updateProfile(profileForm);
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
      await studentPanelAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
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

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
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
          <p className="mt-1 text-xs text-ink-tertiary">
            {row.module?.name || 'General'} {row.module?.code ? `(${row.module.code})` : ''}
          </p>
          <p className="mt-1 text-xs text-ink-tertiary">{row.type?.name || 'General'}</p>
        </div>
      ),
    },
    {
      key: 'publishedAt',
      label: 'Published',
      render: (row) => <p className="text-xs text-ink-tertiary">{formatDate(row.publishedAt)}</p>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={String(row.status || '').toUpperCase()} />
      ),
    },
    {
      key: 'attachments',
      label: 'Files',
      render: (row) => (
        <p className="text-xs text-ink-tertiary">{Array.isArray(row.attachments) ? row.attachments.length : 0}</p>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          type="button"
          onClick={() => openAnnouncementDetails(row.id)}
          className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
        >
          View details
        </button>
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
          <p className="mt-1 text-xs text-ink-tertiary">{row.type?.name || 'General'}</p>
          <p className="mt-1 text-xs text-ink-tertiary">Created: {formatDate(row.createdAt)}</p>
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
      key: 'response',
      label: 'Admin Response',
      render: (row) => (
        <p className="text-xs text-ink-secondary line-clamp-2">{row.adminResponse || 'No response yet.'}</p>
      ),
    },
    {
      key: 'attachments',
      label: 'Files',
      render: (row) => (
        <p className="text-xs text-ink-tertiary">{Array.isArray(row.attachments) ? row.attachments.length : 0}</p>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          type="button"
          onClick={() => openReclamationDetails(row.id)}
          className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
        >
          View
        </button>
      ),
    },
  ];

  const documentColumns = [
    {
      key: 'fileName',
      label: 'File',
      render: (row) => (
        <div>
          <p className="font-semibold text-ink">{row.fileName}</p>
          <p className="mt-1 text-xs text-ink-tertiary">{row.sourceTitle}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      label: 'Kind',
      render: (row) => (
        <StatusBadge
          status={row.kind === 'announcement' ? 'published' : 'pending'}
          label={row.kind === 'announcement' ? 'ANNOUNCEMENT' : 'RECLAMATION'}
        />
      ),
    },
    {
      key: 'module',
      label: 'Module',
      render: (row) => (
        <p className="text-xs text-ink-tertiary">
          {row.module?.name ? `${row.module.name} (${row.module.code || ''})` : '-'}
        </p>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (row) => <p className="text-xs text-ink-tertiary">{formatDate(row.createdAt)}</p>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          type="button"
          onClick={() => downloadDocument(row.kind, row.numericId)}
          className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
        >
          Download
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.20),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.20),transparent_35%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Student Workspace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Academic Control Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary md:text-base">
            Review announcements, submit and track reclamations, download your files, and manage your profile from one secure interface.
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              title="Announcements"
              value={dashboardLoading ? '...' : dashboardData?.summary?.announcements ?? 0}
              subtitle="Published announcements available to you"
            />
            <StatCard
              title="Reclamations"
              value={dashboardLoading ? '...' : dashboardData?.summary?.reclamations ?? 0}
              subtitle="Total reclamations submitted by you"
            />
            <StatCard
              title="Pending"
              value={dashboardLoading ? '...' : dashboardData?.summary?.pendingReclamations ?? 0}
              subtitle="Reclamations waiting for resolution"
            />
            <StatCard
              title="Documents"
              value={dashboardLoading ? '...' : dashboardData?.summary?.documents ?? 0}
              subtitle="Downloadable files across announcements and reclamations"
            />
            <StatCard
              title="Unread Notifications"
              value={dashboardLoading ? '...' : dashboardData?.summary?.unreadNotifications ?? 0}
              subtitle="Updates requiring your attention"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Recent Announcements</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('announcements')}
                  className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
                >
                  View all
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {(dashboardData?.recentAnnouncements || []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-edge-subtle bg-canvas px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{item.title}</p>
                        <p className="mt-1 text-xs text-ink-tertiary">
                          {item.module?.name || 'General'} {item.module?.code ? `(${item.module.code})` : ''}
                        </p>
                      </div>
                      <StatusBadge status={item.status} label={String(item.status || '').toUpperCase()} />
                    </div>
                    <p className="mt-2 text-xs text-ink-tertiary">Published: {formatDate(item.publishedAt)}</p>
                  </div>
                ))}

                {!dashboardData?.recentAnnouncements?.length ? (
                  <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-ink-tertiary">
                    No announcements available.
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
                {(dashboardData?.recentReclamations || []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-edge-subtle bg-canvas px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{item.title}</p>
                        <p className="mt-1 text-xs text-ink-tertiary">{item.type?.name || 'General'}</p>
                      </div>
                      <StatusBadge status={item.status} label={String(item.status || '').toUpperCase()} />
                    </div>
                    <p className="mt-2 text-xs text-ink-tertiary">Submitted: {formatDate(item.createdAt)}</p>
                  </div>
                ))}

                {!dashboardData?.recentReclamations?.length ? (
                  <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-ink-tertiary">
                    No reclamations submitted yet.
                  </p>
                ) : null}
              </div>
            </article>
          </div>

          <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Your Modules</h2>
            <p className="mt-1 text-sm text-ink-tertiary">Modules linked to your current teaching assignments.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => (
                <div key={module.moduleId} className="rounded-xl border border-edge-subtle bg-canvas px-4 py-3">
                  <p className="font-semibold text-ink">{module.moduleName}</p>
                  <p className="text-xs text-ink-tertiary">{module.moduleCode}</p>
                </div>
              ))}
              {!modules.length ? (
                <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-ink-tertiary md:col-span-2 xl:col-span-3">
                  No module data available for your account.
                </p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'announcements' ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-edge bg-surface p-4 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Announcements</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input
                value={announcementFilters.search}
                onChange={(event) =>
                  setAnnouncementFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))
                }
                placeholder="Search by title, content, module"
                className={`${inputClassName} xl:col-span-2`}
              />

              <select
                value={announcementFilters.moduleId}
                onChange={(event) =>
                  setAnnouncementFilters((prev) => ({ ...prev, moduleId: event.target.value, page: 1 }))
                }
                className={inputClassName}
              >
                <option value="">All subjects</option>
                {modules.map((module) => (
                  <option key={module.moduleId} value={module.moduleId}>
                    {module.moduleName} ({module.moduleCode})
                  </option>
                ))}
              </select>

              <select
                value={announcementFilters.typeId}
                onChange={(event) =>
                  setAnnouncementFilters((prev) => ({ ...prev, typeId: event.target.value, page: 1 }))
                }
                className={inputClassName}
              >
                <option value="">All types</option>
                {announcementTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>

              <input
                type="date"
                value={announcementFilters.dateFrom}
                onChange={(event) =>
                  setAnnouncementFilters((prev) => ({ ...prev, dateFrom: event.target.value, page: 1 }))
                }
                className={inputClassName}
              />

              <input
                type="date"
                value={announcementFilters.dateTo}
                onChange={(event) =>
                  setAnnouncementFilters((prev) => ({ ...prev, dateTo: event.target.value, page: 1 }))
                }
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
            page={announcementPagination.page || 1}
            totalPages={announcementPagination.totalPages || 1}
            onPageChange={(page) => setAnnouncementFilters((prev) => ({ ...prev, page }))}
          />
        </section>
      ) : null}

      {activeTab === 'reclamations' ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-edge bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">My Reclamations</h2>
              <button
                type="button"
                onClick={() => setReclamationModalOpen(true)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                New Reclamation
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input
                value={reclamationFilters.search}
                onChange={(event) =>
                  setReclamationFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))
                }
                placeholder="Search title or description"
                className={`${inputClassName} xl:col-span-2`}
              />

              <select
                value={reclamationFilters.status}
                onChange={(event) =>
                  setReclamationFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))
                }
                className={inputClassName}
              >
                {reclamationStatusOptions.map((option) => (
                  <option key={option.value || 'status-all'} value={option.value}>{option.label}</option>
                ))}
              </select>

              <select
                value={reclamationFilters.typeId}
                onChange={(event) =>
                  setReclamationFilters((prev) => ({ ...prev, typeId: event.target.value, page: 1 }))
                }
                className={inputClassName}
              >
                <option value="">All types</option>
                {reclamationTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>

              <input
                type="date"
                value={reclamationFilters.dateFrom}
                onChange={(event) =>
                  setReclamationFilters((prev) => ({ ...prev, dateFrom: event.target.value, page: 1 }))
                }
                className={inputClassName}
              />

              <input
                type="date"
                value={reclamationFilters.dateTo}
                onChange={(event) =>
                  setReclamationFilters((prev) => ({ ...prev, dateTo: event.target.value, page: 1 }))
                }
                className={inputClassName}
              />
            </div>
          </div>

          <DataTable
            columns={reclamationColumns}
            rows={reclamations}
            loading={reclamationsLoading}
            emptyMessage="No reclamations found."
          />

          <Pagination
            page={reclamationPagination.page || 1}
            totalPages={reclamationPagination.totalPages || 1}
            onPageChange={(page) => setReclamationFilters((prev) => ({ ...prev, page }))}
          />
        </section>
      ) : null}

      {activeTab === 'documents' ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-edge bg-surface p-4 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Documents</h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={documentFilters.search}
                onChange={(event) =>
                  setDocumentFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))
                }
                placeholder="Search by file name or source"
                className={`${inputClassName} xl:col-span-2`}
              />

              <select
                value={documentFilters.kind}
                onChange={(event) =>
                  setDocumentFilters((prev) => ({ ...prev, kind: event.target.value, page: 1 }))
                }
                className={inputClassName}
              >
                {documentKindOptions.map((option) => (
                  <option key={option.value || 'kind-all'} value={option.value}>{option.label}</option>
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
            <h2 className="text-lg font-semibold text-ink">Profile Information</h2>
            <p className="mt-1 text-sm text-ink-tertiary">Update your contact details.</p>

            {profileLoading ? (
              <div className="mt-4 h-10 w-10 animate-spin rounded-full border-2 border-edge-strong border-t-brand" />
            ) : (
              <form className="mt-4 space-y-3" onSubmit={submitProfile}>
                <input
                  className={inputClassName}
                  value={profileData?.nom ? `${profileData.prenom || ''} ${profileData.nom || ''}`.trim() : ''}
                  readOnly
                />

                <input
                  className={inputClassName}
                  placeholder="Email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                />

                <input
                  className={inputClassName}
                  placeholder="Phone"
                  value={profileForm.telephone}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, telephone: event.target.value }))
                  }
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

            {profileData?.matricule ? (
              <p className="mt-4 text-xs text-ink-tertiary">Matricule: {profileData.matricule}</p>
            ) : null}
            {profileData?.promo?.nom ? (
              <p className="text-xs text-ink-tertiary">
                Promo: {profileData.promo.nom} {profileData.promo.section ? `(${profileData.promo.section})` : ''}
              </p>
            ) : null}
          </article>

          <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Security</h2>
            <p className="mt-1 text-sm text-ink-tertiary">Change your password securely.</p>

            <form className="mt-4 space-y-3" onSubmit={submitPasswordChange}>
              <input
                className={inputClassName}
                type="password"
                placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                }
              />

              <input
                className={inputClassName}
                type="password"
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                }
              />

              <input
                className={inputClassName}
                type="password"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
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
              <p className="mt-1 text-sm text-ink-tertiary">Updates for announcements and reclamation decisions.</p>
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

            {!notificationsLoading &&
              visibleNotifications.map((item) => (
                <article key={item.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {!item.read ? (
                        <StatusBadge status="pending" label="UNREAD" />
                      ) : (
                        <StatusBadge status="published" label="READ" />
                      )}

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
        open={Boolean(announcementDetail) || announcementDetailLoading}
        onClose={() => setAnnouncementDetail(null)}
        title="Announcement Details"
        description="Review full announcement details and download attached files."
        maxWidth="max-w-3xl"
      >
        {announcementDetailLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge-strong border-t-brand" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">{announcementDetail?.title}</h3>
              <p className="mt-2 text-sm text-ink-secondary">{announcementDetail?.description}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-xs text-ink-tertiary">
              <p>Published: {formatDate(announcementDetail?.publishedAt)}</p>
              <p>Type: {announcementDetail?.type?.name || 'General'}</p>
              <p>
                Subject: {announcementDetail?.module?.name || 'General'}{' '}
                {announcementDetail?.module?.code ? `(${announcementDetail.module.code})` : ''}
              </p>
              <p>Status: {announcementDetail?.status || '-'}</p>
            </div>

            <div className="rounded-xl border border-edge-subtle bg-canvas p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">Attachments</p>
              <div className="mt-3 space-y-2">
                {(announcementDetail?.attachments || []).map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{attachment.fileName}</p>
                      <p className="text-xs text-ink-tertiary">{formatDate(attachment.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadAnnouncementAttachment(announcementDetail.id, attachment.id)
                      }
                      className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
                    >
                      Download
                    </button>
                  </div>
                ))}

                {!announcementDetail?.attachments?.length ? (
                  <p className="text-sm text-ink-tertiary">No attachments for this announcement.</p>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={reclamationModalOpen}
        onClose={() => setReclamationModalOpen(false)}
        title="New Reclamation"
        description="Submit a reclamation with optional supporting documents."
        footer={(
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setReclamationModalOpen(false)}
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
              {reclamationSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3">
          <input
            className={inputClassName}
            placeholder="Reclamation title"
            value={reclamationForm.title}
            onChange={(event) =>
              setReclamationForm((prev) => ({ ...prev, title: event.target.value }))
            }
          />

          <select
            className={inputClassName}
            value={reclamationForm.typeId}
            onChange={(event) =>
              setReclamationForm((prev) => ({ ...prev, typeId: event.target.value }))
            }
          >
            <option value="">Select reclamation type</option>
            {reclamationTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>

          <select
            className={inputClassName}
            value={reclamationForm.priority}
            onChange={(event) =>
              setReclamationForm((prev) => ({ ...prev, priority: event.target.value }))
            }
          >
            {reclamationPriorityOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <textarea
            className={textareaClassName}
            placeholder="Describe your issue in detail"
            value={reclamationForm.description}
            onChange={(event) =>
              setReclamationForm((prev) => ({ ...prev, description: event.target.value }))
            }
          />

          <label className="space-y-1 text-sm text-ink-secondary">
            <span>Supporting files</span>
            <input
              type="file"
              multiple
              className={inputClassName}
              onChange={(event) => setReclamationFiles(Array.from(event.target.files || []))}
            />
          </label>

          {reclamationFiles.length ? (
            <div className="rounded-xl border border-edge-subtle bg-canvas p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">Selected files</p>
              <div className="mt-2 space-y-1">
                {reclamationFiles.map((file) => (
                  <p key={`${file.name}-${file.size}`} className="text-sm text-ink-secondary">
                    {file.name} ({formatFileSize(file.size)})
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedReclamation) || reclamationDetailLoading}
        onClose={() => setSelectedReclamation(null)}
        title="Reclamation Details"
        description="Track status and read the latest administration response."
        maxWidth="max-w-3xl"
      >
        {reclamationDetailLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge-strong border-t-brand" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">{selectedReclamation?.title}</h3>
              <p className="mt-2 text-sm text-ink-secondary">{selectedReclamation?.description}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-xs text-ink-tertiary">
              <p>Status: {selectedReclamation?.status || '-'}</p>
              <p>Type: {selectedReclamation?.type?.name || 'General'}</p>
              <p>Priority: {selectedReclamation?.priority || '-'}</p>
              <p>Submitted: {formatDate(selectedReclamation?.createdAt)}</p>
            </div>

            <div className="rounded-xl border border-edge-subtle bg-canvas p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">Admin response</p>
              <p className="mt-2 text-sm text-ink-secondary">
                {selectedReclamation?.adminResponse || 'No response yet.'}
              </p>
            </div>

            <div className="rounded-xl border border-edge-subtle bg-canvas p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">Attachments</p>
              <div className="mt-3 space-y-2">
                {(selectedReclamation?.attachments || []).map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{attachment.fileName}</p>
                      <p className="text-xs text-ink-tertiary">
                        {formatFileSize(attachment.fileSize)} · {formatDate(attachment.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadReclamationAttachment(selectedReclamation.id, attachment.id)
                      }
                      className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
                    >
                      Download
                    </button>
                  </div>
                ))}

                {!selectedReclamation?.attachments?.length ? (
                  <p className="text-sm text-ink-tertiary">No attachments uploaded for this reclamation.</p>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

