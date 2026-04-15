import React, { useEffect, useMemo, useRef, useState } from 'react';
import request, { resolveMediaUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const FALLBACK_DOCUMENTS = [
  { id: 'doc-1', name: 'Enrollment Certificate', category: 'Administrative', format: 'PDF', size: '180 KB', updatedAt: '2026-03-01' },
  { id: 'doc-2', name: 'Official Transcript', category: 'Academic', format: 'PDF', size: '420 KB', updatedAt: '2026-02-25' },
  { id: 'doc-3', name: 'Project Defense Template', category: 'PFE', format: 'DOCX', size: '96 KB', updatedAt: '2026-02-20' },
  { id: 'doc-4', name: 'Academic Calendar 2025/2026', category: 'Calendar', format: 'PDF', size: '260 KB', updatedAt: '2026-01-18' },
];

const CATEGORY_PILL_STYLES = {
  enseignement: 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  administratif: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  scientifique: 'bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
  pedagogique: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  autre: 'bg-surface-200 text-ink-secondary',
  Administrative: 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  Academic: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  PFE: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  Calendar: 'bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
};

const STATUS_STYLES = {
  en_attente: 'bg-surface-200 text-ink-secondary',
  en_traitement: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  valide: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  refuse: 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-200',
};

const STATUS_LABELS = {
  en_attente: 'En attente',
  en_traitement: 'En traitement',
  valide: 'Validé',
  refuse: 'Refusé',
};

function normalizeRows(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function DocumentsHeader({ eyebrow, title, description }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_30%)]" />
      <div className="relative px-6 py-8 md:px-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">{description}</p>
      </div>
    </section>
  );
}

function TeacherView() {
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [typesRes, docsRes] = await Promise.all([
        request('/api/v1/documents'),
        request('/api/v1/documents/my-requests'),
      ]);
      setDocTypes(normalizeRows(typesRes));
      setDocuments(normalizeRows(docsRes));
    } catch {
      setDocTypes([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateRequest = async () => {
    if (!selectedType) {
      return;
    }

    setRequestLoading(true);
    try {
      await request('/api/v1/documents/request', {
        method: 'POST',
        body: JSON.stringify({ typeDocId: Number(selectedType), description: 'Document request' }),
      });
      setSelectedType('');
      await loadAll();
    } catch {
    } finally {
      setRequestLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
      return documents;
    }

    return documents.filter((doc) => [doc.name, doc.category, doc.status].some((value) => String(value || '').toLowerCase().includes(lower)));
  }, [documents, query]);

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      <DocumentsHeader
        eyebrow="Espace Enseignant"
        title="Documents"
        description="Soumettez une demande de document, suivez son état, puis téléchargez le fichier une fois validé."
      />

      <section className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-lg font-semibold text-ink">Nouvelle demande</h2>
        <p className="mb-4 text-sm text-ink-secondary">Sélectionnez un type de document puis envoyez votre demande.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
            className="flex-1 rounded-xl border border-edge bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Choisir le type de document</option>
            {docTypes.map((doc) => (
              <option key={doc.id} value={doc.id}>{(doc.nom_ar || doc.nom_en || 'Document')} - {doc.categorie}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateRequest}
            disabled={requestLoading || !selectedType}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requestLoading ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Mes demandes</h2>
            <p className="mt-1 text-sm text-ink-secondary">Historique et état des demandes.</p>
          </div>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-72"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-6 text-ink-secondary">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-edge-strong border-t-brand" />
            <span>Chargement...</span>
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((doc) => (
              <article key={doc.id} className="rounded-2xl border border-edge bg-canvas p-4 shadow-sm transition hover:border-edge-strong">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold leading-6 text-ink">{doc.name}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_PILL_STYLES[doc.category] || CATEGORY_PILL_STYLES.autre}`}>
                    {doc.category}
                  </span>
                </div>
                <div className="mt-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[doc.status] || STATUS_STYLES.en_attente}`}>
                    {STATUS_LABELS[doc.status] || doc.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-ink-tertiary">Mis à jour : {doc.updatedAt || 'N/A'}</p>
                {doc.status === 'valide' && doc.documentUrl ? (
                  <a
                    href={resolveMediaUrl(`/api/v1/documents/download/${doc.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 block w-full rounded-xl bg-brand px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-brand-hover"
                  >
                    Télécharger
                  </a>
                ) : (
                  <div className="mt-4 w-full rounded-xl bg-canvas px-3 py-2 text-center text-xs text-ink-tertiary">
                    {doc.status === 'refuse' ? 'Demande refusée' : 'En attente de traitement'}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-edge bg-canvas px-6 py-10 text-center">
            <p className="text-base font-medium text-ink">Aucune demande trouvée.</p>
            <p className="mt-2 text-sm text-ink-secondary">Soumettez votre première demande ci-dessus.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function AdminView() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [uploading, setUploading] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [pendingUploadId, setPendingUploadId] = useState(null);
  const fileInputRef = useRef(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await request('/api/v1/documents/all-requests');
      setRequests(normalizeRows(response));
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleUploadClick = (requestId) => {
    setPendingUploadId(requestId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !pendingUploadId) {
      return;
    }

    event.target.value = '';
    setUploading(pendingUploadId);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('requestId', String(pendingUploadId));

      await request('/api/v1/documents/upload', {
        method: 'POST',
        body: formData,
      });

      await loadRequests();
    } catch {
    } finally {
      setUploading(null);
      setPendingUploadId(null);
    }
  };

  const handleAction = async (requestId, action) => {
    setActionLoading(`${requestId}-${action}`);
    try {
      await request(`/api/v1/documents/${requestId}/valider`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });

      await loadRequests();
    } catch {
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = useMemo(() => {
    let rows = requests;
    if (filterStatus) {
      rows = rows.filter((row) => row.status === filterStatus);
    }

    const lower = query.trim().toLowerCase();
    if (!lower) {
      return rows;
    }

    return rows.filter((row) => [row.enseignantNom, row.name, row.category, row.status].some((value) => String(value || '').toLowerCase().includes(lower)));
  }, [requests, query, filterStatus]);

  const counts = useMemo(
    () => ({
      total: requests.length,
      en_attente: requests.filter((requestRow) => requestRow.status === 'en_attente').length,
      en_traitement: requests.filter((requestRow) => requestRow.status === 'en_traitement').length,
      valide: requests.filter((requestRow) => requestRow.status === 'valide').length,
    }),
    [requests]
  );

  return (
    <div className="space-y-6 max-w-7xl min-w-0">
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />

      <DocumentsHeader
        eyebrow="Administration"
        title="Gestion des documents"
        description="Traitez les demandes des enseignants, chargez les fichiers puis validez ou refusez les documents."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: counts.total, color: 'text-ink' },
          { label: 'En attente', value: counts.en_attente, color: 'text-ink-secondary' },
          { label: 'En traitement', value: counts.en_traitement, color: 'text-amber-600' },
          { label: 'Validées', value: counts.valide, color: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-edge bg-surface p-4">
            <p className="text-xs text-ink-secondary">{stat.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">Toutes les demandes</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="rounded-xl border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="en_traitement">En traitement</option>
              <option value="valide">Validé</option>
              <option value="refuse">Refusé</option>
            </select>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher enseignant, document..."
              className="w-full rounded-xl border border-edge bg-canvas px-3.5 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-8 text-ink-secondary">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-edge-strong border-t-brand" />
            <span>Chargement...</span>
          </div>
        ) : filtered.length ? (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-edge">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge bg-canvas">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-secondary">Enseignant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-secondary">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-secondary">Catégorie</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-secondary">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-secondary">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => (
                  <tr key={row.id} className={`border-b border-edge transition hover:bg-canvas ${index % 2 === 0 ? '' : 'bg-surface/50'}`}>
                    <td className="px-4 py-3 font-medium text-ink">{row.enseignantNom || '—'}</td>
                    <td className="px-4 py-3 text-ink-secondary">{row.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_PILL_STYLES[row.category] || CATEGORY_PILL_STYLES.autre}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{row.updatedAt || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[row.status] || STATUS_STYLES.en_attente}`}>
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(row.status === 'en_attente' || row.status === 'en_traitement') && (
                          <button
                            type="button"
                            onClick={() => handleUploadClick(row.id)}
                            disabled={uploading === row.id}
                            className="rounded-lg bg-canvas px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface disabled:opacity-50"
                          >
                            {uploading === row.id ? 'Upload...' : 'Uploader'}
                          </button>
                        )}

                        {row.status === 'en_traitement' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAction(row.id, 'valide')}
                              disabled={Boolean(actionLoading)}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {actionLoading === `${row.id}-valide` ? '...' : 'Valider'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(row.id, 'refuse')}
                              disabled={Boolean(actionLoading)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                              {actionLoading === `${row.id}-refuse` ? '...' : 'Refuser'}
                            </button>
                          </>
                        )}

                        {row.status === 'valide' && row.documentUrl && (
                          <a
                            href={resolveMediaUrl(`/api/v1/documents/download/${row.id}`)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-hover"
                          >
                            Télécharger
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-edge bg-canvas px-6 py-10 text-center">
            <p className="text-base font-medium text-ink">Aucune demande trouvée.</p>
            <p className="mt-2 text-sm text-ink-secondary">Ajustez les filtres ou attendez de nouvelles demandes.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function StudentView() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await request('/api/v1/student/documents');
        if (!cancelled) {
          const rows = normalizeRows(response);
          setDocuments(rows.map((item) => ({
            id: item.id,
            name: item.name || item.nom || 'Document',
            category: item.category || item.categorie || 'Autre',
            format: item.format || 'PDF',
            size: item.size || 'N/A',
            updatedAt: item.updatedAt || item.createdAt || null,
            downloadUrl: item.url || item.documentUrl || null,
          })));
        }
      } catch {
        if (!cancelled) {
          setDocuments(FALLBACK_DOCUMENTS);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
      return documents;
    }

    return documents.filter((doc) => [doc.name, doc.category, doc.format].some((value) => String(value || '').toLowerCase().includes(lower)));
  }, [documents, query]);

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      <DocumentsHeader
        eyebrow="Espace Étudiant"
        title="Documents"
        description="Consultez et téléchargez les documents académiques et administratifs disponibles."
      />

      <section className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Fichiers disponibles</h2>
            <p className="mt-1 text-sm text-ink-secondary">Recherchez par nom, catégorie ou format.</p>
          </div>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un document..."
            className="w-full rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-72"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-6 text-ink-secondary">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-edge-strong border-t-brand" />
            <span>Chargement...</span>
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((doc) => (
              <article key={doc.id} className="rounded-2xl border border-edge bg-canvas p-4 shadow-sm transition hover:border-edge-strong">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold leading-6 text-ink">{doc.name}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_PILL_STYLES[doc.category] || CATEGORY_PILL_STYLES.autre}`}>
                    {doc.category}
                  </span>
                </div>
                <p className="mt-3 text-xs text-ink-tertiary">Mis à jour : {doc.updatedAt || 'N/A'}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-secondary">
                  <span>{doc.format}</span>
                  <span>{doc.size}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!doc.downloadUrl) {
                      return;
                    }
                    window.open(resolveMediaUrl(doc.downloadUrl), '_blank', 'noopener,noreferrer');
                  }}
                  disabled={!doc.downloadUrl}
                  className="mt-4 w-full rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {doc.downloadUrl ? 'Télécharger' : 'Indisponible'}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-edge bg-canvas px-6 py-10 text-center">
            <p className="text-base font-medium text-ink">Aucun document disponible.</p>
            <p className="mt-2 text-sm text-ink-secondary">Revenez plus tard ou contactez l'administration.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const roles = Array.isArray(user?.roles) ? user.roles.map((role) => String(role || '').toLowerCase()) : [];

  const isAdmin = roles.some((role) => ['admin', 'vice_doyen', 'admin_faculte'].includes(role));
  const isTeacher = roles.includes('enseignant');
  const isStudent = roles.some((role) => ['etudiant', 'delegue'].includes(role));

  if (isAdmin) {
    return <AdminView />;
  }

  if (isTeacher) {
    return <TeacherView />;
  }

  if (isStudent) {
    return <StudentView />;
  }

  return (
    <div className="max-w-3xl space-y-6 min-w-0">
      <DocumentsHeader
        eyebrow="Documents"
        title="Accès limité"
        description="Votre rôle ne dispose pas d'une vue documents dédiée dans ce module."
      />
      <section className="rounded-3xl border border-edge bg-surface p-6 shadow-card">
        <p className="text-sm text-ink-secondary">Contactez l'administration pour demander l'activation d'accès appropriés.</p>
      </section>
    </div>
  );
}

