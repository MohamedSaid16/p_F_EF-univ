import React, { useMemo, useState } from 'react';

const STARTERS = [
  'Summarize my deadlines this week.',
  'Help me draft a formal request email to administration.',
  'Explain the appeal process for disciplinary decisions.',
  'Create a study plan for Algorithms and Databases.',
];

export default function AIAssistantPage() {
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const emptyState = useMemo(() => history.length === 0, [history.length]);

  const sendPrompt = async (text) => {
    const content = text.trim();
    if (!content || isTyping) return;

    setHistory((prev) => [...prev, { role: 'user', content }]);
    setPrompt('');
    setIsTyping(true);

    // Placeholder response until AI endpoint is connected
    await new Promise((resolve) => setTimeout(resolve, 900));
    setHistory((prev) => [
      ...prev,
      {
        role: 'assistant',
        content:
          'Assistant response placeholder: connect this page to your AI backend endpoint (for example /api/v1/ai/chat) to return real contextual answers.',
      },
    ]);
    setIsTyping(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendPrompt(prompt);
  };

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      <section className="relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.2),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.14),transparent_30%)]" />
        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Study Support</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">AI Assistant</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
            Ask academic, administrative, and planning questions in one place. This interface is ready for direct integration with your AI module backend.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-edge bg-surface p-5 shadow-card">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Quick Prompts</h2>
          <p className="mt-1 text-sm text-ink-secondary">Start with one tap, then refine your question.</p>
          <div className="mt-4 space-y-2.5">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => sendPrompt(starter)}
                className="w-full rounded-lg border border-edge bg-surface px-3.5 py-3 text-left text-sm text-ink-secondary transition hover:border-brand/35 hover:text-ink hover:bg-surface-200"
              >
                {starter}
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-lg border border-edge bg-surface shadow-card">
          <div className="border-b border-edge-subtle px-6 py-4">
            <h2 className="text-lg font-semibold text-ink">Conversation</h2>
          </div>

          <div className="min-h-[420px] space-y-4 px-6 py-5">
            {emptyState ? (
              <div className="rounded-lg border border-dashed border-edge bg-canvas px-6 py-12 text-center">
                <p className="text-base font-medium text-ink">No conversation yet.</p>
                <p className="mt-2 text-sm text-ink-secondary">Ask your first question about studies, documents, or deadlines.</p>
              </div>
            ) : (
              history.map((item, index) => (
                <div key={`${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-2xl rounded-lg px-4 py-3 ${item.role === 'user' ? 'bg-brand text-white' : 'border border-edge bg-surface text-ink'}`}>
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
                <div className="rounded-lg border border-edge bg-surface px-4 py-3 text-sm text-ink-secondary">Assistant is typing...</div>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-edge-subtle px-6 py-4">
            <div className="rounded-lg border border-edge bg-surface p-3">
              <textarea
                rows={4}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Type your question for the AI assistant..."
                className="w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-edge-subtle pt-3">
                <p className="text-xs text-ink-tertiary">Real AI answers will appear once backend integration is connected.</p>
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
