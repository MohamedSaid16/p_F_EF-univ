/*
  Intent: University staff/students navigating academic modules.
          Shell stays fixed — sidebar + topbar frame the workspace.
          Content scrolls independently. Feels like a well-organized office.
  Palette: canvas bg throughout — sidebar is NOT a different world.
  Depth: border-edge separates sidebar/topbar from content. No heavy shadows on shell.
  Surfaces: canvas (base) for shell, surface (white) for content cards within.
  Typography: Inter. Subheading in topbar, labels in sidebar.
  Spacing: 4px base.
*/

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '../design-system/components/navigation/Sidebar';
import Topbar from '../design-system/components/navigation/Topbar';
import TeacherDashboard from '../pages/TeacherDashboard';
import StudentDashboard from '../pages/StudentDashboard';
import request, { notificationsAPI } from '../services/api';
import { connectNotificationsSocket } from '../services/realtime';
import { useAuth } from '../contexts/AuthContext';
import { hasAnyPermission, hasAnyRole } from '../utils/rbac';

/* ── 11 Modules ─────────────────────────────────────────────── */
const ALL_MODULES = [
  { nameKey: 'nav.dashboard', path: '/dashboard', roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil', 'chef_specialite', 'chef_departement', 'vice_doyen', 'admin', 'admin_faculte'] },
  { nameKey: 'nav.actualites', path: '/dashboard/actualites', roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil', 'chef_specialite', 'chef_departement', 'vice_doyen', 'admin', 'admin_faculte'] },
  { nameKey: 'nav.projects', path: '/dashboard/projects', roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil'] },
  { nameKey: 'nav.ai', path: '/dashboard/ai', roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil'] },
  { nameKey: 'nav.documents', path: '/dashboard/documents', roles: ['etudiant', 'delegue', 'enseignant', 'vice_doyen', 'admin', 'admin_faculte'] },
  { nameKey: 'nav.calendar', path: '/dashboard/calendar', roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil', 'chef_specialite', 'chef_departement', 'vice_doyen', 'admin', 'admin_faculte'] },
  {
    nameKey: 'nav.disciplinary',
    path: '/dashboard/disciplinary',
    roles: ['enseignant', 'membre_conseil', 'president_conseil', 'chef_specialite', 'chef_departement', 'vice_doyen', 'admin', 'admin_faculte'],
    permissions: [
      'reclamations:review:sensitive',
      'reclamations:finalize:council',
      'reclamations:override:department',
      'decisions:validate:specialite',
      'reclamations:manage:global',
    ],
  },
  {
    nameKey: 'nav.requests',
    path: '/dashboard/requests',
    roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil', 'chef_specialite', 'chef_departement', 'vice_doyen', 'admin', 'admin_faculte'],
    permissions: [
      'reclamations:create:self',
      'reclamations:create:group',
      'reclamations:view:course',
      'reclamations:view:department',
      'reclamations:view:specialite',
      'reclamations:view:broad',
      'reclamations:manage:global',
    ],
  },
  { nameKey: 'nav.messages', path: '/dashboard/messages', roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil', 'vice_doyen', 'admin', 'admin_faculte'] },
  { nameKey: 'nav.notifications', path: '/dashboard/notifications', roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil', 'vice_doyen', 'admin', 'admin_faculte'] },
  { nameKey: 'nav.settings', path: '/dashboard/settings', roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil', 'chef_specialite', 'chef_departement', 'vice_doyen', 'admin', 'admin_faculte'] },
  { nameKey: 'nav.support', path: '/dashboard/support', roles: ['etudiant', 'delegue', 'enseignant', 'membre_conseil', 'president_conseil'] },
  { nameKey: 'nav.adminHub', path: '/dashboard/admin', roles: ['vice_doyen', 'admin', 'admin_faculte'], permissions: ['users:manage'] },
  { nameKey: 'nav.userManagement', path: '/dashboard/admin/users', roles: ['vice_doyen', 'admin', 'admin_faculte'], permissions: ['users:manage'] },
  { nameKey: 'nav.academicStructure', path: '/dashboard/admin/academic/management', roles: ['vice_doyen', 'admin'], permissions: ['departments:manage', 'specialites:manage'] },
  { nameKey: 'nav.academicAssignments', path: '/dashboard/admin/academic/assignments', roles: ['vice_doyen', 'admin'], permissions: ['users:manage', 'roles:assign'] },
  { nameKey: 'nav.siteConfiguration', path: '/dashboard/admin/site-settings', roles: ['vice_doyen', 'admin', 'admin_faculte'], permissions: ['users:manage'] },
];

const ADMIN_REQUEST_ROLES = ['admin', 'vice_doyen'];
const STUDENT_REQUEST_ROLES = ['etudiant', 'delegue'];
const PENDING_REQUEST_STATUSES = new Set([
  'submitted',
  'under-review',
  'under_review',
  'info-requested',
  'soumise',
  'soumis',
  'en-cours',
  'en_cours',
  'en-attente',
  'en_attente',
  'en-verification',
  'en_verification',
]);

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function countPendingItems(rows) {
  if (!Array.isArray(rows)) {
    return 0;
  }

  return rows.reduce((count, row) => {
    const status = normalizeStatus(row?.status);
    if (PENDING_REQUEST_STATUSES.has(status)) {
      return count + 1;
    }
    return count;
  }, 0);
}

function extractPendingFromStudentResponse(payload) {
  const pendingFromStats = Number(payload?.stats?.pending);
  if (Number.isFinite(pendingFromStats) && pendingFromStats >= 0) {
    return pendingFromStats;
  }

  return countPendingItems(payload?.data);
}

function sameBadgeMap(currentMap, nextMap) {
  const currentKeys = Object.keys(currentMap);
  const nextKeys = Object.keys(nextMap);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((key) => currentMap[key] === nextMap[key]);
}

/* Map DB roles to the UI role token used by children (student | teacher | admin) */
function uiRole(roles) {
  if (!roles || !roles.length) return 'student';
  const arr = Array.isArray(roles) ? roles : [roles];
  const upper = arr.map((r) => (r || '').toUpperCase());
  if (upper.some((r) => ['ADMIN', 'ADMIN_FACULTY', 'ADMIN_FACULTE', 'ADMIN_SUPER', 'VICE_DOYEN'].includes(r))) return 'admin';
  if (upper.some((r) => ['TEACHER', 'ENSEIGNANT', 'MEMBRE_CONSEIL', 'PRESIDENT_CONSEIL', 'CHEF_SPECIALITE', 'CHEF_DEPARTEMENT'].includes(r))) return 'teacher';
  return 'student'; // etudiant, delegue, etc.
}

function dashboardHomeByRoles(roles, coreRole) {
  const normalizedCoreRole = String(coreRole || '').toLowerCase();
  if (normalizedCoreRole === 'etudiant') return 'student';
  if (normalizedCoreRole === 'enseignant') return 'teacher';
  if (normalizedCoreRole === 'admin') return 'admin';

  if (!roles || !roles.length) return 'student';
  const arr = Array.isArray(roles) ? roles : [roles];
  const normalized = arr.map((r) => String(r || '').toLowerCase());

  if (normalized.some((r) => ['etudiant', 'delegue', 'student'].includes(r))) return 'student';
  if (normalized.some((r) => ['enseignant', 'teacher'].includes(r))) return 'teacher';
  return 'admin';
}

function AdminHomePanel({ onNavigate }) {
  return (
    <div className="rounded-2xl border border-edge bg-surface p-8 shadow-card">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Admin Dashboard</h1>
      <p className="mt-2 text-sm text-ink-secondary">
        Welcome. Select a module to continue administration tasks.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/dashboard/admin')}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-hover"
        >
          Open Admin Control Center
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/dashboard/requests')}
          className="rounded-xl border border-edge bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:border-edge-strong hover:text-brand"
        >
          Open Requests
        </button>
      </div>
    </div>
  );
}

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moduleBadges, setModuleBadges] = useState({});

  /* Derive activeKey from the current URL */
  const activeKey = location.pathname;

  const role = uiRole(user?.roles);
  const defaultHome = dashboardHomeByRoles(user?.roles, user?.coreRole);
  const roleSignature = Array.isArray(user?.roles)
    ? user.roles.map((roleName) => String(roleName || '').toLowerCase()).sort().join('|')
    : '';

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setModuleBadges({});
      return undefined;
    }

    const roleList = Array.isArray(user.roles)
      ? user.roles.map((roleName) => String(roleName || '').toLowerCase())
      : [];

    const hasAdminRequestsAccess = roleList.some((roleName) => ADMIN_REQUEST_ROLES.includes(roleName));
    const hasStudentRequestsAccess = roleList.some((roleName) => STUDENT_REQUEST_ROLES.includes(roleName));

    const refreshBadges = async () => {
      const nextBadges = {};

      try {
        const unreadResponse = await notificationsAPI.getUnreadCount();
        const unreadCount = Number(unreadResponse?.data?.unreadCount);

        if (Number.isFinite(unreadCount) && unreadCount > 0) {
          nextBadges['/dashboard/notifications'] = unreadCount;
        }
      } catch {
        // Silent fail: sidebar badges should not block navigation rendering.
      }

      try {
        let pendingRequests = 0;

        if (hasAdminRequestsAccess) {
          const inboxResponse = await request('/api/v1/requests/admin/inbox');
          pendingRequests = countPendingItems(inboxResponse?.data);
        } else if (hasStudentRequestsAccess) {
          const [reclamationsResponse, justificationsResponse] = await Promise.all([
            request('/api/v1/requests/reclamations'),
            request('/api/v1/requests/justifications'),
          ]);

          pendingRequests =
            extractPendingFromStudentResponse(reclamationsResponse) +
            extractPendingFromStudentResponse(justificationsResponse);
        }

        if (pendingRequests > 0) {
          nextBadges['/dashboard/requests'] = pendingRequests;
        }
      } catch {
        // Silent fail: some roles do not have access to request inbox endpoints.
      }

      try {
        if (hasStudentRequestsAccess) {
          const [choicesResponse, specialiteOptionsResponse] = await Promise.all([
            request('/api/v1/student/my-choices'),
            request('/api/v1/student/specialite-options'),
          ]);

          const choices = Array.isArray(choicesResponse?.data) ? choicesResponse.data : [];
          const openCampagnes = Array.isArray(specialiteOptionsResponse?.data?.campagnes)
            ? specialiteOptionsResponse.data.campagnes
            : [];

          const pendingChoices = countPendingItems(choices);
          const hasOpenCampagneWithoutChoice = openCampagnes.some((campagne) => {
            const campagneId = Number(campagne?.id);
            if (!Number.isFinite(campagneId)) {
              return false;
            }

            return !choices.some((choice) => {
              const choiceCampagneId = Number(choice?.campagne?.id ?? choice?.campagneId);
              return Number.isFinite(choiceCampagneId) && choiceCampagneId === campagneId;
            });
          });

          const projectBadgeCount = pendingChoices > 0 ? pendingChoices : (hasOpenCampagneWithoutChoice ? 1 : 0);

          if (projectBadgeCount > 0) {
            nextBadges['/dashboard/projects'] = projectBadgeCount;
          }
        }
      } catch {
        // Silent fail: legacy student specialite endpoints may be disabled for some cohorts.
      }

      if (!cancelled) {
        setModuleBadges((current) => (sameBadgeMap(current, nextBadges) ? current : nextBadges));
      }
    };

    refreshBadges();
    const intervalId = window.setInterval(refreshBadges, 45000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user?.id, user?.roles, roleSignature]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const socket = connectNotificationsSocket({
      onNotification: () => {
        setModuleBadges((current) => {
          const currentUnread = Number(current['/dashboard/notifications'] || 0);
          const nextBadges = {
            ...current,
            '/dashboard/notifications': Math.max(0, currentUnread) + 1,
          };
          return sameBadgeMap(current, nextBadges) ? current : nextBadges;
        });
      },
      onUnreadCount: (payload) => {
        const unreadCount = Number(payload?.unreadCount);
        if (!Number.isFinite(unreadCount) || unreadCount < 0) {
          return;
        }

        setModuleBadges((current) => {
          const nextBadges = { ...current };
          if (unreadCount > 0) {
            nextBadges['/dashboard/notifications'] = unreadCount;
          } else {
            delete nextBadges['/dashboard/notifications'];
          }
          return sameBadgeMap(current, nextBadges) ? current : nextBadges;
        });
      },
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  /* Filter modules by the user's actual DB roles and resolve translated names */
  const visibleModules = ALL_MODULES
    .filter((module) => {
      if (!user) return false;

      const roleAllowed = Array.isArray(module.roles) && module.roles.length > 0
        ? hasAnyRole(user, module.roles)
        : false;

      const permissionAllowed = Array.isArray(module.permissions) && module.permissions.length > 0
        ? hasAnyPermission(user, module.permissions)
        : false;

      if (Array.isArray(module.roles) && module.roles.length > 0 && Array.isArray(module.permissions) && module.permissions.length > 0) {
        return roleAllowed || permissionAllowed;
      }

      if (Array.isArray(module.roles) && module.roles.length > 0) {
        return roleAllowed;
      }

      if (Array.isArray(module.permissions) && module.permissions.length > 0) {
        return permissionAllowed;
      }

      return true;
    })
    .map((m) => ({
      ...m,
      name: t(m.nameKey),
      badgeCount: moduleBadges[m.path] ?? 0,
    }));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  /* Navigate to the clicked module path */
  const handleNavigate = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen w-full bg-canvas overflow-hidden">
      {/* Sidebar — same canvas bg, separated by border only */}
      <Sidebar
        modules={visibleModules}
        role={role}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={handleNavigate}
        activeKey={activeKey}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(v => !v)}
      />

      {/* Right column: topbar + content */}
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar
          role={role}
          user={user}
          onLogout={handleLogout}
          onHamburger={() => setSidebarOpen(true)}
          onNavigate={handleNavigate}
          activeKey={activeKey}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(v => !v)}
        />

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          {children
            ? React.Children.map(children, (child) =>
                React.isValidElement(child) ? React.cloneElement(child, { role }) : child
              )
            : (defaultHome === 'student'
                ? <StudentDashboard role={role} />
                : defaultHome === 'teacher'
                  ? <TeacherDashboard role={role} />
                  : <AdminHomePanel onNavigate={handleNavigate} />)
          }
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

