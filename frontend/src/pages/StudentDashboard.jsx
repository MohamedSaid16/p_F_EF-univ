/*
  Intent: A student checking between lectures. They need orientation — not overwhelm.
          Three concerns surface immediately:
          1. What am I studying right now? (current specialties — identity & grounding)
          2. What's due soon? (upcoming deadlines — urgency without panic)
          3. Can I grab my documents quickly? (document downloads — utility, not ceremony)
  Palette: canvas base, surface cards. Brand for specialties, semantic colors for deadline urgency.
  Depth: shadow-card + border-edge on all cards. No stacked shadows.
  Surfaces: canvas (page bg via layout), surface (card), surface-200 (badge wells, progress bars bg).
  Typography: Inter. Section headings = text-base font-semibold. Body = text-sm.
  Spacing: 4px base. Cards p-5/p-6. Grid gap-4 on stats, gap-6 between sections.
*/

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import request from '../services/api';

/* ── Helpers ────────────────────────────────────────────────── */
const TYPE_BADGE = {
  Cours: 'bg-brand-light text-brand border border-brand/20',
  TD:    'bg-amber-50 dark:bg-amber-950/40 text-warning border border-amber-200 dark:border-amber-800/50',
  TP:    'bg-green-50 dark:bg-green-950/40 text-success border border-green-200 dark:border-green-800/50',
};

const URGENCY_STYLES = {
  urgent: { dot: 'bg-danger',    label: 'text-danger',    badge: 'bg-red-50 dark:bg-red-950/40 text-danger border border-red-200 dark:border-red-800/50' },
  soon:   { dot: 'bg-warning',   label: 'text-warning',   badge: 'bg-amber-50 dark:bg-amber-950/40 text-warning border border-amber-200 dark:border-amber-800/50' },
  normal: { dot: 'bg-brand',     label: 'text-brand',     badge: 'bg-brand-light text-brand border border-brand/20' },
  later:  { dot: 'bg-ink-muted', label: 'text-ink-muted', badge: 'bg-surface-200 text-ink-tertiary border border-edge' },
};

const DEADLINE_TYPE_ICONS = {
  assignment: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  presentation: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
    </svg>
  ),
  project: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  exam: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
};

const DOC_TYPE_ICONS = {
  certificate: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    </svg>
  ),
  transcript: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  template: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  guide: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
};

function formatDeadline(dateStr, t) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (diff <= 0) return { text: t('studentDashboard.overdue'), relative: t('studentDashboard.overdue'), formatted };
  if (diff === 1) return { text: t('studentDashboard.tomorrow'), relative: t('studentDashboard.tomorrow'), formatted };
  if (diff <= 7) return { text: t('studentDashboard.daysLeft', { count: diff }), relative: t('studentDashboard.inDays', { count: diff }), formatted };
  return { text: formatted, relative: t('studentDashboard.inDays', { count: diff }), formatted };
}

/* ── Component ──────────────────────────────────────────────── */
export default function StudentDashboard({ role = 'student' }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [specialties, setSpecialties] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const canUseStudentApis = role === 'student';

  useEffect(() => {
    if (!canUseStudentApis) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const [specRes, dlRes, docRes] = await Promise.allSettled([
          request('/api/v1/student/specialties'),
          request('/api/v1/student/deadlines'),
          request('/api/v1/student/documents'),
        ]);
        if (cancelled) return;
        if (specRes.status === 'fulfilled') setSpecialties(specRes.value.data || []);
        if (dlRes.status === 'fulfilled') setDeadlines(dlRes.value.data || []);
        if (docRes.status === 'fulfilled') setDocuments(docRes.value.data || []);
      } catch {
        /* API not ready — keep empty arrays */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [canUseStudentApis]);

  if (!canUseStudentApis) {
    return (
      <div className="bg-surface rounded-lg border border-edge shadow-card p-6">
        <h2 className="text-base font-semibold text-ink">Student workspace only</h2>
        <p className="mt-1 text-sm text-ink-tertiary">This dashboard is available for student and delegate accounts.</p>
      </div>
    );
  }

  const displayName = user?.prenom || 'Student';
  const dept = user?.etudiant?.promo?.specialite?.filiere?.departement?.nom || '';
  const spec = user?.etudiant?.promo?.specialite?.nom || '';
  const subtitle = [spec, dept].filter(Boolean).join(' · ') || t('studentDashboard.welcomeDefault');

  const avgProgress = specialties.length
    ? Math.round(specialties.reduce((s, m) => s + (m.progress || 0), 0) / specialties.length)
    : 0;

  return (
    <div className="space-y-6 min-w-0">

      {/* ── Page Header ────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-ink tracking-tight">
          {t('studentDashboard.welcomeBack', { name: displayName })}
        </h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          {subtitle}
        </p>
      </div>

      {/* ── Loading ────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-6 w-6 text-brand" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {!loading && specialties.length === 0 && deadlines.length === 0 && (
        <div className="bg-surface rounded-lg border border-edge shadow-card p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-ink-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
          </svg>
          <h3 className="text-base font-semibold text-ink">{t('studentDashboard.noDataTitle')}</h3>
          <p className="text-sm text-ink-tertiary mt-1">{t('studentDashboard.noDataText')}</p>
        </div>
      )}

      {/* ── Quick Stats Strip ──────────────────────────────── */}
      {!loading && (specialties.length > 0 || deadlines.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t('studentDashboard.modules'), value: specialties.length, icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
            )},
            { label: t('studentDashboard.credits'), value: specialties.reduce((s, m) => s + (m.credits || 0), 0), icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            )},
            { label: t('studentDashboard.avgProgress'), value: `${avgProgress}%`, icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            )},
            { label: t('studentDashboard.dueSoon'), value: deadlines.filter((d) => d.urgency === 'urgent').length, icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )},
          ].map((stat) => (
            <div key={stat.label} className="bg-surface rounded-lg border border-edge shadow-card p-4 flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-light flex items-center justify-center text-brand">
                {stat.icon}
              </div>
              <div>
                <p className="text-lg font-bold text-ink tracking-tight">{stat.value}</p>
                <p className="text-xs text-ink-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && (
        <div className="bg-surface rounded-lg border border-edge shadow-card p-4">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/dashboard/notes')} className="rounded-md border border-edge bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-brand/40">
              View Notes
            </button>
            <button type="button" onClick={() => navigate('/dashboard/specialite-choice')} className="rounded-md border border-edge bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-brand/40">
              Choose Specialite
            </button>
            <button type="button" onClick={() => navigate('/dashboard/requests')} className="rounded-md border border-edge bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-brand/40">
              Reclamations & Justifications
            </button>
            <button type="button" onClick={() => navigate('/dashboard/profile')} className="rounded-md border border-edge bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-brand/40">
              My Profile
            </button>
          </div>
        </div>
      )}
      {/* ── My Modules Table ───────────────────────────────── */}
      {!loading && specialties.length > 0 && (
        <div className="bg-surface rounded-lg border border-edge shadow-card">
          <div className="px-5 py-4 border-b border-edge-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
              <h2 className="text-base font-semibold text-ink">{t('studentDashboard.myModules')}</h2>
              <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded-full bg-brand-light text-brand border border-brand/20">
                {specialties.length}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge-subtle">
                  <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">{t('studentDashboard.thModule')}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider hidden sm:table-cell">{t('studentDashboard.thTeacher')}</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-ink-muted uppercase tracking-wider hidden md:table-cell">{t('studentDashboard.thType')}</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-ink-muted uppercase tracking-wider hidden lg:table-cell">{t('studentDashboard.thCredits')}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">{t('studentDashboard.thProgress')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge-subtle">
                {specialties.map((mod) => (
                  <tr key={mod.code || mod.id} className="hover:bg-surface-200/50 transition-colors duration-100">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{mod.name}</p>
                      <p className="text-xs text-ink-muted mt-0.5 sm:hidden">{mod.teacher}</p>
                    </td>
                    <td className="px-5 py-3 text-ink-secondary hidden sm:table-cell">{mod.teacher}</td>
                    <td className="px-5 py-3 text-center hidden md:table-cell">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${TYPE_BADGE[mod.type] || ''}`}>{mod.type}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-ink-secondary hidden lg:table-cell">
                      {mod.credits} <span className="text-ink-muted text-xs">/ {t('studentDashboard.coeff')} {mod.coefficient}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                          <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${mod.progress || 0}%` }} />
                        </div>
                        <span className="text-xs font-medium text-ink-secondary w-8 text-right">{mod.progress || 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Two-Column: Deadlines + Documents ──────────────── */}
      {!loading && (deadlines.length > 0 || documents.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Upcoming Deadlines */}
          {deadlines.length > 0 && (
            <div className="xl:col-span-3 bg-surface rounded-lg border border-edge shadow-card">
              <div className="px-5 py-4 border-b border-edge-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-base font-semibold text-ink">{t('studentDashboard.upcomingDeadlines')}</h2>
                  <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 dark:bg-red-950/40 text-danger border border-red-200 dark:border-red-800/50">
                    {deadlines.filter((d) => d.urgency === 'urgent').length} {t('studentDashboard.urgent')}
                  </span>
                </div>
              </div>
              <ul className="divide-y divide-edge-subtle">
                {deadlines.map((dl) => {
                  const deadline = formatDeadline(dl.due, t);
                  const u = URGENCY_STYLES[dl.urgency] || URGENCY_STYLES.normal;
                  return (
                    <li key={dl.id} className="px-5 py-4 hover:bg-surface-200/50 transition-colors duration-100">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${u.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{dl.title}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="inline-flex items-center gap-1 text-xs text-ink-tertiary">
                              {DEADLINE_TYPE_ICONS[dl.type]}
                              {dl.type ? dl.type.charAt(0).toUpperCase() + dl.type.slice(1) : ''}
                            </span>
                            <span className="text-ink-muted">·</span>
                            <span className="text-xs text-ink-muted">{dl.module}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-medium ${u.label}`}>{deadline.relative}</p>
                          <p className="text-xs text-ink-muted mt-0.5">{deadline.formatted}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Quick Documents */}
          {documents.length > 0 && (
            <div className="xl:col-span-2 bg-surface rounded-lg border border-edge shadow-card">
              <div className="px-5 py-4 border-b border-edge-subtle flex items-center gap-2">
                <svg className="w-5 h-5 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <h2 className="text-base font-semibold text-ink">{t('studentDashboard.documents')}</h2>
              </div>
              <ul className="divide-y divide-edge-subtle">
                {documents.map((doc) => (
                  <li key={doc.id} className="px-5 py-3.5 hover:bg-surface-200/50 transition-colors duration-100">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-200 flex items-center justify-center text-ink-tertiary">
                        {DOC_TYPE_ICONS[doc.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{doc.name}</p>
                        <p className="text-xs text-ink-muted mt-0.5">{doc.format} · {doc.size}</p>
                      </div>
                      <button className="shrink-0 p-2 rounded-md text-brand hover:bg-surface-200 transition-colors duration-150" aria-label={`Download ${doc.name}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-5 py-3 border-t border-edge-subtle">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/documents')}
                  className="w-full rounded-md border border-edge bg-surface px-3 py-2.5 text-center text-sm font-medium text-brand transition-colors duration-150 hover:bg-surface-200"
                >
                  {t('studentDashboard.goToDocuments')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
