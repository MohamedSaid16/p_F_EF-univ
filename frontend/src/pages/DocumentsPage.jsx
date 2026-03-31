import React, { useEffect, useMemo, useState } from 'react';
import request from '../services/api';

const FALLBACK_DOCUMENTS = [
  { id: 'doc-1', name: 'Enrollment Certificate', category: 'Administrative', format: 'PDF', size: '180 KB', updatedAt: '2026-03-01' },
  { id: 'doc-2', name: 'Official Transcript', category: 'Academic', format: 'PDF', size: '420 KB', updatedAt: '2026-02-25' },
  { id: 'doc-3', name: 'Project Defense Template', category: 'PFE', format: 'DOCX', size: '96 KB', updatedAt: '2026-02-20' },
  { id: 'doc-4', name: 'Academic Calendar 2025/2026', category: 'Calendar', format: 'PDF', size: '260 KB', updatedAt: '2026-01-18' },
];

const CATEGORY_STYLES = {
  Administrative: 'border-blue-200 bg-blue-50 text-brand',
  Academic: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PFE: 'border-amber-200 bg-amber-50 text-amber-700',
  Calendar: 'border-violet-200 bg-violet-50 text-violet-700',
  Autre: 'border-slate-200 bg-slate-50 text-slate-700',
};

function mapCategory(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('admin')) return 'Administrative';
  if (normalized.includes('pedagog') || normalized.includes('ens')) return 'Academic';
  if (normalized.includes('scient')) return 'PFE';
  if (normalized.includes('calendar')) return 'Calendar';
  return 'Autre';
}

export default function DocumentsPage() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await request('/api/v1/student/documents');
        if (!cancelled) {
          const rows = Array.isArray(res?.data) ? res.data : [];
          setDocuments(rows.map((item) => ({
            id: item.id,
            name: item.name || item.nom || 'Document',
            category: mapCategory(item.category || item.categorie || item.type),
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
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return documents;
    return documents.filter((doc) =>
      [doc.name, doc.category, doc.format].some((value) => String(value || '').toLowerCase().includes(lower))
    );
  }, [documents, query]);

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_30%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Student Workspace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Documents</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
            Download academic and administrative files from one clean index. This page is connected to student documents API with a fallback dataset for continuity.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Available Files</h2>
            <p className="mt-1 text-sm text-ink-secondary">Search by file name, category, or format.</p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-md border border-control-border bg-control-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 text-ink-secondary">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
            <span>Loading documents...</span>
          </div>
        ) : filtered.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((doc) => (
              <article key={doc.id} className="rounded-lg border border-edge bg-surface p-4 shadow-card transition hover:border-brand/25">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink leading-6">{doc.name}</h3>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${CATEGORY_STYLES[doc.category] || 'border-edge bg-surface-200 text-ink-secondary'}`}>
                    {doc.category}
                  </span>
                </div>
                <p className="mt-3 text-xs text-ink-tertiary">Updated: {doc.updatedAt || 'N/A'}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-secondary">
                  <span>{doc.format}</span>
                  <span>{doc.size}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!doc.downloadUrl) return;
                    window.open(doc.downloadUrl, '_blank', 'noopener,noreferrer');
                  }}
                  disabled={!doc.downloadUrl}
                  className="mt-4 w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {doc.downloadUrl ? 'Download' : 'Unavailable'}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-edge bg-canvas px-6 py-10 text-center">
            <p className="text-base font-medium text-ink">No documents found.</p>
            <p className="mt-2 text-sm text-ink-secondary">Try another keyword or check back after new uploads.</p>
          </div>
        )}
      </section>
    </div>
  );
}
