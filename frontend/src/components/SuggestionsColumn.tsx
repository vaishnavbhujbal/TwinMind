import { useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";
import type { Suggestion, SuggestionType } from "../types";

type SuggestionsColumnProps = {
  loading: boolean;
  error: string | null;
  autoRefreshSeconds: number;
  /** Whether auto-refresh is currently active (i.e. user is recording). */
  autoRefreshActive: boolean;
  onReload: () => void;
  onSuggestionClick: (sug: Suggestion) => void;
};

export default function SuggestionsColumn({
  loading,
  error,
  autoRefreshSeconds,
  autoRefreshActive,
  onReload,
  onSuggestionClick,
}: SuggestionsColumnProps) {
  const { batches } = useSession();

  // Visible countdown to next auto-refresh. Resets on every new batch arrival
  // and whenever the active / interval value changes.
  const [secondsLeft, setSecondsLeft] = useState(autoRefreshSeconds);

  useEffect(() => {
    if (!autoRefreshActive) {
      setSecondsLeft(autoRefreshSeconds);
      return;
    }
    setSecondsLeft(autoRefreshSeconds);
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? autoRefreshSeconds : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
    // Reset countdown whenever a new batch lands.
  }, [autoRefreshActive, autoRefreshSeconds, batches.length]);

  return (
    <section className="flex flex-col h-full border-r border-border bg-bg-elevated">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold tracking-wider text-text-muted uppercase">
          2. Live Suggestions
        </h2>
        <span className="text-xs text-text-faint uppercase tracking-wider">
          {batches.length} {batches.length === 1 ? "batch" : "batches"}
        </span>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          onClick={onReload}
          disabled={loading}
          className={`text-sm px-3 py-1.5 rounded-md border border-border transition-colors ${
            loading
              ? "text-text-faint cursor-wait"
              : "hover:border-border-strong hover:bg-bg-card text-text-muted hover:text-text"
          }`}
        >
          {loading ? "Updating…" : "↻ Reload suggestions"}
        </button>
        <span className="text-xs text-text-faint">
          {autoRefreshActive
            ? `next auto-refresh in ${secondsLeft}s`
            : "auto-refresh pauses when mic is off"}
        </span>
      </div>

      {error && (
        <div className="px-4 py-3 border-b border-border bg-accent-orange/10">
          <p className="text-xs text-accent-orange">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {batches.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-text-faint text-center px-4">
              {loading
                ? "Generating first suggestions…"
                : autoRefreshActive
                ? "First batch appears in ~30s."
                : "Suggestions appear here once recording starts."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map((batch, batchIdx) => (
              <BatchBlock
                key={batch.id}
                createdAt={batch.created_at}
                suggestions={batch.suggestions}
                isLatest={batchIdx === 0}
                onClick={onSuggestionClick}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// --- Subcomponents ------------------------------------------------------------

function BatchBlock({
  createdAt,
  suggestions,
  isLatest,
  onClick,
}: {
  createdAt: string;
  suggestions: Suggestion[];
  isLatest: boolean;
  onClick: (s: Suggestion) => void;
}) {
  const opacity = isLatest ? "opacity-100" : "opacity-60";

  return (
    <div className={`space-y-2 transition-opacity ${opacity}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-faint">
        <span>
          {new Date(createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
        {isLatest && (
          <span className="px-1.5 py-0.5 rounded-sm bg-accent-blue/20 text-accent-blue">
            Latest
          </span>
        )}
      </div>
      {suggestions.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} onClick={() => onClick(s)} />
      ))}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onClick,
}: {
  suggestion: Suggestion;
  onClick: () => void;
}) {
  const { label, color } = typeMeta(suggestion.type);

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-md border border-border bg-bg-card hover:border-border-strong hover:bg-bg-card/70 transition-colors p-3"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded-sm text-[10px] font-medium uppercase tracking-wider ${color}`}
        >
          {label}
        </span>
        <p className="text-sm text-text leading-relaxed">{suggestion.preview}</p>
      </div>
    </button>
  );
}

function typeMeta(type: SuggestionType): { label: string; color: string } {
  switch (type) {
    case "question":
      return { label: "question", color: "bg-accent-blue/20 text-accent-blue" };
    case "talking_point":
      return { label: "talking point", color: "bg-accent-purple/20 text-accent-purple" };
    case "answer":
      return { label: "answer", color: "bg-accent-green/20 text-accent-green" };
    case "fact_check":
      return { label: "fact-check", color: "bg-accent-orange/20 text-accent-orange" };
    case "clarifying_info":
      return { label: "clarifying", color: "bg-text-muted/20 text-text-muted" };
  }
}