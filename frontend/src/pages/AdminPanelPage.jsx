import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminPanelAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import DataTable from '../components/admin/shared/DataTable';
import Modal from '../components/admin/shared/Modal';
import Pagination from '../components/admin/shared/Pagination';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'reclamations', label: 'Reclamations' },
  { key: 'documents', label: 'Documents' },
  { key: 'audit', label: 'Audit Logs' },
];

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
];

const USER_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const ANNOUNCEMENT_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const ANNOUNCEMENT_STATUS_FORM_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const ANNOUNCEMENT_TARGET_OPTIONS = [
  { value: '', label: 'All targets' },
  { value: 'all', label: 'All' },
  { value: 'students', label: 'Students' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'administration', label: 'Administration' },
];

const ANNOUNCEMENT_TARGET_FORM_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'students', label: 'Students' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'administration', label: 'Administration' },
];

const ANNOUNCEMENT_PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const RECLAMATION_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const DOCUMENT_KIND_OPTIONS = [
  { value: '', label: 'All kinds' },
  { value: 'announcement', label: 'Announcement attachments' },
  { value: 'request', label: 'Request documents' },
  { value: 'justification', label: 'Justification documents' },
];

const inputClassName = 'rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
const selectClassName = 'rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatTokenLabel(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '-';

  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeStatusClass(status) {
  if (status === 'active' || status === 'approved' || status === 'published') {
    return 'bg-green-50 text-green-700 border-edge-strong';
  }

  if (status === 'pending' || status === 'draft' || status === 'inactive') {
    return 'bg-amber-50 text-amber-700 border-edge-strong';
  }

  if (status === 'rejected' || status === 'suspended' || status === 'archived') {
    return 'bg-red-50 text-red-700 border-edge-strong';
  }

  return 'bg-blue-50 text-blue-700 border-edge-strong';
}

function mapRoleFilterToApi(roleValue) {
  if (roleValue === 'teacher') return 'enseignant';
  if (roleValue === 'student') return 'etudiant';
  if (roleValue === 'admin') return 'admin';
  return roleValue;
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
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${normalizeStatusClass(status)}`}>
      {label}
    </span>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">{title}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink-secondary">{subtitle}</p>
    </div>
  );
}

function PercentageBar({ label, value, total, colorClass }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-ink-tertiary">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-300">
        <div className={`h-full ${colorClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default function AdminPanelPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersFilters, setUsersFilters] = useState({
    search: '',
    status: '',
    role: '',
    page: 1,
    limit: 10,
  });
  const [roleDrafts, setRoleDrafts] = useState({});
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [deleteUserModal, setDeleteUserModal] = useState(null);

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsPagination, setAnnouncementsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementFilters, setAnnouncementFilters] = useState({
    search: '',
    status: '',
    target: '',
    page: 1,
    limit: 10,
  });
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementModalMode, setAnnouncementModalMode] = useState('create');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementDeleteModal, setAnnouncementDeleteModal] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    typeName: '',
    status: 'published',
    target: 'all',
    priority: 'normal',
    expiresAt: '',
    removeDocumentIds: [],
  });
  const [announcementFiles, setAnnouncementFiles] = useState([]);

  const [reclamations, setReclamations] = useState([]);
  const [reclamationsPagination, setReclamationsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [reclamationsLoading, setReclamationsLoading] = useState(false);
  const [reclamationFilters, setReclamationFilters] = useState({
    search: '',
    status: '',
    page: 1,
    limit: 10,
  });
  const [reclamationModal, setReclamationModal] = useState(null);
  const [reclamationSubmitting, setReclamationSubmitting] = useState(false);
  const [reclamationForm, setReclamationForm] = useState({
    status: 'pending',
    adminResponse: '',
  });
  const [workflowModal, setWorkflowModal] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState('');

  const [documents, setDocuments] = useState([]);
  const [documentsPagination, setDocumentsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentFilters, setDocumentFilters] = useState({
    search: '',
    kind: '',
    page: 1,
    limit: 10,
  });
  const [documentDeleteModal, setDocumentDeleteModal] = useState(null);
  const [documentActionLoading, setDocumentActionLoading] = useState(null);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    eventKey: '',
    action: '',
    entityType: '',
    entityId: '',
    actorUserId: '',
    from: '',
    to: '',
    page: 1,
    limit: 20,
  });

  const userRoles = useMemo(
    () => (Array.isArray(user?.roles) ? user.roles.map((role) => String(role || '').trim().toLowerCase()) : []),
    [user?.roles]
  );

  const canViewRequestWorkflow = userRoles.includes('admin') || userRoles.includes('vice_doyen');

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setError('');

    try {
      const response = await adminPanelAPI.getOverview();
      setOverview(response?.data || null);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load dashboard overview.');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setError('');

    try {
      const response = await adminPanelAPI.getUsers({
        search: usersFilters.search,
        status: usersFilters.status,
        role: mapRoleFilterToApi(usersFilters.role),
        page: usersFilters.page,
        limit: usersFilters.limit,
      });

      const items = Array.isArray(response?.data) ? response.data : [];
      setUsers(items);
      setUsersPagination(response?.pagination || { page: 1, totalPages: 1, total: 0 });
      setRoleDrafts((previous) => {
        const next = { ...previous };
        items.forEach((item) => {
          next[item.id] = item.role || 'student';
        });
        return next;
      });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, [usersFilters]);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    setError('');

    try {
      const response = await adminPanelAPI.getAnnouncements({
        search: announcementFilters.search,
        status: announcementFilters.status,
        target: announcementFilters.target,
        page: announcementFilters.page,
        limit: announcementFilters.limit,
      });

      setAnnouncements(Array.isArray(response?.data) ? response.data : []);
      setAnnouncementsPagination(response?.pagination || { page: 1, totalPages: 1, total: 0 });
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
      const response = await adminPanelAPI.getReclamations({
        search: reclamationFilters.search,
        status: reclamationFilters.status,
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

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setError('');

    try {
      const response = await adminPanelAPI.getDocuments({
        search: documentFilters.search,
        kind: documentFilters.kind,
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

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setError('');

    try {
      const response = await adminPanelAPI.getAuditLogs({
        eventKey: auditFilters.eventKey,
        action: auditFilters.action,
        entityType: auditFilters.entityType,
        entityId: auditFilters.entityId,
        actorUserId: auditFilters.actorUserId ? Number(auditFilters.actorUserId) : undefined,
        from: auditFilters.from,
        to: auditFilters.to,
        page: auditFilters.page,
        limit: auditFilters.limit,
      });

      setAuditLogs(Array.isArray(response?.data) ? response.data : []);
      setAuditPagination(response?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load audit logs.');
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilters]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadOverview();
    }
  }, [activeTab, loadOverview]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab, loadUsers]);

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
    if (activeTab === 'documents') {
      loadDocuments();
    }
  }, [activeTab, loadDocuments]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, loadAuditLogs]);

  const openCreateAnnouncementModal = () => {
    setAnnouncementModalMode('create');
    setSelectedAnnouncement(null);
    setAnnouncementForm({
      title: '',
      content: '',
      typeName: '',
      status: 'published',
      target: 'all',
      priority: 'normal',
      expiresAt: '',
      removeDocumentIds: [],
    });
    setAnnouncementFiles([]);
    setAnnouncementModalOpen(true);
  };

  const openEditAnnouncementModal = (announcement) => {
    setAnnouncementModalMode('edit');
    setSelectedAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title || '',
      content: announcement.content || '',
      typeName: announcement.type?.name || '',
      status: announcement.status || 'published',
      target: announcement.target || 'all',
      priority: announcement.priority || 'normal',
      expiresAt: announcement.expiresAt ? new Date(announcement.expiresAt).toISOString().slice(0, 10) : '',
      removeDocumentIds: [],
    });
    setAnnouncementFiles([]);
    setAnnouncementModalOpen(true);
  };

  const openReclamationWorkflow = useCallback(async (reclamation) => {
    setWorkflowModal(reclamation);
    setWorkflowData(null);
    setWorkflowError('');
    setWorkflowLoading(true);

    try {
      const response = await adminPanelAPI.getRequestWorkflowHistory('reclamation', reclamation.id);
      setWorkflowData(response?.data || null);
    } catch (loadError) {
      setWorkflowError(loadError.message || 'Failed to load workflow history.');
    } finally {
      setWorkflowLoading(false);
    }
  }, []);

  const usersColumns = useMemo(() => [
    {
      key: 'identity',
      label: 'User',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.prenom} {row.nom}</p>
          <p className="text-xs text-ink-tertiary">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <select
          value={roleDrafts[row.id] || row.role || 'student'}
          onChange={(event) => setRoleDrafts((previous) => ({ ...previous, [row.id]: event.target.value }))}
          className={`${selectClassName} min-w-[140px]`}
          disabled={updatingUserId === row.id}
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} label={row.status} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => <span className="text-xs text-ink-tertiary">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const nextRole = roleDrafts[row.id] || row.role || 'student';
              try {
                setUpdatingUserId(row.id);
                setError('');
                await adminPanelAPI.updateUserRole(row.id, nextRole);
                setSuccessMessage('User role updated successfully.');
                await loadUsers();
              } catch (updateError) {
                setError(updateError.message || 'Failed to update user role.');
              } finally {
                setUpdatingUserId(null);
              }
            }}
            disabled={updatingUserId === row.id}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setDeleteUserModal(row)}
            className="rounded-md border border-edge-strong bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      ),
    },
  ], [roleDrafts, updatingUserId, loadUsers]);

  const announcementsColumns = useMemo(() => [
    {
      key: 'title',
      label: 'Title',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.title}</p>
          <p className="text-xs text-ink-tertiary line-clamp-2">{row.content}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} label={row.status} />,
    },
    {
      key: 'target',
      label: 'Target',
      render: (row) => <span className="capitalize text-xs text-ink-secondary">{row.target}</span>,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => <span className="capitalize text-xs text-ink-secondary">{row.priority}</span>,
    },
    {
      key: 'documents',
      label: 'Attachments',
      render: (row) => <span className="text-xs text-ink-tertiary">{row.attachmentCount || 0}</span>,
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      render: (row) => <span className="text-xs text-ink-tertiary">{formatDate(row.updatedAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openEditAnnouncementModal(row)}
            className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-200"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setAnnouncementDeleteModal(row)}
            className="rounded-md border border-edge-strong bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      ),
    },
  ], []);

  const reclamationsColumns = useMemo(() => [
    {
      key: 'title',
      label: 'Reclamation',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.title}</p>
          <p className="text-xs text-ink-tertiary line-clamp-2">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'student',
      label: 'Student',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-ink">{row.student?.prenom} {row.student?.nom}</p>
          <p className="text-xs text-ink-tertiary">{row.student?.email}</p>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => <span className="text-xs text-ink-secondary">{row.type}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} label={row.status} />,
    },
    {
      key: 'submittedAt',
      label: 'Submitted',
      render: (row) => <span className="text-xs text-ink-tertiary">{formatDate(row.submittedAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setReclamationModal(row);
              setReclamationForm({
                status: row.status,
                adminResponse: row.adminResponse || '',
              });
            }}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover"
          >
            Update status
          </button>

          {canViewRequestWorkflow ? (
            <button
              type="button"
              onClick={() => {
                openReclamationWorkflow(row);
              }}
              className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-200"
            >
              Workflow
            </button>
          ) : null}
        </div>
      ),
    },
  ], [canViewRequestWorkflow, openReclamationWorkflow]);

  const documentsColumns = useMemo(() => [
    {
      key: 'fileName',
      label: 'File',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.fileName}</p>
          <p className="text-xs text-ink-tertiary">{row.storedPath}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      label: 'Kind',
      render: (row) => <span className="capitalize text-xs text-ink-secondary">{row.kind}</span>,
    },
    {
      key: 'linkedEntity',
      label: 'Linked to',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-ink">{row.linkedEntity?.title}</p>
          <p className="text-xs text-ink-tertiary">{row.linkedEntity?.type} #{row.linkedEntity?.id}</p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Uploaded',
      render: (row) => <span className="text-xs text-ink-tertiary">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                setDocumentActionLoading(`download-${row.id}`);
                setError('');
                const result = await adminPanelAPI.downloadDocument(row.kind, row.numericId);
                triggerDownload(result.blob, result.fileName || row.fileName);
              } catch (downloadError) {
                setError(downloadError.message || 'Failed to download document.');
              } finally {
                setDocumentActionLoading(null);
              }
            }}
            disabled={documentActionLoading === `download-${row.id}`}
            className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download
          </button>
          <button
            type="button"
            onClick={() => setDocumentDeleteModal(row)}
            disabled={documentActionLoading === `download-${row.id}`}
            className="rounded-md border border-edge-strong bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      ),
    },
  ], [documentActionLoading]);

  const auditColumns = useMemo(() => [
    {
      key: 'createdAt',
      label: 'Time',
      render: (row) => <span className="text-xs text-ink-tertiary">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'eventKey',
      label: 'Event',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.eventKey || '-'}</p>
          <p className="text-xs text-ink-tertiary">{formatTokenLabel(row.action)}</p>
        </div>
      ),
    },
    {
      key: 'entity',
      label: 'Entity',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-ink">{row.entityType || '-'}</p>
          <p className="text-xs text-ink-tertiary">{row.entityId || '-'}</p>
        </div>
      ),
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-ink">{row.actorUserId ? `User #${row.actorUserId}` : 'System'}</p>
          <p className="text-xs text-ink-tertiary">
            {Array.isArray(row.actorRoles) && row.actorRoles.length > 0 ? row.actorRoles.join(', ') : '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'requestPath',
      label: 'Request',
      render: (row) => (
        <div>
          <p className="text-xs font-medium text-ink">{row.requestMethod || '-'}</p>
          <p className="max-w-[260px] truncate text-xs text-ink-tertiary" title={row.requestPath || ''}>{row.requestPath || '-'}</p>
        </div>
      ),
    },
    {
      key: 'payload',
      label: 'Payload',
      render: (row) => {
        const payload = row.payload && typeof row.payload === 'object' ? JSON.stringify(row.payload, null, 2) : '';

        if (!payload) {
          return <span className="text-xs text-ink-tertiary">-</span>;
        }

        return (
          <details className="max-w-[320px]">
            <summary className="cursor-pointer text-xs font-medium text-brand">View</summary>
            <pre className="mt-1 max-h-32 overflow-auto rounded-md border border-edge-subtle bg-surface-200/60 p-2 text-[11px] text-ink-secondary whitespace-pre-wrap break-words">
              {payload}
            </pre>
          </details>
        );
      },
    },
  ], []);

  const dashboardContent = (
    <div className="space-y-5">
      {loadingOverview && (
        <div className="rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-tertiary">
          Loading dashboard metrics...
        </div>
      )}

      {!loadingOverview && overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Total Users" value={overview.totals.users} subtitle="All accounts in the platform" />
            <StatCard title="Announcements" value={overview.totals.announcements} subtitle="Published, draft, and archived" />
            <StatCard title="Reclamations" value={overview.totals.reclamations} subtitle="All complaint records" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-ink">Users by status</h3>
              <div className="mt-4 space-y-3">
                <PercentageBar label="Active" value={overview.usersByStatus.active} total={overview.totals.users} colorClass="bg-green-500" />
                <PercentageBar label="Inactive" value={overview.usersByStatus.inactive} total={overview.totals.users} colorClass="bg-amber-500" />
                <PercentageBar label="Suspended" value={overview.usersByStatus.suspended} total={overview.totals.users} colorClass="bg-red-500" />
              </div>
            </div>

            <div className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-ink">Reclamations pipeline</h3>
              <div className="mt-4 space-y-3">
                <PercentageBar label="Pending" value={overview.reclamationsByStatus.pending} total={overview.totals.reclamations} colorClass="bg-amber-500" />
                <PercentageBar label="Approved" value={overview.reclamationsByStatus.approved} total={overview.totals.reclamations} colorClass="bg-green-500" />
                <PercentageBar label="Rejected" value={overview.reclamationsByStatus.rejected} total={overview.totals.reclamations} colorClass="bg-red-500" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const usersContent = (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <input
          type="text"
          value={usersFilters.search}
          onChange={(event) => setUsersFilters((previous) => ({ ...previous, search: event.target.value, page: 1 }))}
          placeholder="Search by name or email"
          className={inputClassName}
        />

        <select
          value={usersFilters.role}
          onChange={(event) => setUsersFilters((previous) => ({ ...previous, role: event.target.value, page: 1 }))}
          className={selectClassName}
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select
          value={usersFilters.status}
          onChange={(event) => setUsersFilters((previous) => ({ ...previous, status: event.target.value, page: 1 }))}
          className={selectClassName}
        >
          {USER_STATUS_OPTIONS.map((option, index) => (
            <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={loadUsers}
          className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-200"
        >
          Refresh
        </button>
      </div>

      <DataTable
        columns={usersColumns}
        rows={users}
        loading={usersLoading}
        emptyMessage="No users match your filters."
      />

      <Pagination
        page={usersPagination.page}
        totalPages={usersPagination.totalPages}
        onPageChange={(nextPage) => setUsersFilters((previous) => ({ ...previous, page: nextPage }))}
      />
    </div>
  );

  const announcementsContent = (
    <div className="space-y-4">
      <div className="rounded-lg border border-edge bg-surface p-4 pt-6 shadow-card">
        <div className="grid gap-3 lg:grid-cols-5">
          <input
            type="text"
            value={announcementFilters.search}
            onChange={(event) => setAnnouncementFilters((previous) => ({ ...previous, search: event.target.value, page: 1 }))}
            placeholder="Search announcements"
            className={inputClassName}
          />

          <select
            value={announcementFilters.status}
            onChange={(event) => setAnnouncementFilters((previous) => ({ ...previous, status: event.target.value, page: 1 }))}
            className={selectClassName}
          >
            {ANNOUNCEMENT_STATUS_OPTIONS.map((option, index) => (
              <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            value={announcementFilters.target}
            onChange={(event) => setAnnouncementFilters((previous) => ({ ...previous, target: event.target.value, page: 1 }))}
            className={selectClassName}
          >
            {ANNOUNCEMENT_TARGET_OPTIONS.map((option, index) => (
              <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadAnnouncements}
            className="rounded-md border border-edge bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition-all duration-150 hover:bg-surface-200 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateAnnouncementModal}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-hover active:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas"
          >
            New announcement
          </button>
        </div>
      </div>

      <DataTable
        columns={announcementsColumns}
        rows={announcements}
        loading={announcementsLoading}
        emptyMessage="No announcements found."
      />

      <Pagination
        page={announcementsPagination.page}
        totalPages={announcementsPagination.totalPages}
        onPageChange={(nextPage) => setAnnouncementFilters((previous) => ({ ...previous, page: nextPage }))}
      />
    </div>
  );

  const reclamationsContent = (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <input
          type="text"
          value={reclamationFilters.search}
          onChange={(event) => setReclamationFilters((previous) => ({ ...previous, search: event.target.value, page: 1 }))}
          placeholder="Search reclamations"
          className={inputClassName}
        />

        <select
          value={reclamationFilters.status}
          onChange={(event) => setReclamationFilters((previous) => ({ ...previous, status: event.target.value, page: 1 }))}
          className={selectClassName}
        >
          {RECLAMATION_STATUS_OPTIONS.map((option, index) => (
            <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={loadReclamations}
          className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-200"
        >
          Refresh
        </button>
      </div>

      <DataTable
        columns={reclamationsColumns}
        rows={reclamations}
        loading={reclamationsLoading}
        emptyMessage="No reclamations found."
      />

      <Pagination
        page={reclamationsPagination.page}
        totalPages={reclamationsPagination.totalPages}
        onPageChange={(nextPage) => setReclamationFilters((previous) => ({ ...previous, page: nextPage }))}
      />
    </div>
  );

  const documentsContent = (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <input
          type="text"
          value={documentFilters.search}
          onChange={(event) => setDocumentFilters((previous) => ({ ...previous, search: event.target.value, page: 1 }))}
          placeholder="Search documents"
          className={inputClassName}
        />

        <select
          value={documentFilters.kind}
          onChange={(event) => setDocumentFilters((previous) => ({ ...previous, kind: event.target.value, page: 1 }))}
          className={selectClassName}
        >
          {DOCUMENT_KIND_OPTIONS.map((option, index) => (
            <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={loadDocuments}
          className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-200"
        >
          Refresh
        </button>
      </div>

      <DataTable
        columns={documentsColumns}
        rows={documents}
        loading={documentsLoading}
        emptyMessage="No documents found."
      />

      <Pagination
        page={documentsPagination.page}
        totalPages={documentsPagination.totalPages}
        onPageChange={(nextPage) => setDocumentFilters((previous) => ({ ...previous, page: nextPage }))}
      />
    </div>
  );

  const auditContent = (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <input
          type="text"
          value={auditFilters.eventKey}
          onChange={(event) => setAuditFilters((previous) => ({ ...previous, eventKey: event.target.value, page: 1 }))}
          placeholder="Event key"
          className={inputClassName}
        />

        <input
          type="text"
          value={auditFilters.action}
          onChange={(event) => setAuditFilters((previous) => ({ ...previous, action: event.target.value, page: 1 }))}
          placeholder="Action"
          className={inputClassName}
        />

        <input
          type="text"
          value={auditFilters.entityType}
          onChange={(event) => setAuditFilters((previous) => ({ ...previous, entityType: event.target.value, page: 1 }))}
          placeholder="Entity type"
          className={inputClassName}
        />

        <input
          type="text"
          value={auditFilters.entityId}
          onChange={(event) => setAuditFilters((previous) => ({ ...previous, entityId: event.target.value, page: 1 }))}
          placeholder="Entity id"
          className={inputClassName}
        />

        <input
          type="number"
          min="1"
          value={auditFilters.actorUserId}
          onChange={(event) => setAuditFilters((previous) => ({ ...previous, actorUserId: event.target.value, page: 1 }))}
          placeholder="Actor user id"
          className={inputClassName}
        />

        <label className="space-y-1 text-xs text-ink-tertiary">
          <span>From</span>
          <input
            type="date"
            value={auditFilters.from}
            onChange={(event) => setAuditFilters((previous) => ({ ...previous, from: event.target.value, page: 1 }))}
            className={`${inputClassName} w-full`}
          />
        </label>

        <label className="space-y-1 text-xs text-ink-tertiary">
          <span>To</span>
          <input
            type="date"
            value={auditFilters.to}
            onChange={(event) => setAuditFilters((previous) => ({ ...previous, to: event.target.value, page: 1 }))}
            className={`${inputClassName} w-full`}
          />
        </label>

        <button
          type="button"
          onClick={loadAuditLogs}
          className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-200"
        >
          Refresh
        </button>
      </div>

      <DataTable
        columns={auditColumns}
        rows={auditLogs}
        loading={auditLoading}
        emptyMessage="No audit log events found."
      />

      <Pagination
        page={auditPagination.page}
        totalPages={auditPagination.totalPages}
        onPageChange={(nextPage) => setAuditFilters((previous) => ({ ...previous, page: nextPage }))}
      />
    </div>
  );

  const contentByTab = {
    dashboard: dashboardContent,
    users: usersContent,
    announcements: announcementsContent,
    reclamations: reclamationsContent,
    documents: documentsContent,
    audit: auditContent,
  };

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="relative px-6 py-6 lg:px-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/10 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" />
          <p className="text-xs uppercase tracking-[0.18em] text-ink-tertiary">University Platform</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">Admin Control Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-secondary">
            Manage users, announcements, reclamations, documents, and audit visibility from one secure interface.
            Signed in as {user?.prenom} {user?.nom}.
          </p>
          <div className="mt-4">
            <Link
              to="/dashboard/admin/site-settings"
              className="inline-flex rounded-md border border-edge bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-200"
            >
              Open Site Configuration
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-edge-strong bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-edge-strong bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-edge bg-surface p-2 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-brand text-white'
                  : 'text-ink-secondary hover:bg-surface-200 hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section>{contentByTab[activeTab]}</section>

      <Modal
        open={Boolean(deleteUserModal)}
        onClose={() => setDeleteUserModal(null)}
        title="Delete user"
        description="This action will delete the user when possible, or suspend if linked academic records exist."
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteUserModal(null)}
              className="rounded-md border border-edge px-3 py-2 text-sm text-ink-secondary hover:bg-surface-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!deleteUserModal) return;
                try {
                  setUpdatingUserId(deleteUserModal.id);
                  setError('');
                  const response = await adminPanelAPI.deleteUser(deleteUserModal.id);
                  setSuccessMessage(response?.message || 'User deletion request completed.');
                  setDeleteUserModal(null);
                  await loadUsers();
                  await loadOverview();
                } catch (deleteError) {
                  setError(deleteError.message || 'Failed to delete user.');
                } finally {
                  setUpdatingUserId(null);
                }
              }}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Confirm delete
            </button>
          </div>
        )}
      >
        <p className="text-sm text-ink-secondary">
          Delete account for <strong className="text-ink">{deleteUserModal?.prenom} {deleteUserModal?.nom}</strong> ({deleteUserModal?.email})?
        </p>
      </Modal>

      <Modal
        open={announcementModalOpen}
        onClose={() => setAnnouncementModalOpen(false)}
        title={announcementModalMode === 'create' ? 'Create announcement' : 'Edit announcement'}
        description="Announcements can include multiple attachments."
        maxWidth="max-w-3xl"
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAnnouncementModalOpen(false)}
              className="rounded-md border border-edge px-3 py-2 text-sm text-ink-secondary hover:bg-surface-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  setAnnouncementSubmitting(true);
                  setError('');

                  const formData = new FormData();
                  formData.append('title', announcementForm.title);
                  formData.append('content', announcementForm.content);
                  formData.append('typeName', announcementForm.typeName);
                  formData.append('status', announcementForm.status);
                  formData.append('target', announcementForm.target);
                  formData.append('priority', announcementForm.priority);
                  if (announcementForm.expiresAt) {
                    formData.append('expiresAt', announcementForm.expiresAt);
                  }

                  if (announcementModalMode === 'edit') {
                    formData.append('removeDocumentIds', JSON.stringify(announcementForm.removeDocumentIds || []));
                  }

                  announcementFiles.forEach((file) => {
                    formData.append('files', file);
                  });

                  if (announcementModalMode === 'create') {
                    await adminPanelAPI.createAnnouncement(formData);
                    setSuccessMessage('Announcement created successfully.');
                  } else if (selectedAnnouncement) {
                    await adminPanelAPI.updateAnnouncement(selectedAnnouncement.id, formData);
                    setSuccessMessage('Announcement updated successfully.');
                  }

                  setAnnouncementModalOpen(false);
                  setAnnouncementFiles([]);
                  await loadAnnouncements();
                  await loadOverview();
                } catch (submitError) {
                  setError(submitError.message || 'Failed to save announcement.');
                } finally {
                  setAnnouncementSubmitting(false);
                }
              }}
              disabled={announcementSubmitting}
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {announcementSubmitting ? 'Saving...' : announcementModalMode === 'create' ? 'Create' : 'Save changes'}
            </button>
          </div>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-ink-secondary md:col-span-2">
            <span>Title</span>
            <input
              type="text"
              value={announcementForm.title}
              onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, title: event.target.value }))}
              className={`${inputClassName} w-full`}
            />
          </label>

          <label className="space-y-1 text-sm text-ink-secondary md:col-span-2">
            <span>Content</span>
            <textarea
              rows={5}
              value={announcementForm.content}
              onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, content: event.target.value }))}
              className={`${inputClassName} w-full resize-none`}
            />
          </label>

          <label className="space-y-1 text-sm text-ink-secondary">
            <span>Type</span>
            <input
              type="text"
              value={announcementForm.typeName}
              onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, typeName: event.target.value }))}
              className={`${inputClassName} w-full`}
              placeholder="General"
            />
          </label>

          <label className="space-y-1 text-sm text-ink-secondary">
            <span>Status</span>
            <select
              value={announcementForm.status}
              onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, status: event.target.value }))}
              className={`${selectClassName} w-full`}
            >
              {ANNOUNCEMENT_STATUS_FORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-ink-secondary">
            <span>Target</span>
            <select
              value={announcementForm.target}
              onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, target: event.target.value }))}
              className={`${selectClassName} w-full`}
            >
              {ANNOUNCEMENT_TARGET_FORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-ink-secondary md:col-span-2">
            <span>Priority</span>
            <select
              value={announcementForm.priority}
              onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, priority: event.target.value }))}
              className={`${selectClassName} w-full`}
            >
              {ANNOUNCEMENT_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="text-xs text-ink-tertiary">Urgent and high priority items appear in the public important announcements slider.</p>
          </label>

          <label className="space-y-1 text-sm text-ink-secondary">
            <span>Expiration date</span>
            <input
              type="date"
              value={announcementForm.expiresAt}
              onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, expiresAt: event.target.value }))}
              className={`${inputClassName} w-full`}
            />
          </label>

          <label className="space-y-1 text-sm text-ink-secondary md:col-span-2">
            <span>Attachments</span>
            <input
              type="file"
              multiple
              onChange={(event) => setAnnouncementFiles(Array.from(event.target.files || []))}
              className={`${inputClassName} w-full`}
            />
            {announcementFiles.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-ink-tertiary">
                {announcementFiles.map((file) => (
                  <li key={`${file.name}-${file.size}`}>{file.name}</li>
                ))}
              </ul>
            ) : null}
          </label>

          {announcementModalMode === 'edit' && selectedAnnouncement?.documents?.length > 0 ? (
            <div className="md:col-span-2 rounded-xl border border-edge bg-surface-200/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">Existing attachments</p>
              <div className="mt-2 space-y-2">
                {selectedAnnouncement.documents.map((document) => {
                  const willBeRemoved = announcementForm.removeDocumentIds.includes(document.id);
                  return (
                    <label key={document.id} className="flex items-center gap-2 text-sm text-ink-secondary">
                      <input
                        type="checkbox"
                        checked={willBeRemoved}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setAnnouncementForm((previous) => ({
                            ...previous,
                            removeDocumentIds: checked
                              ? [...previous.removeDocumentIds, document.id]
                              : previous.removeDocumentIds.filter((id) => id !== document.id),
                          }));
                        }}
                      />
                      <span>{document.fileName}</span>
                      {willBeRemoved ? <span className="text-xs text-red-700">(will be removed)</span> : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(announcementDeleteModal)}
        onClose={() => setAnnouncementDeleteModal(null)}
        title="Delete announcement"
        description="This will permanently remove the announcement and its uploaded files."
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAnnouncementDeleteModal(null)}
              className="rounded-md border border-edge px-3 py-2 text-sm text-ink-secondary hover:bg-surface-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!announcementDeleteModal) return;
                try {
                  setAnnouncementSubmitting(true);
                  setError('');
                  await adminPanelAPI.deleteAnnouncement(announcementDeleteModal.id);
                  setSuccessMessage('Announcement deleted successfully.');
                  setAnnouncementDeleteModal(null);
                  await loadAnnouncements();
                  await loadOverview();
                } catch (deleteError) {
                  setError(deleteError.message || 'Failed to delete announcement.');
                } finally {
                  setAnnouncementSubmitting(false);
                }
              }}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Confirm delete
            </button>
          </div>
        )}
      >
        <p className="text-sm text-ink-secondary">
          Delete announcement <strong className="text-ink">{announcementDeleteModal?.title}</strong>?
        </p>
      </Modal>

      <Modal
        open={Boolean(reclamationModal)}
        onClose={() => setReclamationModal(null)}
        title="Update reclamation"
        description="Set status and add an admin response or justification."
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReclamationModal(null)}
              className="rounded-md border border-edge px-3 py-2 text-sm text-ink-secondary hover:bg-surface-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={reclamationSubmitting}
              onClick={async () => {
                if (!reclamationModal) return;
                try {
                  setReclamationSubmitting(true);
                  setError('');
                  await adminPanelAPI.updateReclamationStatus(reclamationModal.id, {
                    status: reclamationForm.status,
                    adminResponse: reclamationForm.adminResponse,
                  });
                  setSuccessMessage('Reclamation updated successfully.');
                  setReclamationModal(null);
                  await loadReclamations();
                  await loadOverview();
                } catch (updateError) {
                  setError(updateError.message || 'Failed to update reclamation.');
                } finally {
                  setReclamationSubmitting(false);
                }
              }}
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reclamationSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            <span className="font-medium text-ink">{reclamationModal?.title}</span>
          </p>

          <label className="space-y-1 text-sm text-ink-secondary">
            <span>Status</span>
            <select
              value={reclamationForm.status}
              onChange={(event) => setReclamationForm((previous) => ({ ...previous, status: event.target.value }))}
              className={`${selectClassName} w-full`}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          <label className="space-y-1 text-sm text-ink-secondary">
            <span>Admin response / justification</span>
            <textarea
              rows={5}
              value={reclamationForm.adminResponse}
              onChange={(event) => setReclamationForm((previous) => ({ ...previous, adminResponse: event.target.value }))}
              className={`${inputClassName} w-full resize-none`}
              placeholder="Provide context, explanation, or required next action for the student."
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(workflowModal)}
        onClose={() => {
          setWorkflowModal(null);
          setWorkflowData(null);
          setWorkflowError('');
        }}
        title="Workflow timeline"
        description="Lifecycle events recorded for this request."
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-edge bg-surface-200/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-ink-tertiary">Request</p>
            <p className="mt-1 text-sm font-semibold text-ink">{workflowModal?.title || '-'}</p>
            <p className="mt-1 text-xs text-ink-tertiary">ID #{workflowModal?.id || '-'}</p>
          </div>

          {workflowLoading ? (
            <div className="py-6 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-edge-strong border-t-brand" />
              <p className="mt-3 text-sm text-ink-tertiary">Loading workflow history...</p>
            </div>
          ) : null}

          {!workflowLoading && workflowError ? (
            <div className="rounded-xl border border-edge-strong bg-red-50 px-4 py-3 text-sm text-red-700">
              {workflowError}
            </div>
          ) : null}

          {!workflowLoading && !workflowError && workflowData ? (
            <>
              <div className="rounded-xl border border-edge bg-surface px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-ink-tertiary">Current stage</p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatTokenLabel(workflowData.currentStage)}</p>
              </div>

              <div className="space-y-3">
                {(workflowData.history || []).map((event) => (
                  <div key={event.id} className="rounded-xl border border-edge bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{formatTokenLabel(event.stage)}</p>
                        <p className="text-xs text-ink-tertiary">Action: {formatTokenLabel(event.action)}</p>
                      </div>
                      <p className="text-xs text-ink-tertiary">{formatDate(event.createdAt)}</p>
                    </div>

                    <p className="mt-2 text-xs text-ink-tertiary">
                      Actor: {event.actorUserId ? `User #${event.actorUserId}` : 'System'}
                      {Array.isArray(event.actorRoles) && event.actorRoles.length > 0 ? ` (${event.actorRoles.join(', ')})` : ''}
                    </p>

                    {event.note ? (
                      <p className="mt-2 text-sm text-ink-secondary">{event.note}</p>
                    ) : null}

                    {event.metadata ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-brand">Metadata</summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-edge-subtle bg-surface-200/60 p-2 text-[11px] text-ink-secondary whitespace-pre-wrap break-words">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ))}

                {(!workflowData.history || workflowData.history.length === 0) ? (
                  <div className="rounded-xl border border-edge bg-surface px-4 py-5 text-center text-sm text-ink-tertiary">
                    No workflow events available for this request.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(documentDeleteModal)}
        onClose={() => setDocumentDeleteModal(null)}
        title="Delete document"
        description="The file will be removed from storage and detached from its linked record."
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDocumentDeleteModal(null)}
              className="rounded-md border border-edge px-3 py-2 text-sm text-ink-secondary hover:bg-surface-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!documentDeleteModal) return;
                try {
                  setDocumentActionLoading(`delete-${documentDeleteModal.id}`);
                  setError('');
                  await adminPanelAPI.deleteDocument(documentDeleteModal.kind, documentDeleteModal.numericId);
                  setSuccessMessage('Document deleted successfully.');
                  setDocumentDeleteModal(null);
                  await loadDocuments();
                } catch (deleteError) {
                  setError(deleteError.message || 'Failed to delete document.');
                } finally {
                  setDocumentActionLoading(null);
                }
              }}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Confirm delete
            </button>
          </div>
        )}
      >
        <p className="text-sm text-ink-secondary">
          Delete document <strong className="text-ink">{documentDeleteModal?.fileName}</strong>?
        </p>
      </Modal>
    </div>
  );
}

