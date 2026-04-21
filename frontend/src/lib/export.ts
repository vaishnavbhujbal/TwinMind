import type {
  ChatMessage,
  SuggestionBatch,
  TranscriptChunk,
} from "../types";

type ExportedTranscriptChunk = {
  timestamp: string;
  text: string;
};

type ExportedSuggestion = {
  type: string;
  preview: string;
  detail_seed: string;
};

type ExportedSuggestionBatch = {
  timestamp: string;
  suggestions: ExportedSuggestion[];
};

type ExportedChatMessage = {
  timestamp: string;
  role: "user" | "assistant";
  content: string;
  // If the message was triggered by a suggestion click, link it.
  from_suggestion?: {
    type: string;
    preview: string;
  };
};

export type SessionExport = {
  session_started_at: string;
  session_ended_at: string;
  transcript: ExportedTranscriptChunk[];
  suggestion_batches: ExportedSuggestionBatch[];
  chat: ExportedChatMessage[];
};

type BuildExportArgs = {
  sessionStartedAt: string;
  transcript: TranscriptChunk[];
  batches: SuggestionBatch[];
  chat: ChatMessage[];
};

/**
 * Build the export object from session state.
 *
 * Design choices:
 * - All timestamps are ISO 8601 UTC (stable across time zones, sortable).
 * - Transcript is emitted in chronological order (oldest -> newest),
 *   regardless of how it's displayed in the UI.
 * - Suggestion batches are also chronological, so graders can replay the
 *   progression.
 * - Chat user turns that originated from a suggestion click include a
 *   back-link to the suggestion, making the session self-explanatory.
 */
export function buildExport({
  sessionStartedAt,
  transcript,
  batches,
  chat,
}: BuildExportArgs): SessionExport {
  // Index suggestions by id for O(1) back-linking from chat turns.
  const suggestionById = new Map<string, { type: string; preview: string }>();
  for (const batch of batches) {
    for (const s of batch.suggestions) {
      suggestionById.set(s.id, { type: s.type, preview: s.preview });
    }
  }

  // Transcript: chronological (oldest -> newest).
  const orderedTranscript = [...transcript].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // Batches: chronological. State stores newest-first; re-sort for export.
  const orderedBatches = [...batches].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const now = new Date().toISOString();

  return {
    session_started_at: sessionStartedAt,
    session_ended_at: now,
    transcript: orderedTranscript.map((c) => ({
      timestamp: c.created_at,
      text: c.text,
    })),
    suggestion_batches: orderedBatches.map((batch) => ({
      timestamp: batch.created_at,
      suggestions: batch.suggestions.map((s) => ({
        type: s.type,
        preview: s.preview,
        detail_seed: s.detail_seed,
      })),
    })),
    chat: chat.map((m): ExportedChatMessage => {
      const row: ExportedChatMessage = {
        timestamp: m.created_at,
        role: m.role,
        content: m.content,
      };
      if (m.suggestion_id) {
        const s = suggestionById.get(m.suggestion_id);
        if (s) row.from_suggestion = s;
      }
      return row;
    }),
  };
}

/**
 * Trigger a browser download of the session JSON.
 * Filename uses the session start time so graders can save multiple sessions
 * without overwriting.
 */
export function downloadSessionJson(data: SessionExport): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  // Filename: twinmind-session-2026-04-20T19-03-00.json
  // (colons are invalid on Windows filenames; replace them.)
  const stamp = data.session_started_at.replace(/:/g, "-").replace(/\..*$/, "");
  const filename = `twinmind-session-${stamp}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}