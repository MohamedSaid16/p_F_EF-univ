import React, { useMemo, useState } from 'react';
import aiAPI from '../services/ai';

const STARTERS = [
  'Summarize my deadlines this week.',
  'Help me draft a formal request email to administration.',
  'Show my PFE subject and defense status.',
  'Explain the appeal process for disciplinary decisions.',
];

export default function AIAssistantPage() {
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your university assistant. Ask about PFE, deadlines, requests, or academic tasks.',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const emptyState = useMemo(() => history.length === 0, [history.length]);

  const normalizeAssistantText = (text) =>
    String(text || '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/^\s*[-*]\s+/gm, '• ')
      .replace(/`{1,3}/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const sendPrompt = async (text) => {
    const content = text.trim();
    if (!content || isTyping) return;

    setHistory((prev) => [...prev, { role: 'user', content }]);
    setPrompt('');
    setIsTyping(true);

    try {
      const apiHistory = history.slice(-10).map((item) => ({
        role: item.role,
        content: item.content,
      }));

      const response = await aiAPI.chat({
        message: content,
        history: apiHistory,
      });

      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: normalizeAssistantText(response?.data?.reply || 'No response returned from AI service.'),
        },
      ]);
    } catch (error) {
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: error?.message || 'AI service is unavailable right now.',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendPrompt(prompt);
  };

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.22),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.16),transparent_30%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">AI Support</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Chatbot Workspace</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
            The chatbot screen now matches the updated project style and is ready to be connected to the live AI backend.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Quick prompts</h2>
          <p className="mt-1 text-sm text-ink-secondary">Use one of these starters to test the interface.</p>
          <div className="mt-4 space-y-2.5">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => sendPrompt(starter)}
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-3 text-left text-sm text-ink-secondary transition hover:border-edge-strong hover:text-ink hover:bg-surface-200"
              >
                {starter}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-edge bg-canvas px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">Next step</p>
            <p className="mt-2 text-sm text-ink-secondary">
              Connect this page to the real AI endpoint when it is available in the backend.
            </p>
          </div>
        </aside>

        <div className="rounded-3xl border border-edge bg-surface shadow-card">
          <div className="border-b border-edge-subtle px-6 py-4">
            <h2 className="text-lg font-semibold text-ink">Conversation</h2>
          </div>

          <div className="min-h-[440px] space-y-4 px-6 py-5">
            {emptyState ? (
              <div className="rounded-2xl border border-dashed border-edge bg-canvas px-6 py-12 text-center">
                <p className="text-base font-medium text-ink">No conversation yet.</p>
                <p className="mt-2 text-sm text-ink-secondary">Ask your first question about studies, PFE, or deadlines.</p>
              </div>
            ) : (
              history.map((item, index) => (
                <div key={`${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-2xl rounded-2xl px-4 py-3 ${item.role === 'user' ? 'bg-brand text-white' : 'border border-edge bg-surface text-ink'}`}>
                    <p className={`text-xs font-semibold ${item.role === 'user' ? 'text-white/80' : 'text-ink-tertiary'}`}>
                      {item.role === 'user' ? 'You' : 'Assistant'}
                    </p>
                    <p className="mt-1 text-sm leading-6">{item.content}</p>
                  </div>
                </div>
              ))
            )}

            {isTyping ? (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-edge bg-surface px-4 py-3 text-sm text-ink-secondary">Assistant is typing...</div>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-edge-subtle px-6 py-4">
            <div className="rounded-2xl border border-edge bg-surface p-3">
              <textarea
                rows={4}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Type your question for the AI assistant..."
                className="w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-edge-subtle pt-3">
                <p className="text-xs text-ink-tertiary">Responses come from `/api/v1/ai/chat`.</p>
                <button
                  type="submit"
                  disabled={!prompt.trim() || isTyping}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

