export default function ChatColumn() {
  return (
    <section className="flex flex-col h-full bg-bg-elevated">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold tracking-wider text-text-muted uppercase">
          3. Chat (Detailed Answers)
        </h2>
        <span className="text-xs text-text-faint uppercase tracking-wider">
          Session-only
        </span>
      </div>

      {/* Info card */}
      <div className="px-4 py-4 border-b border-border">
        <div className="rounded-md border border-border bg-bg-card px-3 py-3">
          <p className="text-xs text-text-muted leading-relaxed">
            Clicking a suggestion adds it to this chat and streams a detailed
            answer (separate prompt, more context). User can also type questions
            directly. One continuous chat per session — no login, no
            persistence.
          </p>
        </div>
      </div>

      {/* Chat body (empty state) */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-text-faint">
            Click a suggestion or type a question below.
          </p>
        </div>
      </div>

      {/* Chat input */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask anything…"
            className="flex-1 px-3 py-2 rounded-md bg-bg-card border border-border text-sm text-text placeholder-text-faint outline-none focus:border-border-strong"
          />
          <button className="px-4 py-2 rounded-md bg-accent-blue hover:bg-accent-blue/80 text-white text-sm font-medium transition-colors">
            Send
          </button>
        </div>
      </div>
    </section>
  );
}