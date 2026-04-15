import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import request from '../services/api';

const EVENT_COLORS = {
  academic:       'bg-brand',
  administrative: 'bg-warning',
  events:         'bg-success',
  research:       'bg-brand-dark',
  'student-life': 'bg-brand-hover',
};

const EVENT_BADGE_STYLES = {
  academic:       'bg-brand-light text-brand border border-edge-strong',
  administrative: 'bg-warning/10 text-warning border border-warning/30',
  events:         'bg-success/10 text-success border border-success/30',
  research:       'bg-surface-200 text-ink border border-edge',
  'student-life': 'bg-surface-300 text-ink-secondary border border-edge',
};

const CATEGORY_LABEL_KEYS = {
  academic: 'actualites.filterAcademic',
  administrative: 'actualites.filterAdministrative',
  events: 'actualites.filterEvents',
  research: 'actualites.filterResearch',
  'student-life': 'actualites.filterStudentLife',
};

function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthData(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Monday = 0 ... Sunday = 6  (ISO week)
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const prevMonthLast = new Date(year, month, 0).getDate();
  const cells = [];

  // Leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: prevMonthLast - i, inMonth: false, date: new Date(year, month - 1, prevMonthLast - i) });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
  }
  // Trailing days
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, inMonth: false, date: new Date(year, month + 1, d) });
    }
  }

  return cells;
}

function formatMonthYear(year, month, locale = 'en-GB') {
  return new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function toValidDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getRelativeDayLabel(targetDate, baseDate, locale) {
  const diffDays = Math.round((startOfDay(targetDate).getTime() - startOfDay(baseDate).getTime()) / (1000 * 60 * 60 * 24));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return formatter.format(diffDays, 'day');
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-DZ' : i18n.language === 'fr' ? 'fr-FR' : 'en-GB';

  const weekdays = useMemo(() => {
    const base = new Date(2024, 0, 1); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  const today = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfDay(today), [today]);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState('month');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyUpcoming, setOnlyUpcoming] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await request('/api/v1/actualites/events');
        setEvents(Array.isArray(res?.data) ? res.data : []);
      } catch {
        /* endpoint may not exist yet */
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const normalizedEvents = useMemo(
    () => (Array.isArray(events) ? events : [])
      .map((event, index) => {
        const date = toValidDate(event?.date);
        if (!date) return null;

        const category = CATEGORY_LABEL_KEYS[event?.category] ? event.category : 'academic';

        return {
          id: event?.id || `event-${index}`,
          title: event?.title || 'Untitled event',
          date,
          time: event?.time || 'TBD',
          location: event?.location || 'Location TBD',
          category,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [events]
  );

  const categoryOptions = useMemo(
    () => [
      { key: 'all', label: t('actualites.filterAll') },
      ...Object.keys(CATEGORY_LABEL_KEYS).map((categoryKey) => ({
        key: categoryKey,
        label: t(CATEGORY_LABEL_KEYS[categoryKey]),
      })),
    ],
    [t]
  );

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return normalizedEvents.filter((event) => {
      const matchesCategory = activeCategory === 'all' || event.category === activeCategory;
      const matchesQuery =
        !query ||
        `${event.title} ${event.location} ${event.time} ${event.category}`
          .toLowerCase()
          .includes(query);
      const matchesUpcoming = !onlyUpcoming || startOfDay(event.date).getTime() >= todayStart.getTime();

      return matchesCategory && matchesQuery && matchesUpcoming;
    });
  }, [normalizedEvents, activeCategory, searchQuery, onlyUpcoming, todayStart]);

  const eventsByDate = useMemo(() => {
    const map = new Map();

    filteredEvents.forEach((event) => {
      const key = getDateKey(event.date);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(event);
    });

    return map;
  }, [filteredEvents]);

  const selectedEvents = useMemo(
    () => eventsByDate.get(getDateKey(selectedDate)) || [],
    [eventsByDate, selectedDate]
  );

  const selectedEvent = useMemo(() => {
    if (!selectedEvents.length) {
      return null;
    }

    if (!selectedEventId) {
      return selectedEvents[0];
    }

    return selectedEvents.find((event) => String(event.id) === String(selectedEventId)) || selectedEvents[0];
  }, [selectedEvents, selectedEventId]);

  useEffect(() => {
    if (!selectedEvents.length) {
      if (selectedEventId !== null) {
        setSelectedEventId(null);
      }
      return;
    }

    const isSelectedEventVisible = selectedEvents.some((event) => String(event.id) === String(selectedEventId));

    if (!isSelectedEventVisible) {
      setSelectedEventId(selectedEvents[0].id);
    }
  }, [selectedEvents, selectedEventId]);

  const cells = useMemo(() => getMonthData(currentYear, currentMonth), [currentYear, currentMonth]);

  const monthEvents = useMemo(
    () => filteredEvents.filter((event) => event.date.getFullYear() === currentYear && event.date.getMonth() === currentMonth),
    [filteredEvents, currentYear, currentMonth]
  );

  const busyDaysCount = useMemo(() => new Set(monthEvents.map((event) => getDateKey(event.date))).size, [monthEvents]);

  const upcomingEvents = useMemo(
    () => filteredEvents.filter((event) => startOfDay(event.date).getTime() >= todayStart.getTime()),
    [filteredEvents, todayStart]
  );

  const nextEvent = upcomingEvents[0] || null;

  const agendaGroups = useMemo(() => {
    const groups = new Map();

    filteredEvents.forEach((event) => {
      const key = getDateKey(event.date);
      if (!groups.has(key)) {
        groups.set(key, { date: startOfDay(event.date), events: [] });
      }
      groups.get(key).events.push(event);
    });

    return Array.from(groups.values())
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .slice(0, 120);
  }, [filteredEvents]);

  const weekPulse = useMemo(() => {
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(todayStart);
      date.setDate(todayStart.getDate() + offset);

      const key = getDateKey(date);
      const count = (eventsByDate.get(key) || []).length;

      return {
        date,
        count,
      };
    });
  }, [eventsByDate, todayStart]);

  const weekPulseMax = useMemo(() => {
    const maxCount = Math.max(...weekPulse.map((item) => item.count));
    return Math.max(1, maxCount);
  }, [weekPulse]);

  const activeCategoryLabel = useMemo(() => {
    const selected = categoryOptions.find((category) => category.key === activeCategory);
    return selected?.label || t('actualites.filterAll');
  }, [categoryOptions, activeCategory, t]);

  const goPrev = useCallback(() => {
    setCurrentMonth((prevMonth) => {
      if (prevMonth === 0) {
        setCurrentYear((prevYear) => prevYear - 1);
        return 11;
      }
      return prevMonth - 1;
    });
  }, []);

  const goNext = useCallback(() => {
    setCurrentMonth((prevMonth) => {
      if (prevMonth === 11) {
        setCurrentYear((prevYear) => prevYear + 1);
        return 0;
      }
      return prevMonth + 1;
    });
  }, []);

  const goToday = useCallback(() => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(today);
    setSelectedEventId(null);
  }, [today]);

  const jumpToEvent = useCallback((event) => {
    setSelectedDate(event.date);
    setCurrentYear(event.date.getFullYear());
    setCurrentMonth(event.date.getMonth());
    setSelectedEventId(event.id);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (isTyping) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }

      if (event.key.toLowerCase() === 't') {
        event.preventDefault();
        goToday();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goPrev, goNext, goToday]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-edge-strong border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">

      <section className="relative overflow-hidden rounded-2xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(29,78,216,0.15),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_85%_85%,rgba(234,179,8,0.14),transparent_35%)]" />
        <div className="relative p-6 lg:p-7">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-ink-tertiary">
                {t('calendar.title')}
              </p>
              <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-ink">
                {formatMonthYear(currentYear, currentMonth, locale)}
              </h1>
              <p className="mt-2 text-sm text-ink-secondary max-w-2xl">
                {t('calendar.subtitle')}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/dashboard/actualites')}
                className="inline-flex items-center gap-2 rounded-md border border-edge-strong bg-brand-light px-4 py-2.5 text-sm font-medium text-brand transition-all duration-150 hover:bg-brand-light/80 focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59" />
                </svg>
                {t('calendar.viewActualites')}
              </button>

              <button
                onClick={goToday}
                className="rounded-md border border-edge bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition-all duration-150 hover:bg-surface-200 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {t('common.today')}
              </button>

              {nextEvent && (
                <button
                  onClick={() => jumpToEvent(nextEvent)}
                  className="rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-hover active:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30"
                >
                  {t('calendar.jumpToNext', { defaultValue: 'Jump to Next Event' })}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
            <div className="bg-surface/80 backdrop-blur rounded-xl border border-edge p-4">
              <p className="text-xs uppercase tracking-wide text-ink-muted">{t('calendar.visibleEvents', { defaultValue: 'Visible Events' })}</p>
              <p className="mt-2 text-2xl font-bold text-ink">{filteredEvents.length}</p>
              <p className="mt-1 text-xs text-ink-tertiary">{activeCategoryLabel}</p>
            </div>

            <div className="bg-surface/80 backdrop-blur rounded-xl border border-edge p-4">
              <p className="text-xs uppercase tracking-wide text-ink-muted">{t('calendar.busyDays', { defaultValue: 'Busy Days This Month' })}</p>
              <p className="mt-2 text-2xl font-bold text-ink">{busyDaysCount}</p>
              <p className="mt-1 text-xs text-ink-tertiary">{monthEvents.length} {t('actualites.upcomingEvents')}</p>
            </div>

            <div className="bg-surface/80 backdrop-blur rounded-xl border border-edge p-4">
              <p className="text-xs uppercase tracking-wide text-ink-muted">{t('calendar.focusDay', { defaultValue: 'Focus Day' })}</p>
              <p className="mt-2 text-2xl font-bold text-ink">{selectedEvents.length}</p>
              <p className="mt-1 text-xs text-ink-tertiary">
                {selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </div>

            <div className="bg-surface/80 backdrop-blur rounded-xl border border-edge p-4">
              <p className="text-xs uppercase tracking-wide text-ink-muted">{t('calendar.nextEvent', { defaultValue: 'Next Event' })}</p>
              {nextEvent ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-ink truncate">{nextEvent.title}</p>
                  <p className="mt-1 text-xs text-ink-tertiary">
                    {nextEvent.date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · {nextEvent.time}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-tertiary">{t('common.noUpcoming')}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface rounded-xl border border-edge shadow-card p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
          <label className="relative block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2m1.7-4.3a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            </span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('calendar.searchPlaceholder', { defaultValue: 'Search events by title, location, or category' })}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-edge bg-canvas text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <div className="flex rounded-lg border border-edge overflow-hidden">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 text-sm font-medium ${viewMode === 'month' ? 'bg-brand text-white' : 'bg-surface text-ink-secondary hover:bg-surface-200'}`}
            >
              {t('calendar.viewMonth', { defaultValue: 'Month' })}
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-4 py-2 text-sm font-medium ${viewMode === 'agenda' ? 'bg-brand text-white' : 'bg-surface text-ink-secondary hover:bg-surface-200'}`}
            >
              {t('calendar.viewAgenda', { defaultValue: 'Agenda' })}
            </button>
          </div>

          <button
            onClick={() => setOnlyUpcoming((prev) => !prev)}
            className={`px-4 py-2.5 rounded-md text-sm font-medium border transition-colors duration-150 ${onlyUpcoming ? 'bg-success/10 text-success border-success/30' : 'bg-surface text-ink-secondary border-edge hover:bg-surface-200'}`}
          >
            {onlyUpcoming
              ? t('calendar.onlyUpcoming', { defaultValue: 'Only Upcoming' })
              : t('calendar.allEvents', { defaultValue: 'All Events' })}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-3">
          {categoryOptions.map((category) => (
            <button
              key={category.key}
              onClick={() => setActiveCategory(category.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-150 ${activeCategory === category.key ? 'bg-brand text-white border-brand' : 'bg-surface text-ink-secondary border-edge hover:bg-surface-200'}`}
            >
              {category.label}
            </button>
          ))}

          <button
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
              setOnlyUpcoming(false);
            }}
            className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-200 transition-colors duration-150"
          >
            {t('calendar.resetFilters', { defaultValue: 'Reset filters' })}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        <div className="xl:col-span-3 bg-surface rounded-xl border border-edge shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-edge-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                className="p-1.5 rounded-md text-ink-tertiary hover:text-ink-secondary hover:bg-surface-200 transition-colors duration-150"
                aria-label={t('calendar.previousMonth')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <h2 className="text-base font-semibold text-ink min-w-[160px] text-center">
                {formatMonthYear(currentYear, currentMonth, locale)}
              </h2>
              <button
                onClick={goNext}
                className="p-1.5 rounded-md text-ink-tertiary hover:text-ink-secondary hover:bg-surface-200 transition-colors duration-150"
                aria-label={t('calendar.nextMonth')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-ink-muted hidden sm:block">
              {t('calendar.keyboardHint', { defaultValue: 'Tip: use Left/Right arrows and T for today' })}
            </p>
          </div>

          {viewMode === 'month' ? (
            <>
              <div className="grid grid-cols-7 border-b border-edge-subtle">
                {weekdays.map((dayLabel) => (
                  <div key={dayLabel} className="py-2.5 text-center text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    {dayLabel}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((cell, index) => {
                  const isToday = isSameDay(cell.date, today);
                  const isSelected = isSameDay(cell.date, selectedDate);
                  const dayEvents = eventsByDate.get(getDateKey(cell.date)) || [];
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <button
                      key={`${getDateKey(cell.date)}-${index}`}
                      onClick={() => {
                        setSelectedDate(cell.date);
                        setSelectedEventId(null);

                        if (!cell.inMonth) {
                          setCurrentMonth(cell.date.getMonth());
                          setCurrentYear(cell.date.getFullYear());
                        }
                      }}
                      className={`relative h-[98px] p-2 border-b border-r border-edge-subtle text-left transition-colors duration-100 ${!cell.inMonth ? 'text-ink-muted/40' : 'text-ink-secondary'} ${isSelected ? 'bg-brand-light' : 'hover:bg-surface-200/50'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${isToday ? 'bg-brand text-white' : ''} ${isSelected && !isToday ? 'ring-2 ring-brand/40' : ''}`}>
                          {cell.day}
                        </span>

                        {hasEvents ? (
                          <span className="text-[11px] font-semibold text-ink-muted">{dayEvents.length}</span>
                        ) : null}
                      </div>

                      {hasEvents ? (
                        <div className="mt-1.5 space-y-1">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div key={event.id} className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${EVENT_COLORS[event.category] || 'bg-brand'}`} />
                              <span className="text-[10px] leading-tight text-ink-muted truncate">{event.title}</span>
                            </div>
                          ))}
                          {dayEvents.length > 2 ? <p className="text-[10px] text-ink-muted">+{dayEvents.length - 2}</p> : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="px-5 py-3 border-t border-edge-subtle flex items-center gap-4 flex-wrap">
                {Object.keys(CATEGORY_LABEL_KEYS).map((categoryKey) => (
                  <div key={categoryKey} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${EVENT_COLORS[categoryKey] || 'bg-brand'}`} />
                    <span className="text-xs text-ink-muted">{t(CATEGORY_LABEL_KEYS[categoryKey])}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              {agendaGroups.length === 0 ? (
                <div className="px-5 py-14 text-center text-sm text-ink-tertiary">
                  {t('calendar.noMatches', { defaultValue: 'No events match your current filters.' })}
                </div>
              ) : (
                <div className="divide-y divide-edge-subtle">
                  {agendaGroups.map((group) => (
                    <section key={getDateKey(group.date)} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-sm font-semibold text-ink">
                          {group.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h3>
                        <span className="text-xs text-ink-muted">
                          {getRelativeDayLabel(group.date, today, locale)}
                        </span>
                      </div>

                      <ul className="space-y-2">
                        {group.events.map((event) => (
                          <li key={event.id}>
                            <button
                              onClick={() => jumpToEvent(event)}
                              className="w-full text-left rounded-lg border border-edge-subtle bg-canvas px-3 py-2 hover:bg-surface-200/60 transition-colors duration-100"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink truncate">{event.title}</p>
                                  <p className="text-xs text-ink-muted mt-1">{event.time} · {event.location}</p>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${EVENT_BADGE_STYLES[event.category] || ''}`}>
                                  {t(CATEGORY_LABEL_KEYS[event.category] || 'actualites.filterAcademic')}
                                </span>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="xl:col-span-2 space-y-6">

          <div className="bg-surface rounded-xl border border-edge shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-edge-subtle">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <h2 className="text-base font-semibold text-ink">
                  {t('calendar.selectedEventsTitle', { defaultValue: 'Selected Day Events' })}
                </h2>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                {selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {selectedEvents.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <svg className="w-10 h-10 mx-auto text-ink-muted/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                </svg>
                <p className="text-sm font-medium text-ink-secondary">{t('common.noEvents')}</p>
                <p className="text-xs text-ink-muted mt-1">{t('calendar.selectAnother')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-edge-subtle">
                {selectedEvents.map((event) => (
                  <li key={event.id}>
                    <button
                      onClick={() => setSelectedEventId(event.id)}
                      className={`w-full text-left px-5 py-4 transition-colors duration-100 ${String(selectedEvent?.id) === String(event.id) ? 'bg-brand-light' : 'hover:bg-surface-200/50'}`}
                    >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${EVENT_BADGE_STYLES[event.category] || ''}`}>
                        {t(CATEGORY_LABEL_KEYS[event.category] || 'actualites.filterAcademic')}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-ink">{event.title}</h3>
                    <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {event.time}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        {event.location}
                      </span>
                    </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-surface rounded-xl border border-edge shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-edge-subtle">
              <h2 className="text-base font-semibold text-ink">
                {t('calendar.eventSpotlight', { defaultValue: 'Event Spotlight' })}
              </h2>
            </div>

            {selectedEvent ? (
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-ink leading-snug">{selectedEvent.title}</h3>
                    <p className="text-xs text-ink-tertiary mt-1">
                      {selectedEvent.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${EVENT_BADGE_STYLES[selectedEvent.category] || ''}`}>
                    {t(CATEGORY_LABEL_KEYS[selectedEvent.category] || 'actualites.filterAcademic')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-edge-subtle bg-canvas p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t('calendar.timeLabel', { defaultValue: 'Time' })}</p>
                    <p className="mt-1 text-sm font-medium text-ink">{selectedEvent.time}</p>
                  </div>

                  <div className="rounded-lg border border-edge-subtle bg-canvas p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t('calendar.whenLabel', { defaultValue: 'When' })}</p>
                    <p className="mt-1 text-sm font-medium text-ink">{getRelativeDayLabel(selectedEvent.date, today, locale)}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-edge-subtle bg-canvas p-3">
                  <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t('calendar.locationLabel', { defaultValue: 'Location' })}</p>
                  <p className="mt-1 text-sm font-medium text-ink">{selectedEvent.location}</p>
                </div>
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-ink-muted">
                {t('calendar.noEventSelected', { defaultValue: 'Select an event to see full details.' })}
              </div>
            )}
          </div>

          <div className="bg-surface rounded-xl border border-edge shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-edge-subtle flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{t('calendar.weekPulse', { defaultValue: '7-Day Pulse' })}</h2>
              <span className="text-xs text-ink-muted">{t('common.allUpcoming')}</span>
            </div>

            <div className="px-5 py-4 space-y-3">
              {weekPulse.map((item) => {
                const width = Math.round((item.count / weekPulseMax) * 100);
                const isFocusDay = isSameDay(item.date, selectedDate);

                return (
                  <button
                    key={getDateKey(item.date)}
                    onClick={() => {
                      setSelectedDate(item.date);
                      setCurrentYear(item.date.getFullYear());
                      setCurrentMonth(item.date.getMonth());
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors duration-100 ${isFocusDay ? 'border-brand bg-brand-light/25' : 'border-edge-subtle bg-canvas hover:bg-surface-200/60'}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-2">
                      <span className="font-medium text-ink-secondary">
                        {item.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-ink-muted">{item.count}</span>
                    </div>

                    <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                      <div className="h-full bg-brand rounded-full" style={{ width: `${width}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'agenda' && agendaGroups.length === 0 && (
        <div className="rounded-xl border border-dashed border-edge bg-surface px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink-secondary">{t('calendar.noMatches', { defaultValue: 'No events match your current filters.' })}</p>
          <p className="mt-1 text-xs text-ink-muted">{t('calendar.resetHint', { defaultValue: 'Try clearing search and category filters.' })}</p>
        </div>
      )}
    </div>
  );
}

