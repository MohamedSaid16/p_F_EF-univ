import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import pfeAPI from '../../services/pfe';

function localTitle(item) {
  if (!item) return 'Untitled';
  return item.titre_ar || item.titre_en || `PFE #${item.id}`;
}

function localSubtitle(item) {
  if (!item) return '';
  const parts = [item.anneeUniversitaire, item.status];
  return parts.filter(Boolean).join(' • ');
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-edge bg-canvas px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
    </div>
  );
}

export default function ProjectsPage() {
  const [summary, setSummary] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadPage() {
      try {
        setLoading(true);
        setError('');

        const [summaryResponse, subjectsResponse] = await Promise.all([
          pfeAPI.getSummary(),
          pfeAPI.listSubjects(),
        ]);

        if (!active) return;

        setSummary(summaryResponse?.data || null);
        setSubjects(Array.isArray(subjectsResponse?.data) ? subjectsResponse.data : []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Failed to load PFE dashboard');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, []);

  const highlightSubjects = useMemo(() => subjects.slice(0, 6), [subjects]);

  const stats = [
    { label: 'Total groups', value: summary?.totalGroups ?? '—' },
    { label: 'Submitted', value: summary?.submittedGroups ?? '—' },
    { label: 'Defenses scheduled', value: summary?.defenseScheduled ?? '—' },
    { label: 'Completed', value: summary?.defenseCompleted ?? '—' },
  ];

  return (
    <div className="space-y-6 max-w-7xl min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.2),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.16),transparent_30%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Graduation Projects</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">PFE Workspace</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary md:text-base">
            Review subjects, track groups, and prepare the defense workflow from one accessible hub aligned with the current database schema.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.75fr)]">
        <div className="rounded-3xl border border-edge bg-surface p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">Active subjects</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                Latest subjects loaded from `PfeSujet` with their current group assignments.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/dashboard/projects/subjects" className="rounded-xl border border-edge bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:border-edge-strong hover:text-brand">
                Subjects
              </Link>
              <Link to="/dashboard/projects/groups" className="rounded-xl border border-edge bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:border-edge-strong hover:text-brand">
                Groups
              </Link>
              <Link to="/dashboard/projects/defense" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover">
                Defense plan
              </Link>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-edge bg-canvas px-6 py-12 text-center text-sm text-ink-secondary">
                Loading PFE data...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
                {error}
              </div>
            ) : highlightSubjects.length ? (
              highlightSubjects.map((subject) => (
                <article key={subject.id} className="rounded-2xl border border-edge bg-canvas px-5 py-4 transition hover:border-edge-strong">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-ink">{localTitle(subject)}</p>
                      <p className="mt-1 text-xs text-ink-tertiary">{localSubtitle(subject)}</p>
                      <p className="mt-2 text-sm text-ink-secondary">
                        {subject.description_ar || subject.description_en || 'No description provided yet.'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-edge bg-surface px-3 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-wide text-ink-tertiary">Groups</p>
                      <p className="text-lg font-semibold text-ink">{subject.groupsPfe?.length || 0}</p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-edge bg-canvas px-6 py-12 text-center text-sm text-ink-secondary">
                No subjects found for the current filter.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-edge bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Implementation status</h2>
            <div className="mt-4 space-y-3 text-sm text-ink-secondary">
              <p>• The page is now wired to the live PFE API wrapper.</p>
              <p>• The backend route `/api/v1/pfe/summary` is available.</p>
              <p>• The current schema uses bilingual subject and group names.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-edge bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Quick links</h2>
            <div className="mt-4 grid gap-3">
              <Link to="/dashboard/projects/subjects" className="rounded-2xl border border-edge bg-canvas px-4 py-3 text-sm font-medium text-ink transition hover:border-edge-strong hover:text-brand">
                Browse all subjects
              </Link>
              <Link to="/dashboard/projects/groups" className="rounded-2xl border border-edge bg-canvas px-4 py-3 text-sm font-medium text-ink transition hover:border-edge-strong hover:text-brand">
                Review group assignments
              </Link>
              <Link to="/dashboard/projects/defense" className="rounded-2xl border border-edge bg-canvas px-4 py-3 text-sm font-medium text-ink transition hover:border-edge-strong hover:text-brand">
                Plan defenses
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
