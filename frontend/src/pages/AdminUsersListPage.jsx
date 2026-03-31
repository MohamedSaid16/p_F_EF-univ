import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function hasAdminAccess(roles) {
  if (!Array.isArray(roles)) return false;
  return roles
    .map((role) => String(role || '').toLowerCase())
    .some((role) => ['admin', 'vice_doyen'].includes(role));
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'enseignant', label: 'Teacher' },
  { value: 'etudiant', label: 'Student' },
];

function roleLabel(roleName) {
  if (roleName === 'admin') return 'Admin';
  if (roleName === 'enseignant') return 'Teacher';
  if (roleName === 'etudiant') return 'Student';
  return roleName;
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

const emptyRow = () => ({
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  roleNames: [],
});

export default function AdminUsersListPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const canAccess = hasAdminAccess(user?.roles);

  const [rows, setRows] = useState([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fileToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const getLogoBase64 = async () => {
    try {
      const response = await fetch('/Logo.png');
      if (!response.ok) return '';
      const blob = await response.blob();
      return await fileToDataUrl(blob);
    } catch {
      return '';
    }
  };

  const exportCreatedCredentials = async (createdRows) => {
    try {
      const logoDataUrl = await getLogoBase64();
      const today = new Date();
      const dateLabel = today.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const renderedRows = createdRows
        .map((row, index) => {
          const fullName = `${row.prenom || ''} ${row.nom || ''}`.trim();
          const roleText = (row.roleNames || []).map(roleLabel).join(', ');
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(fullName)}</td>
              <td>${escapeHtml(row.email)}</td>
              <td>${escapeHtml(row.telephone || '-')}</td>
              <td>${escapeHtml(roleText || '-')}</td>
              <td>${escapeHtml(row.tempPassword)}</td>
              <td>${escapeHtml(formatFrDate(row.generatedAt))}</td>
            </tr>
          `;
        })
        .join('');

      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Calibri, Arial, sans-serif; margin: 20px; color: #000; }
              .header { text-align: center; }
              .title { font-size: 20px; font-weight: bold; margin-top: 10px; }
              .rule { border-top: 2px solid black; margin: 10px 0; }
              table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 20px; }
              th, td { border: 1px solid black; padding: 6px; font-size: 12px; text-align: center; }
              th { background-color: #d9d9d9; font-weight: bold; }
              .logo-container { text-align: center; margin-bottom: 20px; }
              .logo-img { max-width: 100px; max-height: 100px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>الجمهورية الجزائرية الديمقراطية الشعبية</h2>
              <h3>وزارة التعليم العالي و البحث العلمي</h3>
              ${logoDataUrl ? `<div class="logo-container"><img src="${logoDataUrl}" class="logo-img" /></div>` : ''}
              <h2>Université Ibn Khaldoun - Tiaret</h2>
              <p>Faculté : Faculté des Sciences et Technologies</p>
              <p>Département : Département Informatique</p>
              <div class="rule"></div>
              <div class="title">FICHE OFFICIELLE DE CRÉATION DES UTILISATEURS</div>
              <div class="rule"></div>
              <p>Date : ${escapeHtml(dateLabel)}</p>
            </div>

            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Nom et Prénom</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Rôle</th>
                  <th>Mot de passe</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${renderedRows || '<tr><td colspan="7">Aucune donnée</td></tr>'}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const fileName = `fiche_utilisateurs_liste_${today.toISOString().slice(0, 10)}.xls`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      throw err;
    }
  };

  const updateRow = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const toggleRole = (index, roleName) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const current = row.roleNames || [];
      const next = current.includes(roleName)
        ? current.filter((name) => name !== roleName)
        : [...current, roleName];
      return { ...row, roleNames: next };
    }));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (index) => {
    setRows((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  };

  const validateRow = (row, rowIndex) => {
    if (!row.nom.trim() || !row.prenom.trim() || !row.email.trim()) {
      return `Row ${rowIndex + 1}: nom, prenom, and email are required.`;
    }

    if (!row.roleNames.length) {
      return `Row ${rowIndex + 1}: select at least one role.`;
    }

    const hasStudent = row.roleNames.includes('etudiant');
    const hasStaff = row.roleNames.some((r) => ['admin', 'enseignant'].includes(r));
    if (hasStudent && hasStaff) {
      return `Row ${rowIndex + 1}: student role cannot be mixed with teacher/admin roles.`;
    }

    return null;
  };

  const submitList = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const activeRows = rows.filter((row) => row.nom.trim() || row.prenom.trim() || row.email.trim());
    if (!activeRows.length) {
      setError('Please fill at least one row.');
      return;
    }

    for (let i = 0; i < activeRows.length; i += 1) {
      const validationError = validateRow(activeRows[i], i);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setLoading(true);
    try {
      let created = 0;
      const failures = [];
      const createdRows = [];

      for (const row of activeRows) {
        try {
          const response = await authAPI.adminCreateUser({
            nom: row.nom.trim(),
            prenom: row.prenom.trim(),
            email: row.email.trim(),
            telephone: row.telephone.trim() || undefined,
            roleNames: row.roleNames,
          });

          const tempPassword = response?.data?.tempPassword;
          if (!tempPassword) {
            throw new Error('Temporary password not returned');
          }

          createdRows.push({
            nom: row.nom.trim(),
            prenom: row.prenom.trim(),
            email: row.email.trim(),
            telephone: row.telephone.trim(),
            roleNames: row.roleNames,
            tempPassword,
            generatedAt: new Date().toISOString(),
          });

          created += 1;
        } catch (err) {
          failures.push(`${row.email.trim()}: ${err?.message || 'failed'}`);
        }
      }

      if (createdRows.length > 0) {
        try {
          await exportCreatedCredentials(createdRows);
        } catch (exportErr) {
          console.error('Failed to export:', exportErr);
          setError((prev) => `${prev} Warning: Excel export failed, but ${created} user(s) were created successfully.`);
        }
      }

      if (failures.length) {
        setError(`Created ${created}. Excel downloaded for successful rows. Failed ${failures.length}: ${failures.slice(0, 3).join(' | ')}`);
      } else if (createdRows.length > 0) {
        setMessage(`List created successfully. ${created} user(s) created and Excel downloaded automatically.`);
        setRows([emptyRow()]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="rounded-2xl border border-edge bg-surface p-8 shadow-card">
        <div className="flex items-center gap-3 text-ink-secondary">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          <span>Loading list creation...</span>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-edge bg-surface p-8 shadow-card">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-danger">Restricted Area</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">List creation is not available for this account.</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(22,163,74,0.14),transparent_30%)]" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Create Users List</h1>
            <p className="mt-1 text-sm text-ink-secondary">Add users in a table and choose roles using checklist boxes.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/users')}
            className="relative rounded-xl border border-edge bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:border-brand/30 hover:text-brand"
          >
            Back to Admin Users
          </button>
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success shadow-card">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger shadow-card">{error}</div> : null}

      <form onSubmit={submitList} className="rounded-2xl border border-edge bg-surface shadow-card p-6 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-edge-subtle bg-cyan-50/80">
                <th className="text-left px-3 py-3 text-ink uppercase text-xs font-semibold">Nom</th>
                <th className="text-left px-3 py-3 text-ink uppercase text-xs font-semibold">Prenom</th>
                <th className="text-left px-3 py-3 text-ink uppercase text-xs font-semibold">Email</th>
                <th className="text-left px-3 py-3 text-ink uppercase text-xs font-semibold">Telephone</th>
                <th className="text-left px-3 py-3 text-ink uppercase text-xs font-semibold">Roles</th>
                <th className="text-right px-3 py-3 text-ink uppercase text-xs font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`row-${index}`} className={`border-b border-edge-subtle ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                  <td className="px-3 py-2">
                    <input
                      value={row.nom}
                      onChange={(e) => updateRow(index, 'nom', e.target.value)}
                      className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      placeholder="Nom"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.prenom}
                      onChange={(e) => updateRow(index, 'prenom', e.target.value)}
                      className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      placeholder="Prenom"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="email"
                      value={row.email}
                      onChange={(e) => updateRow(index, 'email', e.target.value)}
                      className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      placeholder="email@univ.dz"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.telephone}
                      onChange={(e) => updateRow(index, 'telephone', e.target.value)}
                      className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      placeholder="055..."
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-3">
                      {ROLE_OPTIONS.map((role) => (
                        <label key={`${index}-${role.value}`} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${row.roleNames.includes(role.value) ? 'border-cyan-300 bg-cyan-100 text-cyan-800' : 'border-edge bg-canvas text-ink-secondary hover:border-cyan-200 hover:bg-cyan-50'}`}>
                          <input
                            type="checkbox"
                            className="accent-brand"
                            checked={row.roleNames.includes(role.value)}
                            onChange={() => toggleRole(index, role.value)}
                          />
                          <span>{role.label}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:border-red-300 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3">
          <button
            type="button"
            onClick={addRow}
            className="rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:border-cyan-400 hover:bg-cyan-100"
          >
            Add row
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? 'Creating list...' : 'Create List'}
          </button>
        </div>
      </form>
    </div>
  );
}
