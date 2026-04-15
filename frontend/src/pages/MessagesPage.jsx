import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { messagesAPI } from '../services/api';

function formatUserName(user) {
  if (!user) return 'Unknown user';
  const full = `${user.prenom || ''} ${user.nom || ''}`.trim();
  return full || user.email || `User #${user.id}`;
}

function toRelativeTime(value) {
  if (!value) return 'Now';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Now';

  const deltaSec = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [inbox, setInbox] = useState([]);
  const [capabilities, setCapabilities] = useState({
    canBroadcast: false,
    broadcastLabel: null,
    recipients: [],
  });

  const [mode, setMode] = useState('unicast');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState('');

  const loadMessaging = async () => {
    try {
      setLoading(true);
      setError('');
      const [inboxRes, capsRes] = await Promise.all([
        messagesAPI.getInbox(),
        messagesAPI.getCapabilities(),
      ]);

      const inboxRows = Array.isArray(inboxRes?.data) ? inboxRes.data : [];
      const caps = capsRes?.data || {};
      const canBroadcast = Boolean(caps.canBroadcast);
      const recipients = Array.isArray(caps.recipients) ? caps.recipients : [];

      setInbox(inboxRows);
      setCapabilities({
        canBroadcast,
        broadcastLabel: caps.broadcastLabel || null,
        recipients,
      });

      if (!canBroadcast) {
        setMode('unicast');
      }

      if (!recipientUserId && recipients.length) {
        setRecipientUserId(String(recipients[0].id));
      }
    } catch (err) {
      setError(err?.message || 'Failed to load messaging data.');
      setInbox([]);
      setCapabilities({ canBroadcast: false, broadcastLabel: null, recipients: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessaging();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threads = useMemo(() => {
    const currentUserId = user?.id;
    const map = new Map();

    inbox.forEach((item) => {
      const isMine = item?.sender?.id === currentUserId;
      const peer = isMine ? item?.recipient : item?.sender;
      const threadId = String(peer?.id || `unknown-${item.id}`);

      if (!map.has(threadId)) {
        map.set(threadId, {
          id: threadId,
          peer,
          messages: [],
          lastMessage: item,
        });
      }

      const entry = map.get(threadId);
      entry.messages.push({
        id: item.id,
        mine: isMine,
        senderLabel: isMine ? 'You' : formatUserName(item.sender),
        text: item.content,
        time: toRelativeTime(item.createdAt),
        createdAt: item.createdAt,
      });

      const currentLast = entry.lastMessage;
      const currentLastTime = new Date(currentLast?.createdAt || 0).getTime();
      const nextTime = new Date(item?.createdAt || 0).getTime();
      if (nextTime > currentLastTime) {
        entry.lastMessage = item;
      }
    });

    return Array.from(map.values())
      .map((thread) => ({
        ...thread,
        name: formatUserName(thread.peer),
        role: Array.isArray(thread.peer?.roles) && thread.peer.roles.length
          ? thread.peer.roles.join(', ')
          : 'User',
        time: toRelativeTime(thread.lastMessage?.createdAt),
        preview: thread.lastMessage?.content || '',
        messages: thread.messages.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
      }))
      .sort(
        (a, b) => new Date(b.lastMessage?.createdAt || 0).getTime() - new Date(a.lastMessage?.createdAt || 0).getTime()
      );
  }, [inbox, user?.id]);

  useEffect(() => {
    if (!threads.length) {
      setSelectedThreadId('');
      return;
    }

    const exists = threads.some((thread) => thread.id === selectedThreadId);
    if (!exists) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const handleSend = async () => {
    try {
      setError('');
      setSuccess('');

      if (!content.trim()) {
        setError('Message content is required.');
        return;
      }

      if (mode === 'unicast' && !recipientUserId) {
        setError('Please select a recipient for unicast.');
        return;
      }

      setSending(true);
      await messagesAPI.send({
        mode,
        recipientUserId: mode === 'unicast' ? Number(recipientUserId) : undefined,
        title,
        content,
      });

      setTitle('');
      setContent('');
      setSuccess(mode === 'broadcast' ? 'Broadcast sent successfully.' : 'Message sent successfully.');
      await loadMessaging();
    } catch (err) {
      setError(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_30%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Communication Hub</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Messages</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
            Role-based messaging is enabled: admin can broadcast/unicast to all users, teacher can broadcast/unicast to students, and students can send unicast messages to teachers.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-edge bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Compose Message</h2>
        <p className="mt-1 text-sm text-ink-secondary">Send based on your role permissions.</p>

        {error ? (
          <div className="mt-4 rounded-lg border border-edge-strong bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{success}</div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Send mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('unicast')}
                className={`rounded-md border px-4 py-2 text-sm font-medium ${
                  mode === 'unicast' ? 'border-brand bg-brand-light text-brand' : 'border-edge bg-surface text-ink'
                }`}
              >
                Unicast
              </button>
              {capabilities.canBroadcast ? (
                <button
                  type="button"
                  onClick={() => setMode('broadcast')}
                  className={`rounded-md border px-4 py-2 text-sm font-medium ${
                    mode === 'broadcast' ? 'border-brand bg-brand-light text-brand' : 'border-edge bg-surface text-ink'
                  }`}
                >
                  Broadcast
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Recipient</label>
            {mode === 'broadcast' ? (
              <div className="rounded-md border border-edge bg-surface px-4 py-2 text-sm text-ink-secondary">
                {capabilities.broadcastLabel || 'Broadcast audience'}
              </div>
            ) : (
              <select
                value={recipientUserId}
                onChange={(event) => setRecipientUserId(event.target.value)}
                className="w-full rounded-md border border-control-border bg-control-bg px-3 py-2 text-sm text-ink outline-none"
              >
                {!capabilities.recipients.length ? <option value="">No recipients available</option> : null}
                {capabilities.recipients.map((target) => (
                  <option key={target.id} value={String(target.id)}>
                    {formatUserName(target)} ({Array.isArray(target.roles) ? target.roles.join(', ') : 'user'})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-control-border bg-control-bg px-3 py-2 text-sm text-ink outline-none"
              placeholder="Subject"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Content</label>
            <textarea
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="w-full resize-none rounded-md border border-control-border bg-control-bg px-3 py-2 text-sm text-ink outline-none"
              placeholder="Write your message..."
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || loading}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-edge bg-surface p-4 shadow-card">
          <div className="border-b border-edge-subtle px-2 pb-4">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Conversations</h2>
            <p className="mt-1 text-sm text-ink-secondary">Your latest threads based on incoming and sent messages.</p>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="px-2 py-6 text-sm text-ink-secondary">Loading conversations...</p>
            ) : null}

            {!loading && !threads.length ? (
              <p className="px-2 py-6 text-sm text-ink-secondary">No conversations yet.</p>
            ) : null}

            {threads.map((thread) => {
              const selected = thread.id === selectedThreadId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full rounded-lg border px-4 py-4 text-left transition ${
                    selected
                      ? 'border-brand bg-brand-light/70 shadow-sm'
                      : 'border-edge bg-surface hover:border-edge-strong hover:bg-surface-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{thread.name}</p>
                      <p className="mt-1 text-xs text-ink-tertiary">{thread.role}</p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-tertiary">{thread.time}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-ink-secondary">{thread.preview}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="rounded-lg border border-edge bg-surface shadow-card">
          <div className="flex items-center justify-between gap-4 border-b border-edge-subtle px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">{activeThread?.name || 'Conversation'}</h2>
              <p className="mt-1 text-sm text-ink-secondary">{activeThread?.role || 'Select a thread'}</p>
            </div>
          </div>

          <div className="space-y-4 px-6 py-6">
            {!activeThread ? (
              <p className="text-sm text-ink-secondary">No thread selected.</p>
            ) : null}

            {activeThread?.messages.map((message) => (
              <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xl rounded-lg px-4 py-3 ${message.mine ? 'bg-brand text-white' : 'border border-edge bg-surface text-ink'}`}>
                  <p className={`text-xs font-semibold ${message.mine ? 'text-white/80' : 'text-ink-tertiary'}`}>{message.senderLabel}</p>
                  <p className="mt-1 text-sm leading-6">{message.text}</p>
                  <p className={`mt-2 text-xs ${message.mine ? 'text-white/75' : 'text-ink-muted'}`}>{message.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

