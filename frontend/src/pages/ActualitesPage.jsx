/*
  Intent: University news board — the digital equivalent of the paper announcements
          pinned behind glass on the corridor wall. Students glance between lectures,
          teachers check for administrative updates over coffee.
          Three concerns surface:
          1. What's happening right now? (pinned/featured announcements — urgent, unmissable)
          2. What's new this week? (chronological feed — scannable, filterable by category)
          3. What events are coming up? (upcoming events sidebar — calendar-adjacent)
  Palette: canvas base, surface cards. Brand for institutional, semantic for urgency.
  Depth: shadow-card + border-edge on all cards. No stacked shadows.
  Surfaces: canvas (page bg via layout), surface (card), surface-200 (badge wells, filter pills).
  Typography: Inter. Section headings = text-base font-semibold. Body = text-sm.
  Spacing: 4px base. Cards p-5/p-6. Grid gap-4 on stats, gap-6 between sections.
*/

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import request from '../services/api';

/* ── Mock Data ──────────────────────────────────────────────── */

const CATEGORIES = [
  { key: 'all',           labelKey: 'actualites.filterAll' },
  { key: 'academic',      labelKey: 'actualites.filterAcademic' },
  { key: 'administrative', labelKey: 'actualites.filterAdministrative' },
  { key: 'events',        labelKey: 'actualites.filterEvents' },
  { key: 'research',      labelKey: 'actualites.filterResearch' },
  { key: 'student-life',  labelKey: 'actualites.filterStudentLife' },
];

const CATEGORY_STYLES = {
  academic:       'bg-blue-50 dark:bg-blue-950/40 text-brand border border-blue-200 dark:border-blue-800/50',
  administrative: 'bg-amber-50 dark:bg-amber-950/40 text-warning border border-amber-200 dark:border-amber-800/50',
  events:         'bg-green-50 dark:bg-green-950/40 text-success border border-green-200 dark:border-green-800/50',
  research:       'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50',
  'student-life': 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50',
};

/* ── Quick-stat icon definitions ────────────────────────────── */
const STAT_ICON_ANNOUNCE = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
  </svg>
);
const STAT_ICON_CALENDAR = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);
const STAT_ICON_STAR = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
  </svg>
);

/* ── Helpers ────────────────────────────────────────────────── */

const STAT_COLORS = {
  brand:   { bg: 'bg-blue-50 dark:bg-blue-950/40',  text: 'text-brand',  icon: 'text-brand' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-warning', icon: 'text-warning' },
};

function formatDate(dateStr, locale = 'en-GB') {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function daysUntil(dateStr) {
  const now = new Date('2026-02-20');
  const target = new Date(dateStr);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `In ${diff} days`;
}

function daysUntilStyle(dateStr) {
  const now = new Date('2026-02-20');
  const target = new Date(dateStr);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 2) return 'text-danger';
  if (diff <= 7) return 'text-warning';
  return 'text-ink-tertiary';
}

/* ── Component ──────────────────────────────────────────────── */
export default function ActualitesPage({ role }) {
  const isGuest = !role || role === 'guest';
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-DZ' : i18n.language === 'fr' ? 'fr-FR' : 'en-GB';
  const [activeFilter, setActiveFilter] = useState('all');
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState([]);
  const [newsFeed, setNewsFeed] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pRes, nRes, eRes] = await Promise.allSettled([
          request('/api/v1/actualites/pinned'),
          request('/api/v1/actualites/news'),
          request('/api/v1/actualites/events'),
        ]);
        if (pRes.status === 'fulfilled') setPinnedAnnouncements(Array.isArray(pRes.value?.data) ? pRes.value.data : []);
        if (nRes.status === 'fulfilled') setNewsFeed(Array.isArray(nRes.value?.data) ? nRes.value.data : []);
        if (eRes.status === 'fulfilled') setUpcomingEvents(Array.isArray(eRes.value?.data) ? eRes.value.data : []);
      } catch {
        /* endpoints may not exist yet */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredNews = activeFilter === 'all'
    ? newsFeed
    : newsFeed.filter((n) => n.category === activeFilter);

  const QUICK_STATS = [
    { label: t('actualites.announcements'), value: String(newsFeed.length + pinnedAnnouncements.length), sub: t('actualites.thisMonth'), icon: STAT_ICON_ANNOUNCE, color: 'brand' },
    { label: t('actualites.upcomingEvents'), value: String(upcomingEvents.length), sub: t('actualites.next30days'), icon: STAT_ICON_CALENDAR, color: 'brand' },
    { label: t('common.pinned'), value: String(pinnedAnnouncements.length), sub: t('actualites.importantNotices'), icon: STAT_ICON_STAR, color: 'warning' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">

      {/* ── Page Header ────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-ink tracking-tight">{t('actualites.title')}</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          {t('actualites.subtitle')} — {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      </div>

      {/* ── Guest Sign-in Banner ───────────────────────────── */}
      {isGuest && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{t('actualites.signInBanner')}</p>
              <p className="text-xs text-ink-tertiary">{t('actualites.signInBannerSub')}</p>
            </div>
          </div>
          <a href="/login" className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-brand-hover transition-colors duration-150 shadow-sm whitespace-nowrap">
            {t('common.signIn')}
          </a>
        </div>
      )}

      {/* ── Quick Stats (authenticated only) ───────────────── */}
      {!isGuest && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_STATS.map((stat) => {
          const c = STAT_COLORS[stat.color];
          return (
            <div
              key={stat.label}
              className="bg-surface rounded-lg border border-edge shadow-card p-5 flex items-start gap-4"
            >
              <div className={`shrink-0 w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center ${c.icon}`}>
                {stat.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-secondary">{stat.label}</p>
                <p className={`text-2xl font-bold tracking-tight ${c.text} mt-0.5`}>{stat.value}</p>
                <p className="text-xs text-ink-muted mt-1">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* ── Pinned Announcements ───────────────────────────── */}
      <div className="space-y-3">
        {pinnedAnnouncements.map((item) => (
          <div
            key={item.id}
            className={`
              bg-surface rounded-lg border shadow-card p-5
              ${item.urgent ? 'border-amber-300 dark:border-amber-700/50 ring-1 ring-amber-100 dark:ring-amber-900/30' : 'border-edge'}
            `}
          >
            <div className="flex items-start gap-4">
              {/* Pin icon */}
              <div className="shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-warning">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-amber-50 dark:bg-amber-950/40 text-warning border border-amber-200 dark:border-amber-800/50">
                    {t('common.pinned')}
                  </span>
                  {item.urgent && (
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-red-50 dark:bg-red-950/40 text-danger border border-red-200 dark:border-red-800/50">
                      {t('common.urgent')}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${CATEGORY_STYLES[item.category]}`}>
                    {t(CATEGORIES.find((c) => c.key === item.category)?.labelKey || '')}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-ink leading-snug">{item.title}</h3>
                <p className="mt-1.5 text-sm text-ink-secondary leading-relaxed">{item.excerpt}</p>

                <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    {item.author}
                  </span>
                  <span>·</span>
                  <span>{formatDate(item.date, locale)}</span>
                </div>
              </div>

              {/* Read more */}
              <button className="shrink-0 mt-1 px-3 py-1.5 text-xs font-medium text-brand bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors duration-150">
                {t('common.readMore')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-Column: News Feed + Events ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* ── News Feed (Main Column) ──────────────────────── */}
        <div className="xl:col-span-3 bg-surface rounded-lg border border-edge shadow-card">
          {/* Card header with filter pills */}
          <div className="px-5 py-4 border-b border-edge-subtle">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                </svg>
                <h2 className="text-base font-semibold text-ink">{t('actualites.latestNews')}</h2>
                <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-950/40 text-brand border border-blue-200 dark:border-blue-800/50">
                  {filteredNews.length}
                </span>
              </div>
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveFilter(cat.key)}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-medium
                    transition-colors duration-150
                    ${activeFilter === cat.key
                      ? 'bg-brand text-white shadow-sm'
                      : 'bg-surface-200 text-ink-secondary hover:bg-surface-300 hover:text-ink'
                    }
                  `}
                >
                  {t(cat.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* News items */}
          <ul className="divide-y divide-edge-subtle">
            {filteredNews.length === 0 && (
              <li className="px-5 py-12 text-center">
                <svg className="w-10 h-10 mx-auto text-ink-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                </svg>
                <p className="text-sm font-medium text-ink-secondary">{t('common.noNews')}</p>
                <p className="text-xs text-ink-muted mt-1">{t('actualites.tryDifferentFilter')}</p>
              </li>
            )}
            {filteredNews.map((item) => (
              <li key={item.id} className="px-5 py-4 hover:bg-surface-200/50 transition-colors duration-100 cursor-pointer group">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${CATEGORY_STYLES[item.category]}`}>
                    {t(CATEGORIES.find((c) => c.key === item.category)?.labelKey || '')}
                  </span>
                  <span className="text-xs text-ink-muted">{formatDate(item.date, locale)}</span>
                </div>

                <h3 className="text-sm font-semibold text-ink leading-snug group-hover:text-brand transition-colors duration-150">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-ink-secondary leading-relaxed line-clamp-2">{item.excerpt}</p>

                <div className="mt-2.5 flex items-center gap-4 text-xs text-ink-muted">
                  {/* Author */}
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    {item.author}
                  </span>

                  {/* Views */}
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {item.views}
                  </span>

                  {/* Comments */}
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    {item.comments}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-edge-subtle">
            <button className="w-full text-center text-sm font-medium text-brand hover:text-brand-hover transition-colors duration-150">
              {t('common.loadMore')}
            </button>
          </div>
        </div>

        {/* ── Upcoming Events (Sidebar Column) ─────────────── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Events Card */}
          <div className="bg-surface rounded-lg border border-edge shadow-card">
            <div className="px-5 py-4 border-b border-edge-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <h2 className="text-base font-semibold text-ink">{t('actualites.upcomingEvents')}</h2>
              </div>
              <button
                onClick={() => navigate('/dashboard/calendar')}
                className="text-sm font-medium text-brand hover:text-brand-hover transition-colors duration-150"
              >
                {t('calendar.title')}
              </button>
            </div>

            <ul className="divide-y divide-edge-subtle">
              {upcomingEvents.map((event) => (
                <li key={event.id} className="px-5 py-3.5 hover:bg-surface-200/50 transition-colors duration-100">
                  <div className="flex items-start gap-3">
                    {/* Date block */}
                    <div className="shrink-0 w-11 h-11 rounded-lg bg-surface-200 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-semibold text-ink-muted uppercase leading-none">
                        {new Date(event.date).toLocaleDateString(locale, { month: 'short' })}
                      </span>
                      <span className="text-base font-bold text-ink leading-tight">
                        {new Date(event.date).getDate()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink leading-snug truncate">{event.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                        {/* Time */}
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {event.time}
                        </span>
                        <span>·</span>
                        {/* Location */}
                        <span className="flex items-center gap-1 truncate">
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          {event.location}
                        </span>
                      </div>
                    </div>

                    {/* Countdown */}
                    <span className={`shrink-0 text-[11px] font-medium mt-0.5 ${daysUntilStyle(event.date)}`}>
                      {daysUntil(event.date)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="px-5 py-3 border-t border-edge-subtle">
              <button
                onClick={() => navigate('/dashboard/calendar')}
                className="w-full text-center text-sm font-medium text-brand hover:text-brand-hover transition-colors duration-150"
              >
                {t('common.viewCalendar')}
              </button>
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="bg-surface rounded-lg border border-edge shadow-card">
            <div className="px-5 py-4 border-b border-edge-subtle">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.678-5.504a4.5 4.5 0 00-6.364-6.364L4.5 8.737" />
                </svg>
                <h2 className="text-base font-semibold text-ink">{t('actualites.quickLinks')}</h2>
              </div>
            </div>

            <div className="p-4 space-y-1.5">
              {[
                { label: 'University Website', href: 'https://fmi.univ-tiaret.dz/' },
                { label: 'Moodle', href: 'https://moodle.univ-tiaret.dz/' },
                { label: 'University Library', href: 'https://biblio.univ-tiaret.dz/ar/' },
                { label: 'Email', href: 'mailto:medsaidghoulam@gmail.com', text: 'medsaidghoulam@gmail.com' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-ink-secondary hover:bg-surface-200 hover:text-ink transition-colors duration-100"
                >
                  <svg className="w-4 h-4 shrink-0 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  <span className="text-left">
                    <span className="block">{link.label}</span>
                    <span className="block text-xs text-ink-muted">{link.text || link.href}</span>
                  </span>
                  <svg className="w-3.5 h-3.5 ml-auto text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
