import React, { useEffect, useMemo, useState, useRef } from 'react';
import request from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// ─────────────────────────────────────────────────────────────
// Constantes de style
// ─────────────────────────────────────────────────────────────

const CATEGORY_STYLES = {
  enseignement:  'border-blue-200 bg-blue-50 text-blue-700',
  administratif: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  scientifique:  'border-violet-200 bg-violet-50 text-violet-700',
  pedagogique:   'border-amber-200 bg-amber-50 text-amber-700',
  autre:         'border-gray-200 bg-gray-50 text-gray-600',
};

const STATUS_STYLES = {
  en_attente:    'border-gray-200 bg-gray-50 text-gray-600',
  en_traitement: 'border-amber-200 bg-amber-50 text-amber-700',
  valide:        'border-emerald-200 bg-emerald-50 text-emerald-700',
  refuse:        'border-red-200 bg-red-50 text-red-700',
};

const STATUS_LABELS = {
  en_attente:    'En attente',
  en_traitement: 'En traitement',
  valide:        'Validé',
  refuse:        'Refusé',
};

const STATUS_DOT = {
  valide:        'bg-emerald-500',
  refuse:        'bg-red-500',
  en_traitement: 'bg-amber-500',
  en_attente:    'bg-gray-400',
};

// ─────────────────────────────────────────────────────────────
// Vue ENSEIGNANT
// ─────────────────────────────────────────────────────────────

function TeacherView() {
  const [loading, setLoading]               = useState(true);
  const [documents, setDocuments]           = useState([]);
  const [docTypes, setDocTypes]             = useState([]);
  const [query, setQuery]                   = useState('');
  const [selectedType, setSelectedType]     = useState('');
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const typesRes = await request('/api/v1/documents');
        if (!cancelled) setDocTypes(typesRes?.data || []);
      } catch (e) {
        console.error('Erreur types:', e);
      }
      try {
        const docsRes = await request('/api/v1/documents/my-requests');
        if (!cancelled) setDocuments(docsRes?.data || []);
      } catch (e) {
        console.error('Erreur demandes:', e);
        if (!cancelled) setDocuments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleCreateRequest = async () => {
    if (!selectedType) { alert('Veuillez choisir un type de document.'); return; }
    setRequestLoading(true);
    try {
      const res = await request('/api/v1/documents/request', {
        method: 'POST',
        body: JSON.stringify({ typeDocId: Number(selectedType), description: 'Demande de document' }),
      });
      setDocuments((prev) => [{
        id: res.data.id,
        name: res.data.typeDoc?.nom ?? 'Document',
        category: res.data.typeDoc?.categorie ?? 'autre',
        status: res.data.status,
        documentUrl: null,
        updatedAt: new Date().toISOString().split('T')[0],
      }, ...prev]);
      setSelectedType('');
    } catch (err) {
      alert(err?.message || 'Erreur lors de l\'envoi.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleDownload = (docId) =>
    window.open(`http://localhost:5000/api/v1/documents/download/${docId}`, '_blank');

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return documents;
    return documents.filter((doc) =>
      [doc.name, doc.category, doc.status].some((v) =>
        String(v || '').toLowerCase().includes(lower)));
  }, [documents, query]);

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_30%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Espace Enseignant</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Documents</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
            Soumettez une demande de document administratif et suivez l'état de vos demandes.
          </p>
        </div>
      </section>

      {/* Nouvelle demande */}
      <section className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
        <h2 className="text-lg font-semibold text-ink mb-1">Nouvelle demande</h2>
        <p className="text-sm text-ink-secondary mb-4">Sélectionnez un type de document et soumettez votre demande.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="flex-1 rounded-xl border border-edge bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Choisir le type de document</option>
            {docTypes.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.nom} — {doc.categorie}</option>
            ))}
          </select>
          <button
            onClick={handleCreateRequest}
            disabled={requestLoading || !selectedType}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {requestLoading ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </div>
      </section>

      {/* Mes demandes */}
      <section className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Mes demandes</h2>
            <p className="mt-1 text-sm text-ink-secondary">Historique et état de vos demandes.</p>
          </div>
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full sm:w-72 rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-ink-secondary py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
            <span>Chargement...</span>
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((doc) => (
              <article key={doc.id} className="rounded-2xl border border-edge bg-canvas p-4 shadow-sm transition hover:border-brand/25">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink leading-6">{doc.name}</h3>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${CATEGORY_STYLES[doc.category] || CATEGORY_STYLES.autre}`}>
                    {doc.category}
                  </span>
                </div>
                <div className="mt-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[doc.status] || STATUS_STYLES.en_attente}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[doc.status] || 'bg-gray-400'}`} />
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-ink-tertiary">Mis à jour : {doc.updatedAt || 'N/A'}</p>
                {doc.status === 'valide' && doc.documentUrl ? (
                  <button type="button" onClick={() => handleDownload(doc.id)}
                    className="mt-4 w-full rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-hover">
                    Télécharger
                  </button>
                ) : (
                  <div className="mt-4 w-full rounded-xl border border-dashed border-edge px-3 py-2 text-center text-xs text-ink-tertiary">
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

// ─────────────────────────────────────────────────────────────
// Vue ADMIN — liste toutes les demandes + upload + valider
// ─────────────────────────────────────────────────────────────

function AdminView() {
  const [loading, setLoading]         = useState(true);
  const [requests, setRequests]       = useState([]);
  const [query, setQuery]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [uploading, setUploading]     = useState(null); // id de la demande en cours d'upload
  const [actionLoading, setActionLoading] = useState(null);
  const fileInputRef                  = useRef(null);
  const [pendingUploadId, setPendingUploadId] = useState(null);

  const loadRequests = async () => {
    try {
      const res = await request('/api/v1/documents/all-requests');
      setRequests(res?.data || []);
    } catch (e) {
      console.error('Erreur chargement demandes admin:', e);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, []);

  // Déclenche le file picker pour une demande spécifique
  const handleUploadClick = (requestId) => {
    setPendingUploadId(requestId);
    fileInputRef.current?.click();
  };

  // Upload du fichier après sélection
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadId) return;
    e.target.value = '';

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
    } catch (err) {
      alert(err?.message || 'Erreur lors de l\'upload.');
    } finally {
      setUploading(null);
      setPendingUploadId(null);
    }
  };

  // Valider ou refuser une demande
  const handleAction = async (requestId, action) => {
    setActionLoading(requestId + action);
    try {
      await request(`/api/v1/documents/${requestId}/valider`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      await loadRequests();
    } catch (err) {
      alert(err?.message || 'Erreur.');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = useMemo(() => {
    let list = requests;
    if (filterStatus) list = list.filter((r) => r.status === filterStatus);
    const lower = query.trim().toLowerCase();
    if (lower) list = list.filter((r) =>
      [r.enseignantNom, r.name, r.category, r.status].some((v) =>
        String(v || '').toLowerCase().includes(lower)));
    return list;
  }, [requests, query, filterStatus]);

  const counts = useMemo(() => ({
    total:         requests.length,
    en_attente:    requests.filter((r) => r.status === 'en_attente').length,
    en_traitement: requests.filter((r) => r.status === 'en_traitement').length,
    valide:        requests.filter((r) => r.status === 'valide').length,
    refuse:        requests.filter((r) => r.status === 'refuse').length,
  }), [requests]);

  return (
    <div className="space-y-6 max-w-7xl min-w-0">
      {/* Input fichier caché */}
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />

      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_30%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-600">Administration</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Gestion des documents</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
            Traitez les demandes de documents des enseignants — uploadez les fichiers et validez ou refusez chaque demande.
          </p>
        </div>
      </section>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: counts.total, color: 'text-ink' },
          { label: 'En attente', value: counts.en_attente, color: 'text-gray-600' },
          { label: 'En traitement', value: counts.en_traitement, color: 'text-amber-600' },
          { label: 'Validées', value: counts.valide, color: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-edge bg-surface p-4">
            <p className="text-xs text-ink-secondary">{stat.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <section className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">
            Toutes les demandes
            <span className="ml-2 text-sm font-normal text-ink-secondary">({filtered.length})</span>
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="en_traitement">En traitement</option>
              <option value="valide">Validé</option>
              <option value="refuse">Refusé</option>
            </select>
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher enseignant, document..."
              className="w-full sm:w-64 rounded-xl border border-edge bg-canvas px-3.5 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-ink-secondary py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
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
                {filtered.map((req, i) => (
                  <tr key={req.id} className={`border-b border-edge transition hover:bg-canvas ${i % 2 === 0 ? '' : 'bg-surface/50'}`}>
                    <td className="px-4 py-3 font-medium text-ink">{req.enseignantNom ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-secondary">{req.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${CATEGORY_STYLES[req.category] || CATEGORY_STYLES.autre}`}>
                        {req.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{req.updatedAt || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[req.status] || STATUS_STYLES.en_attente}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[req.status] || 'bg-gray-400'}`} />
                        {STATUS_LABELS[req.status] ?? req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Upload — disponible si en_attente ou en_traitement */}
                        {(req.status === 'en_attente' || req.status === 'en_traitement') && (
                          <button
                            onClick={() => handleUploadClick(req.id)}
                            disabled={uploading === req.id}
                            className="rounded-lg border border-edge bg-canvas px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface disabled:opacity-50"
                          >
                            {uploading === req.id ? 'Upload...' : 'Uploader'}
                          </button>
                        )}
                        {/* Valider / Refuser — disponible si en_traitement */}
                        {req.status === 'en_traitement' && (
                          <>
                            <button
                              onClick={() => handleAction(req.id, 'valide')}
                              disabled={!!actionLoading}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {actionLoading === req.id + 'valide' ? '...' : 'Valider'}
                            </button>
                            <button
                              onClick={() => handleAction(req.id, 'refuse')}
                              disabled={!!actionLoading}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                              {actionLoading === req.id + 'refuse' ? '...' : 'Refuser'}
                            </button>
                          </>
                        )}
                        {/* Télécharger — disponible si validé */}
                        {req.status === 'valide' && req.documentUrl && (
                          <a
                            href={`http://localhost:5000/api/v1/documents/download/${req.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-hover"
                          >
                            Télécharger
                          </a>
                        )}
                        {req.status === 'refuse' && (
                          <span className="text-xs text-ink-tertiary">Refusée</span>
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
            <p className="mt-2 text-sm text-ink-secondary">
              {filterStatus ? 'Changez le filtre de statut.' : 'Les enseignants n\'ont pas encore soumis de demandes.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Vue ÉTUDIANT — documents disponibles en consultation
// ─────────────────────────────────────────────────────────────

const STUDENT_CATEGORY_STYLES = {
  Administrative: 'border-blue-200 bg-blue-50 text-blue-700',
  Academic:       'border-emerald-200 bg-emerald-50 text-emerald-700',
  PFE:            'border-amber-200 bg-amber-50 text-amber-700',
  Calendar:       'border-violet-200 bg-violet-50 text-violet-700',
};

function StudentView() {
  const [loading, setLoading]   = useState(true);
  const [documents, setDocuments] = useState([]);
  const [query, setQuery]       = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await request('/api/v1/student/documents');
        if (!cancelled) setDocuments(res?.data || []);
      } catch (e) {
        console.error('Erreur documents étudiant:', e);
        if (!cancelled) setDocuments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return documents;
    return documents.filter((doc) =>
      [doc.name, doc.category, doc.format].some((v) =>
        String(v || '').toLowerCase().includes(lower)));
  }, [documents, query]);

  const handleDownload = (docId) =>
    window.open(`http://localhost:5000/api/v1/documents/download/${docId}`, '_blank');

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_30%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Espace Étudiant</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Documents</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
            Consultez et téléchargez vos documents académiques et administratifs.
          </p>
        </div>
      </section>

      {/* Liste documents */}
      <section className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Fichiers disponibles</h2>
            <p className="mt-1 text-sm text-ink-secondary">Recherchez par nom, catégorie ou format.</p>
          </div>
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un document..."
            className="w-full sm:w-72 rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-ink-secondary py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
            <span>Chargement...</span>
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((doc) => (
              <article key={doc.id} className="rounded-2xl border border-edge bg-canvas p-4 shadow-sm transition hover:border-brand/25">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink leading-6">{doc.name}</h3>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${STUDENT_CATEGORY_STYLES[doc.category] || 'border-edge bg-surface text-ink-secondary'}`}>
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
                  onClick={() => handleDownload(doc.id)}
                  className="mt-4 w-full rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-hover"
                >
                  Télécharger
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

// ─────────────────────────────────────────────────────────────
// Page principale — route selon le rôle
// ─────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user } = useAuth();

  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean);

  const isAdmin      = roles.includes('admin');
  const isEnseignant = roles.includes('enseignant');

  if (isAdmin)      return <AdminView />;
  if (isEnseignant) return <TeacherView />;
  return <StudentView />;
}
