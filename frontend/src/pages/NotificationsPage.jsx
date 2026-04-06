import React, { useEffect, useMemo, useState } from 'react';
import request from '../services/api';
import { connectNotificationsSocket } from '../services/realtime';

function priorityClasses(priority) {
  if (priority === 'high') return 'border-danger/25 bg-danger/10 text-danger';
  if (priority === 'medium') return 'border-brand/25 bg-brand-light text-brand';
  return 'border-edge bg-surface text-ink-secondary';
}

function toRelativeTime(value) {
  if (!value) return 'Just now';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Just now';

  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function inferPriority(type = '') {
  const normalized = String(type).toLowerCase();
  if (normalized.includes('reject')) return 'high';
  if (normalized.includes('request') || normalized.includes('accept')) return 'medium';
  return 'low';
}

function inferCategory(type = '') {
  const normalized = String(type).toLowerCase();
  if (normalized.includes('reclamation')) return 'Reclamation';
  if (normalized.includes('justification')) return 'Justification';
  if (normalized.includes('document')) return 'Documents';
  return 'General';
}

function decorateNotification(item) {
  return {
    ...item,
    category: inferCategory(item?.type),
    priority: inferPriority(item?.type),
    time: toRelativeTime(item?.createdAt),
    description: item?.message,
  };
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await request('/api/v1/notifications?limit=100');
        const rows = Array.isArray(res?.data) ? res.data : [];
        setNotifications(rows.map((item) => decorateNotification(item)));
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const socket = connectNotificationsSocket({
      onNotification: (payload) => {
        setNotifications((previous) => {
          if (previous.some((item) => item.id === payload?.id)) {
            return previous;
          }

          return [decorateNotification(payload), ...previous];
        });
      },
      onUnreadCount: (payload) => {
        const unreadCount = Number(payload?.unreadCount);
        if (!Number.isFinite(unreadCount) || unreadCount < 0) {
          return;
        }

        if (unreadCount === 0) {
          setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
        }
      },
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const filtered = useMemo(
    () => notifications.filter((item) => (showUnreadOnly ? !item.read : true)),
    [notifications, showUnreadOnly]
  );
  const unreadCount = notifications.filter((item) => !item.read).length;

  const markAsRead = async (id) => {
    try {
      setBusy(true);
      await request(`/api/v1/notifications/${id}/read`, { method: 'PUT' });
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      setBusy(true);
      await request('/api/v1/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.2),transparent_34%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">System Feed</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Notifications</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
            Stay on top of academic deadlines, requests, hearings, and generated documents without switching between modules.
          </p>
          <div className="mt-6 inline-flex rounded-lg border border-edge bg-surface px-4 py-3 shadow-soft">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-tertiary">Unread</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{unreadCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-edge bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-edge-subtle px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">Activity Stream</h2>
            <p className="mt-1 text-sm text-ink-secondary">A consolidated list of alerts across the pedagogical platform.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUnreadOnly((value) => !value)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                showUnreadOnly
                  ? 'border-brand bg-brand-light text-brand'
                  : 'border-edge bg-surface text-ink-secondary hover:text-ink'
              }`}
            >
              {showUnreadOnly ? 'Showing unread only' : 'Show unread only'}
            </button>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={busy || !unreadCount}
              className="rounded-md border border-edge bg-surface px-4 py-2 text-sm font-medium text-ink-secondary transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>
        </div>

        <div className="divide-y divide-edge-subtle">
          {loading ? (
            <div className="px-6 py-14 text-center">
              <p className="text-base font-medium text-ink">Loading notifications...</p>
            </div>
          ) : null}

          {filtered.map((item) => (
            <article key={item.id} className="px-6 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(item.priority)}`}>
                      {item.category}
                    </span>
                    {!item.read ? <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">Unread</span> : null}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">{item.title}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">{item.description}</p>
                  {!item.read ? (
                    <button
                      type="button"
                      onClick={() => markAsRead(item.id)}
                      disabled={busy}
                      className="mt-3 rounded-lg border border-brand/25 bg-brand-light px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Mark as read
                    </button>
                  ) : null}
                </div>
                <div className="shrink-0 text-sm text-ink-tertiary">{item.time}</div>
              </div>
            </article>
          ))}

          {!loading && !filtered.length ? (
            <div className="px-6 py-14 text-center">
              <p className="text-base font-medium text-ink">No notifications match the current filter.</p>
              <p className="mt-2 text-sm text-ink-secondary">Turn off the unread filter to view the full activity stream.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
