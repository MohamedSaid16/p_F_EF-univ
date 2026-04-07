import React, { useEffect, useState } from 'react';
import pfeAPI from '../../services/pfe';

function titleOf(subject) {
  return subject?.titre_ar || subject?.titre_en || `PFE #${subject?.id}`;
}

export default function GroupsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadGroups() {
      try {
        setLoading(true);
        const response = await pfeAPI.listSubjects();
        if (!active) return;
        setSubjects(Array.isArray(response?.data) ? response.data : []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Failed to load groups');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadGroups();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-7xl min-w-0">
      <section className="rounded-3xl border border-edge bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Groups</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">PFE Groups</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Current group assignments are grouped by subject so you can review student allocation quickly.
        </p>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-edge bg-surface p-8 text-center text-sm text-ink-secondary">
          Loading groups...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          {subjects.map((subject) => (
            <section key={subject.id} className="rounded-3xl border border-edge bg-surface p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-ink">{titleOf(subject)}</h2>
                  <p className="mt-1 text-sm text-ink-secondary">
                    {subject.groupsPfe?.length || 0} group(s) attached to this subject.
                  </p>
                </div>
                <span className="rounded-full border border-edge bg-canvas px-3 py-1 text-xs font-medium text-ink-secondary">
                  {subject.status || 'no status'}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(subject.groupsPfe || []).map((group) => (
                  <article key={group.id} className="rounded-2xl border border-edge bg-canvas px-4 py-4">
                    <p className="font-medium text-ink">{group.nom_ar || group.nom_en || `Group ${group.id}`}</p>
                    <p className="mt-1 text-sm text-ink-secondary">Members: {group.groupMembers?.length || 0}</p>
                    <p className="mt-1 text-sm text-ink-secondary">Defense: {group.dateSoutenance || 'not scheduled'}</p>
                    <p className="mt-1 text-sm text-ink-secondary">Room: {group.salleSoutenance || '—'}</p>
                  </article>
                ))}
                {!(subject.groupsPfe || []).length ? (
                  <div className="rounded-2xl border border-dashed border-edge bg-canvas px-4 py-6 text-sm text-ink-secondary">
                    No groups assigned yet.
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}