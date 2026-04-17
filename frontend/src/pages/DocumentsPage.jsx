import React, { useEffect, useMemo, useRef, useState } from 'react';
import request, { resolveMediaUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const FALLBACK_DOCUMENTS = [
  { id: 'doc-1', name: 'Enrollment Certificate', category: 'Administrative', format: 'PDF', size: '180 KB', updatedAt: '2026-03-01' },
  { id: 'doc-2', name: 'Official Transcript', category: 'Academic', format: 'PDF', size: '420 KB', updatedAt: '2026-02-25' },
  { id: 'doc-3', name: 'Project Defense Template', category: 'PFE', format: 'DOCX', size: '96 KB', updatedAt: '2026-02-20' },
  { id: 'doc-4', name: 'Academic Calendar 2025/2026', category: 'Calendar', format: 'PDF', size: '260 KB', updatedAt: '2026-01-18' },
];

// Token-based semantic color mapping
const getCategoryStyle = (category) => {
  const map = {
    enseignement: { bg: 'rgba(29, 78, 216, 0.05)', text: 'var(--color-brand)' },
    administratif: { bg: 'rgba(22, 163, 74, 0.05)', text: 'var(--color-success)' },
    scientifique: { bg: 'var(--color-surface-200)', text: 'var(--color-ink-secondary)' },
    pedagogique: { bg: 'rgba(202, 138, 4, 0.05)', text: 'var(--color-warning)' },
    autre: { bg: 'var(--color-surface-200)', text: 'var(--color-ink-secondary)' },
    Administrative: { bg: 'rgba(29, 78, 216, 0.05)', text: 'var(--color-brand)' },
    Academic: { bg: 'rgba(22, 163, 74, 0.05)', text: 'var(--color-success)' },
    PFE: { bg: 'rgba(202, 138, 4, 0.05)', text: 'var(--color-warning)' },
    Calendar: { bg: 'var(--color-surface-200)', text: 'var(--color-ink-secondary)' },
  };
  return map[category] || map.autre;
};

const getStatusStyle = (status) => {
  const map = {
    en_attente: { bg: 'var(--color-surface-200)', text: 'var(--color-ink-secondary)' },
    en_traitement: { bg: 'rgba(202, 138, 4, 0.05)', text: 'var(--color-warning)' },
    valide: { bg: 'rgba(22, 163, 74, 0.05)', text: 'var(--color-success)' },
    refuse: { bg: 'rgba(220, 38, 38, 0.05)', text: 'var(--color-danger)' },
  };
  return map[status] || map.en_attente;
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

// Hero Section - Token-driven depth & unified styling
function DocumentsHero({ eyebrow, title, description }) {
  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        border: '1px solid var(--color-edge)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-card)',
        padding: '32px 24px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at top right, rgba(22, 163, 74, 0.08), transparent 35%), radial-gradient(circle at bottom left, rgba(29, 78, 216, 0.08), transparent 35%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 10 }}>
        <p
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-brand, #1d4ed8)',
            margin: 0,
          }}
        >
          {eyebrow}
        </p>
        <h1
          style={{
            marginTop: '12px',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--color-ink)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            marginTop: '12px',
            fontSize: '14px',
            lineHeight: '1.6',
            color: 'var(--color-ink-secondary)',
            maxWidth: '56ch',
            margin: 0,
          }}
        >
          {description}
        </p>
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
  const [expandForm, setExpandForm] = useState(false);

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
    if (!selectedType) return;
    setRequestLoading(true);
    try {
      await request('/api/v1/documents/request', {
        method: 'POST',
        body: JSON.stringify({ typeDocId: Number(selectedType), description: 'Document request' }),
      });
      setSelectedType('');
      setExpandForm(false);
      await loadAll();
    } catch {
    } finally {
      setRequestLoading(false);
    }
  };

  // KPI Summary for Teacher
  const summary = useMemo(() => ({
    total: documents.length,
    pending: documents.filter((d) => d.status === 'en_attente').length,
    processing: documents.filter((d) => d.status === 'en_traitement').length,
    approved: documents.filter((d) => d.status === 'valide').length,
  }), [documents]);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return documents;
    return documents.filter((doc) =>
      [doc.name, doc.category, doc.status].some((value) => String(value || '').toLowerCase().includes(lower))
    );
  }, [documents, query]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero Section */}
      <DocumentsHero
        eyebrow="Espace Enseignant"
        title="Documents"
        description="Soumettez une demande de document, suivez son état, puis téléchargez le fichier une fois validé."
      />

      {/* KPI Header - Teacher Context */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
      }}>
        {[
          { label: 'Total', value: summary.total, accent: 'brand' },
          { label: 'En attente', value: summary.pending, accent: 'warning' },
          { label: 'En traitement', value: summary.processing, accent: 'warning' },
          { label: 'Validées', value: summary.approved, accent: 'success' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              borderRadius: '8px',
              border: '1px solid var(--color-edge)',
              background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-card)',
              padding: '16px',
              transition: 'all 150ms ease-out',
            }}
          >
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.label}
            </p>
            <p style={{ marginTop: '8px', fontSize: '28px', fontWeight: 700, color: `var(--color-${stat.accent})`, margin: 0 }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Unified Workspace Surface - Action-Triggered Hero */}
      <section
        style={{
          borderRadius: '8px',
          border: '1px solid var(--color-edge)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px',
            borderBottom: '1px solid var(--color-edge-subtle)',
            background: expandForm ? 'var(--color-surface-200)' : 'var(--color-surface)',
            transition: 'all 150ms ease-out',
          }}
        >
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>Nouvelle demande</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', margin: '4px 0 0 0' }}>
              Sélectionnez un type de document et envoyez votre demande
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpandForm(!expandForm)}
            style={{
              borderRadius: '6px',
              border: 'none',
              background: expandForm ? 'var(--color-surface)' : 'var(--color-brand, #1d4ed8)',
              color: expandForm ? 'var(--color-brand)' : '#fff',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms ease-out',
            }}
          >
            {expandForm ? 'Annuler' : 'Nouvelle demande'}
          </button>
        </div>

        {/* Expanded Form - Token-driven styling */}
        {expandForm && (
          <div style={{ padding: '24px', borderTop: '1px solid var(--color-edge-subtle)', background: 'var(--color-surface-200)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{
                  borderRadius: '6px',
                  border: '1px solid var(--color-edge)',
                  background: 'var(--color-surface)',
                  padding: '12px',
                  fontSize: '13px',
                  color: 'var(--color-ink)',
                  outline: 'none',
                  transition: 'all 150ms ease-out',
                }}
              >
                <option value="">Choisir le type de document</option>
                {docTypes.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.nom_ar || doc.nom_en || 'Document'} - {doc.categorie}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreateRequest}
                disabled={requestLoading || !selectedType}
                style={{
                  borderRadius: '6px',
                  border: 'none',
                  background: selectedType ? 'var(--color-brand, #1d4ed8)' : 'var(--color-control-border)',
                  color: '#fff',
                  padding: '12px 24px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: selectedType ? 'pointer' : 'not-allowed',
                  opacity: requestLoading ? 0.6 : 1,
                  transition: 'all 150ms ease-out',
                }}
              >
                {requestLoading ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Requests Table Section - Data-Dense Layout */}
      <section
        style={{
          borderRadius: '8px',
          border: '1px solid var(--color-edge)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header with Search */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--color-edge-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>Mes demandes</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', margin: '4px 0 0 0' }}>
              Historique et état des demandes ({filtered.length})
            </p>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            style={{
              borderRadius: '6px',
              border: '1px solid var(--color-edge)',
              background: 'var(--color-surface-200)',
              padding: '8px 12px',
              fontSize: '13px',
              color: 'var(--color-ink)',
              outline: 'none',
              minWidth: '200px',
              transition: 'all 150ms ease-out',
            }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '12px', color: 'var(--color-ink-secondary)' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--color-edge)', borderTop: '2px solid var(--color-brand)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px' }}>Chargement...</span>
            </div>
          ) : filtered.length ? (
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {filtered.map((doc) => {
                const categoryStyle = getCategoryStyle(doc.category);
                const statusStyle = getStatusStyle(doc.status);
                return (
                  <div
                    key={doc.id}
                    style={{
                      borderRadius: '6px',
                      border: '1px solid var(--color-edge)',
                      background: 'var(--color-surface-200)',
                      padding: '16px',
                      transition: 'all 150ms ease-out',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', margin: 0, flex: 1 }}>{doc.name}</h3>
                      <span style={{
                        borderRadius: '6px',
                        background: categoryStyle.bg,
                        color: categoryStyle.text,
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {doc.category}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{
                        borderRadius: '6px',
                        background: statusStyle.bg,
                        color: statusStyle.text,
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        {STATUS_LABELS[doc.status] || doc.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', margin: '0 0 12px 0' }}>
                      Mis à jour : {doc.updatedAt || 'N/A'}
                    </p>
                    {doc.status === 'valide' && doc.documentUrl ? (
                      <a
                        href={resolveMediaUrl(`/api/v1/documents/download/${doc.id}`)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'block',
                          width: '100%',
                          borderRadius: '6px',
                          background: 'var(--color-brand, #1d4ed8)',
                          color: '#fff',
                          padding: '8px 12px',
                          textAlign: 'center',
                          fontSize: '12px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          transition: 'all 150ms ease-out',
                        }}
                      >
                        Télécharger
                      </a>
                    ) : (
                      <div style={{
                        display: 'block',
                        width: '100%',
                        borderRadius: '6px',
                        background: 'var(--color-surface)',
                        color: 'var(--color-ink-tertiary)',
                        padding: '8px 12px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: '1px solid var(--color-edge-subtle)',
                      }}>
                        {doc.status === 'refuse' ? 'Demande refusée' : 'En attente de traitement'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              borderRadius: '6px',
              border: '1px dashed var(--color-edge)',
              background: 'var(--color-surface-200)',
              padding: '48px 24px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Aucune demande trouvée.</p>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', margin: '8px 0 0 0' }}>Soumettez votre première demande ci-dessus.</p>
            </div>
          )}
        </div>
      </section>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
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
    if (!file || !pendingUploadId) return;
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
    if (filterStatus) rows = rows.filter((row) => row.status === filterStatus);
    const lower = query.trim().toLowerCase();
    if (!lower) return rows;
    return rows.filter((row) =>
      [row.enseignantNom, row.name, row.category, row.status].some((value) =>
        String(value || '').toLowerCase().includes(lower)
      )
    );
  }, [requests, query, filterStatus]);

  const counts = useMemo(() => ({
    total: requests.length,
    en_attente: requests.filter((r) => r.status === 'en_attente').length,
    en_traitement: requests.filter((r) => r.status === 'en_traitement').length,
    valide: requests.filter((r) => r.status === 'valide').length,
  }), [requests]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Hero Section */}
      <DocumentsHero
        eyebrow="Administration"
        title="Gestion des documents"
        description="Traitez les demandes des enseignants, chargez les fichiers puis validez ou refusez les documents."
      />

      {/* KPI Analytics Header - High-impact metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {[
          { label: 'Total', value: counts.total, accent: 'ink', bg: 'rgba(26, 29, 35, 0.05)' },
          { label: 'En attente', value: counts.en_attente, accent: 'warning', bg: 'rgba(202, 138, 4, 0.05)' },
          { label: 'En traitement', value: counts.en_traitement, accent: 'warning', bg: 'rgba(202, 138, 4, 0.08)' },
          { label: 'Validées', value: counts.valide, accent: 'success', bg: 'rgba(22, 163, 74, 0.05)' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              borderRadius: '8px',
              border: '1px solid var(--color-edge)',
              background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-card)',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 150ms ease-out',
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-16px',
              right: '-16px',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: stat.bg,
              filter: 'blur(32px)',
              opacity: 0.5,
            }} />
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.label}
            </p>
            <p style={{ marginTop: '8px', fontSize: '32px', fontWeight: 700, color: `var(--color-${stat.accent})`, margin: 0 }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Unified Management Workspace */}
      <section
        style={{
          borderRadius: '8px',
          border: '1px solid var(--color-edge)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Toolbar - Global Filtering */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--color-edge-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
              Toutes les demandes
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', margin: '4px 0 0 0' }}>
              {filtered.length} demande{filtered.length !== 1 ? 's' : ''} trouvée{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                borderRadius: '6px',
                border: '1px solid var(--color-edge)',
                background: 'var(--color-surface-200)',
                padding: '8px 12px',
                fontSize: '13px',
                color: 'var(--color-ink)',
                outline: 'none',
                transition: 'all 150ms ease-out',
              }}
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher..."
              style={{
                borderRadius: '6px',
                border: '1px solid var(--color-edge)',
                background: 'var(--color-surface-200)',
                padding: '8px 12px',
                fontSize: '13px',
                color: 'var(--color-ink)',
                outline: 'none',
                minWidth: '220px',
                transition: 'all 150ms ease-out',
              }}
            />
          </div>
        </div>

        {/* Data-Dense Table */}
        <div style={{ flex: 1, overflowX: 'auto', position: 'relative' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: '12px', color: 'var(--color-ink-secondary)' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--color-edge)', borderTop: '2px solid var(--color-brand)', animation: 'spin 1s linear infinite' }} />
              <span>Chargement...</span>
            </div>
          ) : filtered.length ? (
            <table
              style={{
                width: '100%',
                fontSize: '13px',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ background: 'var(--color-surface-200)', borderBottom: '1px solid var(--color-edge)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enseignant</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Catégorie</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Statut</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const categoryStyle = getCategoryStyle(row.category);
                  const statusStyle = getStatusStyle(row.status);
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid var(--color-edge-subtle)',
                        background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-200)',
                        transition: 'all 150ms ease-out',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-ink)' }}>{row.enseignantNom || '—'}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-ink-secondary)' }}>{row.name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          borderRadius: '6px',
                          background: categoryStyle.bg,
                          color: categoryStyle.text,
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}>
                          {row.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-ink-tertiary)' }}>{row.updatedAt || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          borderRadius: '6px',
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}>
                          {STATUS_LABELS[row.status] || row.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {(row.status === 'en_attente' || row.status === 'en_traitement') && (
                            <button
                              type="button"
                              onClick={() => handleUploadClick(row.id)}
                              disabled={uploading === row.id}
                              style={{
                                borderRadius: '4px',
                                border: '1px solid var(--color-edge)',
                                background: 'var(--color-surface-200)',
                                color: 'var(--color-ink-secondary)',
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: uploading === row.id ? 'wait' : 'pointer',
                                opacity: uploading === row.id ? 0.6 : 1,
                                transition: 'all 150ms ease-out',
                              }}
                            >
                              {uploading === row.id ? '⏳' : '📤'}
                            </button>
                          )}
                          {row.status === 'en_traitement' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAction(row.id, 'valide')}
                                disabled={Boolean(actionLoading)}
                                style={{
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: 'var(--color-success)',
                                  color: '#fff',
                                  padding: '6px 12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: actionLoading ? 'wait' : 'pointer',
                                  opacity: actionLoading ? 0.6 : 1,
                                  transition: 'all 150ms ease-out',
                                }}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAction(row.id, 'refuse')}
                                disabled={Boolean(actionLoading)}
                                style={{
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: 'var(--color-danger)',
                                  color: '#fff',
                                  padding: '6px 12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: actionLoading ? 'wait' : 'pointer',
                                  opacity: actionLoading ? 0.6 : 1,
                                  transition: 'all 150ms ease-out',
                                }}
                              >
                                ✕
                              </button>
                            </>
                          )}
                          {row.status === 'valide' && row.documentUrl && (
                            <a
                              href={resolveMediaUrl(`/api/v1/documents/download/${row.id}`)}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                borderRadius: '4px',
                                border: 'none',
                                background: 'var(--color-brand, #1d4ed8)',
                                color: '#fff',
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textDecoration: 'none',
                                display: 'inline-block',
                                transition: 'all 150ms ease-out',
                              }}
                            >
                              ⬇️
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{
              borderRadius: '6px',
              border: '1px dashed var(--color-edge)',
              background: 'var(--color-surface-200)',
              padding: '64px 24px',
              textAlign: 'center',
              margin: '16px',
            }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Aucune demande trouvée.</p>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', margin: '8px 0 0 0' }}>Ajustez les filtres ou attendez de nouvelles demandes.</p>
            </div>
          )}
        </div>
      </section>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function StudentView() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState('');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await request('/api/v1/documents/student-documents');
      setDocuments(normalizeRows(response));
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return documents;
    return documents.filter((doc) => [doc.name, doc.category].some((value) => String(value || '').toLowerCase().includes(lower)));
  }, [documents, query]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero Section */}
      <DocumentsHero
        eyebrow="Ressources"
        title="Mes documents"
        description="Accédez aux documents fournis par vos enseignants ou l'administration."
      />

      {/* Unified Resource Workspace */}
      <section
        style={{
          borderRadius: '8px',
          border: '1px solid var(--color-edge)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Toolbar - Search */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--color-edge-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
              Tous les documents
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', margin: '4px 0 0 0' }}>
              {filtered.length} document{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            style={{
              borderRadius: '6px',
              border: '1px solid var(--color-edge)',
              background: 'var(--color-surface-200)',
              padding: '8px 12px',
              fontSize: '13px',
              color: 'var(--color-ink)',
              outline: 'none',
              minWidth: '220px',
              transition: 'all 150ms ease-out',
            }}
          />
        </div>

        {/* Data-Dense Card Grid */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: 'var(--color-ink-secondary)' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--color-edge)', borderTop: '2px solid var(--color-brand)', animation: 'spin 1s linear infinite' }} />
              <span>Chargement...</span>
            </div>
          ) : filtered.length ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {filtered.map((doc) => {
                const categoryStyle = getCategoryStyle(doc.category);
                return (
                  <a
                    key={doc.id}
                    href={resolveMediaUrl(`/api/v1/documents/download/${doc.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      borderRadius: '8px',
                      border: '1px solid var(--color-edge)',
                      background: 'var(--color-surface-200)',
                      boxShadow: 'var(--shadow-card)',
                      padding: '20px',
                      textDecoration: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      transition: 'all 150ms ease-out',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-brand)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(29, 78, 216, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-edge)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {doc.name}
                      </p>
                      <span style={{ fontSize: '18px', opacity: 0, transition: 'opacity 150ms ease-out', marginLeft: 'auto' }} data-icon="⬇️">⬇️</span>
                    </div>
                    <span style={{
                      display: 'inline-block',
                      borderRadius: '6px',
                      background: categoryStyle.bg,
                      color: categoryStyle.text,
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      width: 'fit-content',
                    }}>
                      {doc.category}
                    </span>
                    <p style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', margin: 0, marginTop: 'auto' }}>
                      {doc.updatedAt || '—'}
                    </p>
                  </a>
                );
              })}
            </div>
          ) : (
            <div style={{
              borderRadius: '8px',
              border: '1px dashed var(--color-edge)',
              background: 'var(--color-surface)',
              padding: '80px 24px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Aucun document trouvé.</p>
              <p style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', margin: '8px 0 0 0' }}>Vos enseignants publieront prochainement des documents.</p>
            </div>
          )}
        </div>
      </section>

      <style>{`
        a[href] div > span[data-icon] { opacity: 0; }
        a[href]:hover div > span[data-icon] { opacity: 1; }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
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
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <DocumentsHero
        eyebrow="Documents"
        title="Accès limité"
        description="Votre rôle ne dispose pas d'une vue documents dédiée dans ce module."
      />
      <section style={{
        borderRadius: '8px',
        border: '1px solid var(--color-edge)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-card)',
        padding: '24px',
      }}>
        <p style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', margin: 0 }}>Contactez l'administration pour demander l'activation d'accès appropriés.</p>
      </section>
    </div>
  );
}

