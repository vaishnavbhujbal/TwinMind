export default function SuggestionsColumn() {
  return (
    <section className="flex flex-col h-full border-r border-border bg-bg-elevated">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold tracking-wider text-text-muted uppercase">
          2. Live Suggestions
        </h2>
        <span className="text-xs text-text-faint uppercase tracking-wider">0 batches</span>
      </div>

      {/* Reload button + auto-refresh hint */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          className="text-sm px-3 py-1.5 rounded-md border border-border hover:border-border-strong hover:bg-bg-card transition-colors text-text-muted hover:text-text"
        >
          ↻ Reload suggestions
        </button>
        <span className="text-xs text-text-faint">auto-refresh in 30s</span>
      </div>

      {/* Info card */}
      <div className="px-4 py-4 border-b border-border">
        <div className="rounded-md border border-border bg-bg-card px-3 py-3">
          <p className="text-xs text-text-muted leading-relaxed">
            On reload (or auto every ~30s), generate{" "}
            <span className="text-text font-medium">3 fresh suggestions</span>{" "}
            from recent transcript context. New batch appears at the top; older
            batches push down (faded). Each is a tappable card: a{" "}
            <span className="text-accent-blue">question to ask</span>, a{" "}
            <span className="text-accent-purple">talking point</span>, an{" "}
            <span className="text-accent-green">answer</span>, or a{" "}
            <span className="text-accent-orange">fact-check</span>. The preview
            alone should already be useful.
          </p>
        </div>
      </div>

      {/* Suggestions body (empty state) */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-text-faint">
            Suggestions appear here once recording starts.
          </p>
        </div>
      </div>
    </section>
  );
}