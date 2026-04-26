import { useCallback, useState } from "react";
import { ApiError, getSuggestions } from "../lib/api";
import { useSettings } from "../context/SettingsContext";
import { useSession } from "../context/SessionContext";
import type { SuggestionBatch } from "../types";

type UseSuggestionsResult = {
  loading: boolean;
  error: string | null;
  /** Fetch a fresh batch using the current transcript + settings. */
  fetchSuggestions: () => Promise<void>;
};


function formatSuggestionsError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("429")) {
    const waitMatch = raw.match(/try again in ([\d.]+)s/i);
    const waitSec = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) : null;
    return waitSec
      ? `Groq rate limit hit. Auto-refresh paused — try again in ~${waitSec}s.`
      : "Groq rate limit hit. Try again in ~30s.";
  }
  if (lower.includes("401") || lower.includes("invalid api key")) {
    return "Invalid or missing Groq API key. Update it in Settings.";
  }
  return `Failed to get suggestions: ${raw.length > 200 ? raw.slice(0, 200) + "…" : raw}`;
}


function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useSuggestions(): UseSuggestionsResult {
  const { settings, hasApiKey } = useSettings();
  const { transcriptText, addBatch } = useSession();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!hasApiKey) {
      setError("Add your Groq API key in Settings to begin.");
      return;
    }

    // Use the trailing slice of the transcript configured by the user.
    const window = transcriptText.slice(-settings.suggestions_context_chars);

    if (window.trim().length < 40) {
      // Not enough signal yet — don't burn a Groq call on near-silence.
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await getSuggestions(
        settings.groq_api_key,
        window,
        settings.suggestions_prompt,
        settings.suggestions_effort,
      );

      const batch: SuggestionBatch = {
        id: makeId("batch"),
        created_at: new Date().toISOString(),
        suggestions: res.suggestions.map((s, idx) => ({
          id: `${makeId("sug")}_${idx}`,
          type: s.type,
          preview: s.preview,
          detail_seed: s.detail_seed,
        })),
      };

      addBatch(batch);
    } catch (e) {
    const msg = e instanceof ApiError ? e.detail : (e as Error).message;
    setError(formatSuggestionsError(msg));
    } finally {
      setLoading(false);
    }
  }, [
    hasApiKey,
    transcriptText,
    settings.suggestions_context_chars,
    settings.groq_api_key,
    settings.suggestions_prompt,
    settings.suggestions_effort,
    addBatch,
  ]);

  return { loading, error, fetchSuggestions };
}