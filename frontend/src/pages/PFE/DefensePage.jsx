import React, { useEffect, useMemo, useState } from 'react';
import pfeAPI from '../../services/pfe';

function subjectTitle(subject) {
  return subject?.titre_ar || subject?.titre_en || `PFE #${subject?.id}`;
}

export default function DefensePage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadDefenseData() {
      try {
        setLoading(true);
        const response = await pfeAPI.listSubjects();
        if (!active) return;
        setSubjects(Array.isArray(response?.data) ? response.data : []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Failed to load defense data');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDefenseData();

    return () => {
      active = false;
    };
  }, []);

  const defenses = useMemo(() => {
    const items = [];

    subjects.forEach((subject) => {
      (subject.groupsPfe || []).forEach((group) => {
        if (group.dateSoutenance) {
          items.push({
            subjectTitle: subjectTitle(subject),
            groupTitle: group.nom_ar || group.nom_en || `Group ${group.id}`,
            dateSoutenance: group.dateSoutenance,
            salleSoutenance: group.salleSoutenance,
            note: group.note,
            mention: group.mention,
          });
        }
      });
    });

    return items;
  }, [subjects]);

  return (
    <div className="space-y-6 max-w-7xl min-w-0">
      <section className="rounded-3xl border border-edge bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Defense</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Defense Planning</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Track scheduled defenses and final evaluation details from the PFE records.
        </p>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-edge bg-surface p-8 text-center text-sm text-ink-secondary">
          Loading defense schedule...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </div>
      ) : defenses.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {defenses.map((item) => (
            <article key={`${item.subjectTitle}-${item.groupTitle}-${item.dateSoutenance}`} className="rounded-3xl border border-edge bg-surface p-6 shadow-card">
              <p className="text-sm font-semibold text-ink">{item.subjectTitle}</p>
              <p className="mt-1 text-xs text-ink-tertiary">{item.groupTitle}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-edge bg-canvas px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-ink-tertiary">Defense date</p>
                  <p className="mt-1 text-sm font-medium text-ink">{item.dateSoutenance}</p>
                </div>
                <div className="rounded-2xl border border-edge bg-canvas px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-ink-tertiary">Room</p>
                  <p className="mt-1 text-sm font-medium text-ink">{item.salleSoutenance || '—'}</p>
                </div>
                <div className="rounded-2xl border border-edge bg-canvas px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-ink-tertiary">Grade</p>
                  <p className="mt-1 text-sm font-medium text-ink">{item.note ?? '—'}</p>
                </div>
                <div className="rounded-2xl border border-edge bg-canvas px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-ink-tertiary">Mention</p>
                  <p className="mt-1 text-sm font-medium text-ink">{item.mention || '—'}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-edge bg-surface p-8 text-center text-sm text-ink-secondary">
          No defenses are scheduled yet.
        </div>
      )}
    </div>
  );
}