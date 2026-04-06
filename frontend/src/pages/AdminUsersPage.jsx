import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, resolveMediaUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function isAdminRole(roles) {
  if (!Array.isArray(roles)) return false;
  return roles
    .map((role) => String(role || '').toLowerCase())
    .some((role) => ['admin', 'vice_doyen'].includes(role));
}

function getInitials(prenom, nom) {
  return `${prenom?.[0] || '?'}${nom?.[0] || '?'}`.toUpperCase();
}

function roleLabel(roleName) {
  if (roleName === 'admin') return 'Admin';
  if (roleName === 'enseignant') return 'Teacher';
  if (roleName === 'etudiant') return 'Student';
  if (roleName === 'delegue') return 'Delegate (Student)';
  if (roleName === 'chef_specialite') return 'Chef Specialite';
  if (roleName === 'chef_departement') return 'Chef Departement';
  if (roleName === 'president_conseil') return 'President Conseil';
  if (roleName === 'vice_doyen') return 'Vice Doyen';
  if (roleName === 'admin_faculte') return 'Admin Faculte';
  return roleName;
}

const BASE_CREATION_ROLE_NAMES = ['admin', 'enseignant', 'etudiant'];
const STUDENT_TRACK_ROLE_NAMES = ['etudiant', 'delegue'];

function getRoleTrack(roleName) {
  if (STUDENT_TRACK_ROLE_NAMES.includes(roleName)) return 'student';
  return 'staff';
}

function detectUserTrack(roleNames = []) {
  return roleNames.some((roleName) => getRoleTrack(roleName) === 'student') ? 'student' : 'staff';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFrDate(value) {
  return new Date(value).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const inputClassName = 'w-full rounded-xl border border-edge bg-canvas px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';
const sectionClassName = 'rounded-2xl border border-edge bg-surface shadow-card';

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const hasLoadedDataRef = useRef(false);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingByUserId, setSavingByUserId] = useState({});
  const [editingRolesByUserId, setEditingRolesByUserId] = useState({});
  const [editingStatusByUserId, setEditingStatusByUserId] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState(null);
  const [credentialRegistry, setCredentialRegistry] = useState([]);
  const [logoBase64, setLogoBase64] = useState('');
  const [formMeta, setFormMeta] = useState({
    universityName: 'Université Ibn Khaldoun - Tiaret',
    facultyName: 'Faculté des Sciences et Technologies',
    departmentName: 'Département Informatique',
  });

  const [createForm, setCreateForm] = useState({
    email: '',
    nom: '',
    prenom: '',
    sexe: '',
    telephone: '',
    roleNames: [],
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const canAccess = useMemo(() => isAdminRole(user?.roles), [user?.roles]);
  const credentialRows = useMemo(() => {
    return credentialRegistry
      .map((entry) => {
        const liveUser = users.find((u) => u.id === entry.userId);
        return {
          ...entry,
          nom: liveUser?.nom || entry.nom,
          prenom: liveUser?.prenom || entry.prenom,
          email: liveUser?.email || entry.email,
          telephone: liveUser?.telephone || entry.telephone || '',
          roles: liveUser?.roles || entry.roles || [],
        };
      })
      .filter((entry) => entry.tempPassword);
  }, [credentialRegistry, users]);

  const studentCredentialRows = useMemo(
    () => credentialRows.filter((entry) => entry.source === 'bulk' && (entry.roles || []).includes('etudiant')),
    [credentialRows]
  );

  const teacherCredentialRows = useMemo(
    () => credentialRows.filter((entry) => entry.source === 'bulk' && (entry.roles || []).includes('enseignant')),
    [credentialRows]
  );

  const baseCreationRoles = useMemo(
    () => roles.filter((role) => BASE_CREATION_ROLE_NAMES.includes(role.nom)),
    [roles]
  );
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((entry) => entry.status === 'active').length;
    const adminUsers = users.filter((entry) => isAdminRole(entry.roles || [])).length;
    const suspendedUsers = users.filter((entry) => entry.status === 'suspended').length;

    return [
      { label: 'Total Users', value: totalUsers, tone: 'text-ink' },
      { label: 'Active Accounts', value: activeUsers, tone: 'text-success' },
      { label: 'Admin Accounts', value: adminUsers, tone: 'text-brand' },
      { label: 'Suspended', value: suspendedUsers, tone: 'text-danger' },
    ];
  }, [users]);

  // Load default logo from public folder on component mount
  useEffect(() => {
    const loadDefaultLogo = async () => {
      const logoPaths = [
        '/Logo.png',
        '/favicon.svg',
        '/web-app-manifest-192x192.png',
        '/web-app-manifest-512x512.png',
        '/favicon.ico'
      ];

      for (const path of logoPaths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              setLogoBase64(reader.result);
            };
            reader.readAsDataURL(blob);
            break;
          }
        } catch (error) {
          console.log(`Logo not found at ${path}`);
        }
      }
    };
    
    loadDefaultLogo();
  }, []);

  useEffect(() => {
    if (!lastCreatedCredentials) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLastCreatedCredentials(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lastCreatedCredentials]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [usersRes, rolesRes] = await Promise.all([
        authAPI.adminGetUsers(),
        authAPI.adminGetRoles(),
      ]);

      const usersData = Array.isArray(usersRes?.data) ? usersRes.data : [];
      const rolesData = Array.isArray(rolesRes?.data) ? rolesRes.data : [];

      setUsers(usersData);
      setRoles(rolesData);
      setEditingRolesByUserId(
        Object.fromEntries(usersData.map((u) => [u.id, [...(u.roles || [])]]))
      );
      setEditingStatusByUserId(
        Object.fromEntries(usersData.map((u) => [u.id, u.status || 'active']))
      );
    } catch (err) {
      setError(err.message || 'Failed to load admin users data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess || hasLoadedDataRef.current) return;
    hasLoadedDataRef.current = true;
    loadData();
  }, [canAccess]);

  const toggleCreateRole = (roleName) => {
    setCreateForm((prev) => {
      const selected = prev.roleNames.includes(roleName) ? [] : [roleName];
      return { ...prev, roleNames: selected };
    });
  };

  const toggleUserRole = (userId, roleName) => {
    setEditingRolesByUserId((prev) => {
      const current = prev[userId] || [];
      const next = current.includes(roleName)
        ? current.filter((r) => r !== roleName)
        : [...current, roleName];
      return { ...prev, [userId]: next };
    });
  };

  const upsertCredentialEntry = (entry) => {
    setCredentialRegistry((prev) => {
      const index = prev.findIndex((item) => item.userId === entry.userId || item.email === entry.email);
      if (index === -1) {
        return [entry, ...prev];
      }

      const next = [...prev];
      next[index] = {
        ...next[index],
        ...entry,
      };
      return next;
    });
  };

  const createSingleUser = async (payload, source = 'single') => {
    const res = await authAPI.adminCreateUser(payload);
    const createdUser = res?.data?.user;
    const tempPassword = res?.data?.tempPassword;

    if (createdUser?.email && tempPassword) {
      upsertCredentialEntry({
        userId: createdUser.id,
        email: createdUser.email,
        nom: createdUser.nom || payload.nom,
        prenom: createdUser.prenom || payload.prenom,
        telephone: payload.telephone || '',
        roles: createdUser.roles || payload.roleNames,
        tempPassword,
        generatedAt: new Date().toISOString(),
        source,
      });
    }

    return { createdUser, tempPassword };
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!createForm.roleNames.length) {
      setError('Please select at least one role for the new user.');
      return;
    }

    setCreatingUser(true);
    try {
      const payload = {
        email: createForm.email.trim(),
        nom: createForm.nom.trim(),
        prenom: createForm.prenom.trim(),
        roleNames: createForm.roleNames,
        sexe: createForm.sexe || undefined,
        telephone: createForm.telephone.trim() || undefined,
      };

      const { createdUser, tempPassword } = await createSingleUser(payload, 'single');

      if (createdUser?.email && tempPassword) {
        setLastCreatedCredentials({
          email: createdUser.email,
          fullName: `${createdUser.prenom || payload.prenom} ${createdUser.nom || payload.nom}`.trim(),
          roles: createdUser.roles || payload.roleNames,
          tempPassword,
          createdAt: new Date().toLocaleString(),
        });
      }

      setMessage('User created successfully. The temporary credentials window is now open.');

      setCreateForm({
        email: '',
        nom: '',
        prenom: '',
        sexe: '',
        telephone: '',
        roleNames: [],
      });

      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create user.');
    } finally {
      setCreatingUser(false);
    }
  };

  const saveUserRoles = async (userId) => {
    const roleNames = editingRolesByUserId[userId] || [];
    if (!roleNames.length) {
      setError('Each user must have at least one role.');
      return;
    }

    setSavingByUserId((prev) => ({ ...prev, [userId]: true }));
    setError('');
    setMessage('');

    try {
      const res = await authAPI.adminUpdateUserRoles(userId, roleNames);
      const updatedUser = res?.data;
      if (updatedUser?.id) {
        setUsers((prev) => prev.map((u) => (
          u.id === updatedUser.id
            ? { ...u, roles: updatedUser.roles || u.roles }
            : u
        )));
      }
      setMessage('User roles updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update user roles.');
    } finally {
      setSavingByUserId((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const saveUserStatus = async (userId) => {
    const status = editingStatusByUserId[userId] || 'active';

    setSavingByUserId((prev) => ({ ...prev, [userId]: true }));
    setError('');
    setMessage('');

    try {
      const res = await authAPI.adminUpdateUserStatus(userId, status);
      const updatedUser = res?.data;
      if (updatedUser?.id) {
        setUsers((prev) => prev.map((u) => (
          u.id === updatedUser.id
            ? {
                ...u,
                status: updatedUser.status || u.status,
                roles: updatedUser.roles || u.roles,
              }
            : u
        )));
      }
      setMessage('User status updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update user status.');
    } finally {
      setSavingByUserId((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const copyToClipboard = async (text, successLabel) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successLabel);
    } catch {
      setError('Unable to copy automatically. Please copy it manually.');
    }
  };

  const handleResetUserPassword = async (targetUser) => {
    if (!targetUser?.id) return;

    setSavingByUserId((prev) => ({ ...prev, [targetUser.id]: true }));
    setError('');
    setMessage('');

    try {
      const res = await authAPI.adminResetPassword(targetUser.id);
      const tempPassword = res?.data?.tempPassword;

      if (!tempPassword) {
        throw new Error('Temporary password was not returned by the server.');
      }

      upsertCredentialEntry({
        userId: targetUser.id,
        email: targetUser.email,
        nom: targetUser.nom,
        prenom: targetUser.prenom,
        telephone: targetUser.telephone || '',
        roles: targetUser.roles || [],
        tempPassword,
        generatedAt: new Date().toISOString(),
      });

      setLastCreatedCredentials({
        email: targetUser.email,
        fullName: `${targetUser.prenom} ${targetUser.nom}`.trim(),
        roles: targetUser.roles || [],
        tempPassword,
        createdAt: new Date().toLocaleString(),
      });

      setMessage(`Temporary password reset for ${targetUser.prenom} ${targetUser.nom}.`);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setSavingByUserId((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const buildOfficialRowsTable = (title, rows) => {
    const renderedRows = rows
      .map((row, index) => {
        const fullName = `${row.prenom || ''} ${row.nom || ''}`.trim();
        const roleText = (row.roles || []).map(roleLabel).join(', ');

        return `
          <tr>
            <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${index + 1}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${escapeHtml(fullName)}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${escapeHtml(row.email)}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${escapeHtml(row.telephone || '-')}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${escapeHtml(roleText || '-')}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${escapeHtml(row.tempPassword || 'N/A')}</td>
            <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${escapeHtml(formatFrDate(row.generatedAt || new Date().toISOString()))}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <h3 style="margin-top: 20px; margin-bottom: 10px;">${escapeHtml(title)}</h3>
      <table style="border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #e8e8e8;">
            <th style="border: 1px solid #000000; padding: 8px; text-align: center;">N°</th>
            <th style="border: 1px solid #000000; padding: 8px;">Nom et Prénom</th>
            <th style="border: 1px solid #000000; padding: 8px;">Email</th>
            <th style="border: 1px solid #000000; padding: 8px;">Téléphone</th>
            <th style="border: 1px solid #000000; padding: 8px;">Rôle</th>
            <th style="border: 1px solid #000000; padding: 8px;">Mot de passe</th>
            <th style="border: 1px solid #000000; padding: 8px;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${renderedRows || '<tr><td colspan="7" style="text-align: center;">Aucune donnée</td></tr>'}
        </tbody>
      </table>
    `;
  };

  const exportOfficialCredentialLists = async () => {
    setError('');
    setMessage('');

    try {
      // Fetch real created users from API
      const usersResponse = await authAPI.adminGetUsers();
      const allUsers = usersResponse?.data || [];
      
      // Filter to get students and teachers
      const studentUsers = allUsers.filter((u) => (u.roles || []).includes('etudiant'));
      const teacherUsers = allUsers.filter((u) => (u.roles || []).includes('enseignant'));
      
      // Prepare data with credentials from registry if available
      const studentData = studentUsers.map(user => {
        const registryEntry = credentialRegistry.find(entry => entry.userId === user.id);
        return {
          ...user,
          tempPassword: registryEntry?.tempPassword || '••••••••',
          generatedAt: registryEntry?.generatedAt || user.createdAt || new Date().toISOString()
        };
      });
      
      const teacherData = teacherUsers.map(user => {
        const registryEntry = credentialRegistry.find(entry => entry.userId === user.id);
        return {
          ...user,
          tempPassword: registryEntry?.tempPassword || '••••••••',
          generatedAt: registryEntry?.generatedAt || user.createdAt || new Date().toISOString()
        };
      });

      const today = new Date();
      const dateLabel = today.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const logoHtml = logoBase64 
        ? `<div style="text-align: center; margin: 20px 0;">
            <img src="${logoBase64}" style="max-width: 120px; max-height: 120px; width: auto; height: auto;" />
           </div>`
        : '';

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Fiche de Création des Utilisateurs</title>
            <style>
              @media print {
                body {
                  margin: 0;
                  padding: 0.5cm;
                }
                .page-break {
                  page-break-before: always;
                }
                table {
                  page-break-inside: avoid;
                }
                tr {
                  page-break-inside: avoid;
                }
              }
              
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: 'Arial', 'Calibri', sans-serif;
                margin: 0;
                padding: 20px;
                color: #000000;
                background: white;
              }
              
              .document-container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
              }
              
              .header {
                text-align: center;
                margin-bottom: 30px;
                padding: 20px;
              }
              
              .logo-container {
                text-align: center;
                margin: 20px 0;
              }
              
              .logo-img {
                max-width: 120px;
                max-height: 120px;
                width: auto;
                height: auto;
                display: inline-block;
              }
              
              .arabic-text {
                font-family: 'Traditional Arabic', 'Arial', sans-serif;
                font-size: 16px;
                margin: 10px 0;
              }
              
              .title {
                font-size: 20px;
                font-weight: bold;
                margin: 20px 0 10px 0;
                text-align: center;
              }
              
              .rule {
                border-top: 2px solid #000000;
                margin: 15px 0;
              }
              
              .subtitle {
                font-size: 16px;
                font-weight: bold;
                margin: 10px 0;
              }
              
              .date-info {
                text-align: right;
                margin: 20px 0;
                font-size: 12px;
              }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 11px;
              }
              
              th {
                border: 1px solid #000000;
                padding: 10px 8px;
                background-color: #e8e8e8;
                font-weight: bold;
                text-align: center;
                font-size: 12px;
              }
              
              td {
                border: 1px solid #000000;
                padding: 8px;
                vertical-align: top;
              }
              
              .footer {
                margin-top: 50px;
                padding-top: 30px;
              }
              
              .signatures-table {
                width: 100%;
                margin-top: 30px;
                border: none;
              }
              
              .signatures-table td {
                border: none;
                padding-top: 40px;
                text-align: center;
                vertical-align: bottom;
              }
              
              .signature-line {
                border-top: 1px solid #000000;
                width: 200px;
                margin-top: 10px;
                padding-top: 5px;
              }
              
              .stamp {
                text-align: center;
                margin-top: 30px;
                font-style: italic;
              }
              
              @media print {
                body {
                  margin: 0;
                  padding: 0.5cm;
                }
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="document-container">
              <div class="header">
                <div class="arabic-text">
                  <strong>الجمهورية الجزائرية الديمقراطية الشعبية</strong><br/>
                  <strong>وزارة التعليم العالي و البحث العلمي</strong>
                </div>
                
                ${logoHtml}
                
                <div style="margin: 20px 0;">
                  <strong>${escapeHtml(formMeta.universityName)}</strong><br/>
                  Faculté : ${escapeHtml(formMeta.facultyName)}<br/>
                  Département : ${escapeHtml(formMeta.departmentName)}
                </div>
                
                <div class="rule"></div>
                
                <div class="title">
                  FICHE DE CRÉATION DES UTILISATEURS
                </div>
                
                <div class="rule"></div>
                
                <div class="date-info">
                  Date : ${escapeHtml(dateLabel)}
                </div>
              </div>
              
              ${studentData.length > 0 ? buildOfficialRowsTable('Liste des Étudiants', studentData) : '<p>Aucun étudiant trouvé</p>'}
              ${teacherData.length > 0 ? buildOfficialRowsTable('Liste des Enseignants', teacherData) : '<p>Aucun enseignant trouvé</p>'}
              
              <div class="footer">
                <table class="signatures-table">
                  <tr>
                    <td style="width: 50%; text-align: center;">
                      Signature de l'Utilisateur<br/>
                      <div class="signature-line"></div>
                    </td>
                    <td style="width: 50%; text-align: center;">
                      Signature de l'Administration<br/>
                      <div class="signature-line"></div>
                    </td>
                  </tr>
                </table>
                
                <div class="stamp">
                  Cachet officiel de l'établissement
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      const blob = new Blob([html], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
      });

      const fileName = `fiche_utilisateurs_${today.toISOString().slice(0, 10)}.xls`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Offer print dialog for PDF
      setTimeout(() => {
        if (window.confirm('Do you want to open print dialog to save as PDF?')) {
          const printWindow = window.open('', '_blank');
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      }, 500);

      setMessage('Excel exported successfully with logo and official format.');
    } catch (err) {
      console.error('Export error:', err);
      setError(`Export failed: ${err.message}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="rounded-2xl border border-edge bg-surface p-8 shadow-card">
        <div className="flex items-center gap-3 text-ink-secondary">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          <span>Loading user management...</span>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-edge bg-surface p-8 shadow-card">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-danger">Restricted Area</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">User management is not available for this account.</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Only administrators and vice deans can create accounts, assign roles, and manage access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_28%)]" />
        <div className="relative px-6 py-7 md:px-7 md:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Administration</p>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink md:text-3xl">Admin User Management</h1>
              <p className="mt-2 text-sm leading-6 text-ink-secondary md:text-base">
                Create institutional accounts, assign multiple roles, and keep access clean across the platform.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[440px]">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-edge bg-canvas/90 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-ink-tertiary">{stat.label}</p>
                  <p className={`mt-2 text-2xl font-bold tracking-tight ${stat.tone}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success shadow-card">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger shadow-card">{error}</div> : null}

      <section className={`${sectionClassName} p-6`}>
        <div className="flex flex-col gap-2 border-b border-edge-subtle pb-5">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Official Excel Formulaire</h2>
          <p className="text-sm text-ink-secondary">
            Generate two official lists (students and teachers) with temporary passwords, department, logo, and date.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Université</span>
            <input
              type="text"
              value={formMeta.universityName}
              onChange={(e) => setFormMeta((prev) => ({ ...prev, universityName: e.target.value }))}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Faculté</span>
            <input
              type="text"
              value={formMeta.facultyName}
              onChange={(e) => setFormMeta((prev) => ({ ...prev, facultyName: e.target.value }))}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Département</span>
            <input
              type="text"
              value={formMeta.departmentName}
              onChange={(e) => setFormMeta((prev) => ({ ...prev, departmentName: e.target.value }))}
              className={inputClassName}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={exportOfficialCredentialLists}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-hover"
          >
            Exporter le formulaire Excel officiel
          </button>
        </div>
      </section>

      {/* Rest of the component remains the same */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className={`${sectionClassName} p-6`}>
          <div className="flex flex-col gap-2 border-b border-edge-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">Create New User</h2>
              <p className="mt-1 text-sm text-ink-secondary">Single-user creation is managed here. Use the dedicated list page for table-based bulk creation.</p>
            </div>
            <div className="rounded-full border border-brand/20 bg-brand-light px-3 py-1 text-xs font-medium text-brand">
              {roles.length} roles available
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard/admin/users/list-create')}
              className="rounded-full border border-blue-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
            >
              Open list creation page
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/admin/academic/management')}
              className="rounded-full border border-emerald-700 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Open academic structure page
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/admin/academic/assignments')}
              className="rounded-full border border-indigo-700 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Open assignments page
            </button>
          </div>

          <form onSubmit={handleCreateUser} className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Email</span>
                <input
                  type="email"
                  placeholder="name@univ-ibn-khaldoun.dz"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                  className={inputClassName}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">First Name</span>
                <input
                  type="text"
                  placeholder="Prenom"
                  value={createForm.prenom}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, prenom: e.target.value }))}
                  className={inputClassName}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Last Name</span>
                <input
                  type="text"
                  placeholder="Nom"
                  value={createForm.nom}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, nom: e.target.value }))}
                  className={inputClassName}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Phone</span>
                <input
                  type="text"
                  placeholder="Optional"
                  value={createForm.telephone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, telephone: e.target.value }))}
                  className={inputClassName}
                />
              </label>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Sexe</label>
              <div className="flex flex-wrap gap-2">
                {['', 'H', 'F'].map((value) => (
                  <button
                    key={value || 'none'}
                    type="button"
                    onClick={() => setCreateForm((prev) => ({ ...prev, sexe: value }))}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      createForm.sexe === value
                        ? 'border-brand bg-brand-light text-brand shadow-sm'
                        : 'border-edge bg-canvas text-ink-secondary hover:border-brand/30 hover:text-ink'
                    }`}
                  >
                    {value || 'Not set'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-ink">Roles</label>
                <span className="text-xs text-ink-tertiary">{createForm.roleNames.length} selected</span>
              </div>
              {!roles.length ? (
                <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  No roles found. Make sure your backend has roles data and your account has admin access.
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {baseCreationRoles.map((role) => {
                  const selected = createForm.roleNames.includes(role.nom);
                  return (
                    <label
                      key={role.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                        selected
                          ? 'border-brand bg-brand-light/70 text-ink shadow-sm'
                          : 'border-edge bg-canvas text-ink-secondary hover:border-brand/30 hover:text-ink'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-brand"
                        checked={selected}
                        onChange={() => toggleCreateRole(role.nom)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{roleLabel(role.nom)}</span>
                        <span className="mt-1 block text-xs text-ink-tertiary">{role.description || 'Institutional access role'}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-edge-subtle pt-5">
              <button
                type="submit"
                disabled={creatingUser}
                className="inline-flex items-center rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-60"
              >
                {creatingUser ? 'Creating...' : 'Create User'}
              </button>
              <p className="text-sm text-ink-tertiary">The temporary password will appear in a secure pop-up after creation.</p>
            </div>
          </form>
        </div>

        <aside className={`${sectionClassName} p-6`}>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Admin Checklist</h2>
          <p className="mt-1 text-sm text-ink-secondary">A quick reference so account creation stays consistent.</p>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-edge bg-canvas px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">Before Creating</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-secondary">
                <li>Use the institutional email address.</li>
                <li>Assign all required roles now to avoid partial access.</li>
                <li>Only fill phone and sexe when that data is known.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900">Academic Workflow</p>
              <p className="mt-2 text-xs text-indigo-800">Use dedicated pages for structure creation and assignments.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/admin/academic/management')}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Go to Academic Structure
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/admin/academic/assignments')}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Go to Assignments
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-warning/25 bg-warning/10 px-4 py-4">
              <p className="text-sm font-semibold text-ink">Password Handling</p>
              <p className="mt-2 text-sm leading-6 text-ink-secondary">
                The temporary password is displayed once. Copy it from the modal window and deliver it securely to the user.
              </p>
            </div>
          </div>
        </aside>
      </section>

      {lastCreatedCredentials ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 py-6 backdrop-blur-sm"
          onClick={() => setLastCreatedCredentials(null)}
        >
          <section
            className="w-full max-w-2xl rounded-2xl border border-warning/40 bg-surface shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-edge px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">New User Credentials</h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Save this password now. It is shown once and cannot be read later from the database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLastCreatedCredentials(null)}
                className="rounded-md border border-edge bg-canvas px-3 py-1.5 text-sm font-medium text-ink-secondary hover:text-ink"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
                <div className="rounded-md border border-edge bg-canvas px-3 py-3">
                  <p className="text-xs text-ink-tertiary">Full Name</p>
                  <p className="font-medium text-ink break-words">{lastCreatedCredentials.fullName || 'Not available'}</p>
                </div>
                <div className="rounded-md border border-edge bg-canvas px-3 py-3">
                  <p className="text-xs text-ink-tertiary">User Email</p>
                  <p className="font-medium text-ink break-all">{lastCreatedCredentials.email}</p>
                </div>
                <div className="rounded-md border border-edge bg-canvas px-3 py-3">
                  <p className="text-xs text-ink-tertiary">Assigned Roles</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(lastCreatedCredentials.roles || []).map((roleName) => (
                      <span key={roleName} className="rounded-full border border-brand/25 bg-brand-light px-2 py-1 text-xs font-medium text-brand">
                        {roleLabel(roleName)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-edge bg-canvas px-3 py-3">
                  <p className="text-xs text-ink-tertiary">Generated At</p>
                  <p className="font-medium text-ink">{lastCreatedCredentials.createdAt}</p>
                </div>
              </div>

              <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">Temporary Password</p>
                <p className="mt-2 break-all font-mono text-lg text-ink">{lastCreatedCredentials.tempPassword}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(lastCreatedCredentials.tempPassword, 'Temporary password copied to clipboard.')}
                  className="px-3 py-2 rounded-md bg-brand text-white text-sm font-medium"
                >
                  Copy Password
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(lastCreatedCredentials.email, 'User email copied to clipboard.')}
                  className="px-3 py-2 rounded-md bg-surface-200 text-ink text-sm font-medium border border-edge"
                >
                  Copy Email
                </button>
                <button
                  type="button"
                  onClick={() => setLastCreatedCredentials(null)}
                  className="px-3 py-2 rounded-md bg-canvas text-ink text-sm font-medium border border-edge"
                >
                  Done
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <section className={`${sectionClassName} p-6`}>
        <div className="flex flex-col gap-2 border-b border-edge-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">Existing Users</h2>
            <p className="mt-1 text-sm text-ink-secondary">Review account status and adjust role assignments without leaving the page.</p>
          </div>
          <div className="rounded-full border border-edge bg-canvas px-3 py-1 text-xs font-medium text-ink-secondary">
            {users.length} managed accounts
          </div>
        </div>

        {users.length ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {users.map((u) => {
              const avatarUrl = resolveMediaUrl(u.photo);

              return (
                <div key={u.id} className="rounded-2xl border border-edge bg-canvas p-5 shadow-sm transition hover:border-brand/25">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={`${u.prenom || ''} ${u.nom || ''}`.trim() || 'User'}
                        className="h-12 w-12 shrink-0 rounded-2xl object-cover border border-edge"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-sm font-bold text-brand">
                        {getInitials(u.prenom, u.nom)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-ink">{u.prenom} {u.nom}</p>
                      <p className="truncate text-sm text-ink-secondary">{u.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium border ${
                          u.status === 'active'
                            ? 'border-success/25 bg-success/10 text-success'
                            : u.status === 'suspended'
                              ? 'border-danger/25 bg-danger/10 text-danger'
                              : 'border-edge bg-surface text-ink-secondary'
                        }`}>
                          {u.status || 'unknown'}
                        </span>
                        <span className="text-xs text-ink-tertiary">
                          Last login: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {(u.roles || []).map((r) => (
                      <span key={`${u.id}-${r}`} className="rounded-full border border-brand/25 bg-brand-light px-2.5 py-1 text-xs font-medium text-brand">
                        {roleLabel(r)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-2xl border border-edge bg-surface px-4 py-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-tertiary">Phone</p>
                    <p className="mt-1 text-sm font-medium text-ink">{u.telephone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-tertiary">Created</p>
                    <p className="mt-1 text-sm font-medium text-ink">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Unknown'}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-edge bg-surface px-4 py-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">Account Status</p>
                    <span className="text-xs text-ink-tertiary">Change access availability</span>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <select
                      value={editingStatusByUserId[u.id] || u.status || 'active'}
                      onChange={(event) => setEditingStatusByUserId((prev) => ({ ...prev, [u.id]: event.target.value }))}
                      className="rounded-xl border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                      <option value="suspended">suspended</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => saveUserStatus(u.id)}
                      disabled={!!savingByUserId[u.id]}
                      className="rounded-xl border border-edge bg-surface-200 px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-60"
                    >
                      {savingByUserId[u.id] ? 'Saving...' : 'Save Status'}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">Edit Roles</p>
                    <span className="text-xs text-ink-tertiary">{(editingRolesByUserId[u.id] || []).length} selected</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {roles
                    .filter((role) => {
                      const track = detectUserTrack(editingRolesByUserId[u.id] || u.roles || []);
                      return track === 'student'
                        ? STUDENT_TRACK_ROLE_NAMES.includes(role.nom)
                        : !STUDENT_TRACK_ROLE_NAMES.includes(role.nom);
                    })
                    .map((role) => {
                      const checked = (editingRolesByUserId[u.id] || []).includes(role.nom);
                      return (
                        <label
                          key={`${u.id}-${role.id}`}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                            checked
                              ? 'border-brand bg-brand-light/70 text-ink'
                              : 'border-edge bg-surface text-ink-secondary hover:border-brand/30 hover:text-ink'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-brand"
                            checked={checked}
                            onChange={() => toggleUserRole(u.id, role.nom)}
                          />
                          <span>{roleLabel(role.nom)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-edge-subtle pt-4">
                  <p className="text-xs text-ink-tertiary">Changes apply immediately after saving.</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleResetUserPassword(u)}
                      disabled={!!savingByUserId[u.id]}
                      className="rounded-xl border border-edge bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:border-brand/30 hover:text-brand disabled:opacity-60"
                    >
                      {savingByUserId[u.id] ? 'Processing...' : 'Reset Temp Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveUserRoles(u.id)}
                      disabled={!!savingByUserId[u.id]}
                      className="rounded-xl border border-edge bg-surface-200 px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-60"
                    >
                      {savingByUserId[u.id] ? 'Saving...' : 'Save Roles'}
                    </button>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-edge bg-canvas px-6 py-10 text-center">
            <p className="text-base font-medium text-ink">No users found.</p>
            <p className="mt-2 text-sm text-ink-secondary">Create the first account from the form above to start managing access.</p>
          </div>
        )}
      </section>
    </div>
  );
}