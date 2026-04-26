import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import MicColumn from "./components/MicColumn";
import SuggestionsColumn from "./components/SuggestionsColumn";
import ChatColumn from "./components/ChatColumn";
import SettingsModal from "./components/SettingsModal";
import { useSettings } from "./context/SettingsContext";
import { useSession } from "./context/SessionContext";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useSuggestions } from "./hooks/useSuggestions";
import { useChat } from "./hooks/useChat";
import { ApiError, transcribeChunk } from "./lib/api";
import type { Suggestion } from "./types";
import { buildExport, downloadSessionJson } from "./lib/export";

/**
 * Decide whether a transcribed chunk carries real content worth appending.
 * Whisper tends to produce specific hallucinations on silence
 * ("Thank you.", "Thanks for watching.") — we filter those out client-side
 * so they don't pollute the transcript or trigger vacuous suggestions.
 */
const WHISPER_SILENCE_ARTIFACTS = new Set<string>([
  "thank you.",
  "thanks for watching.",
  "thanks for watching!",
  "thank you for watching.",
  "thank you very much.",
  "thanks.",
  "thank you.",
  "you.",
  "bye.",
  ".",
  "..",
  "...",
  "...!",
]);

function isSubstantive(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 15) return false;

  const lower = trimmed.toLowerCase();
  if (WHISPER_SILENCE_ARTIFACTS.has(lower)) return false;

  // All unique words ≤ 3 suggests noise like "hello hello hello" or
  // "yeah yeah yeah". 3+ unique words means something was actually said.
  const uniqueWords = new Set(lower.split(/\s+/).filter(Boolean));
  if (uniqueWords.size < 3) return false;

  return true;
}

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, hasApiKey } = useSettings();
  const { appendTranscript, transcript, batches, chat, sessionStartedAt } = useSession();

  // --- Transcription state ---------------------------------------------------
  const [transcribing, setTranscribing] = useState(0);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const pendingManualReloadRef = useRef<boolean>(false);
  const fetchSuggestionsRef = useRef<(() => Promise<void>) | null>(null);

  const handleChunk = useCallback(
    async (blob: Blob) => {
      if (!hasApiKey) {
        setTranscribeError("Add your Groq API key in Settings to begin.");
        pendingManualReloadRef.current = false;
        return;
      }
      setTranscribing((n) => n + 1);
      setTranscribeError(null);

      const wasManualReload = pendingManualReloadRef.current;
      pendingManualReloadRef.current = false;

      try {
      const { text } = await transcribeChunk(settings.groq_api_key, blob);
      if (text && isSubstantive(text)) appendTranscript(text);
      } catch (e) {
        const msg = e instanceof ApiError ? e.detail : (e as Error).message;
        setTranscribeError(`Transcription failed: ${msg}`);
      } finally {
        setTranscribing((n) => Math.max(0, n - 1));
        if (wasManualReload) {
          queueMicrotask(() => {
            void fetchSuggestionsRef.current?.();
          });
        }
      }
    },
    [hasApiKey, settings.groq_api_key, appendTranscript],
  );

  const {
    isRecording,
    error: recorderError,
    start,
    stop,
    flush,
  } = useAudioRecorder({
    onChunk: handleChunk,
    chunkMs: 30_000,
  });

  // --- Suggestions ----------------------------------------------------------
  const {
    loading: suggestionsLoading,
    error: suggestionsError,
    fetchSuggestions,
  } = useSuggestions();

  useEffect(() => {
    fetchSuggestionsRef.current = fetchSuggestions;
  }, [fetchSuggestions]);

  useEffect(() => {
    if (!isRecording) return;
    const ms = Math.max(10, settings.auto_refresh_seconds) * 1000;

    const id = window.setInterval(() => {
      pendingManualReloadRef.current = true;
      flush();
    }, ms);

    return () => window.clearInterval(id);
  }, [isRecording, settings.auto_refresh_seconds, flush]);

  const handleReload = useCallback(() => {
    if (!hasApiKey) return;
    if (isRecording) {
      pendingManualReloadRef.current = true;
      flush();
    } else {
      void fetchSuggestions();
    }
  }, [hasApiKey, isRecording, flush, fetchSuggestions]);

  const handleToggleMic = useCallback(() => {
    if (isRecording) stop();
    else void start();
  }, [isRecording, start, stop]);

  // --- Chat -----------------------------------------------------------------
  const {
    isStreaming: chatStreaming,
    error: chatError,
    sendMessage,
    expandSuggestion,
    stopStreaming: stopChatStreaming,
  } = useChat();

  const handleSuggestionClick = useCallback(
    (sug: Suggestion) => {
      void expandSuggestion(sug);
    },
    [expandSuggestion],
  );

  const handleChatSend = useCallback(
    (text: string) => {
      void sendMessage(text);
    },
    [sendMessage],
  );

  // --- Export (Step 8) ------------------------------------------------------
  // --- Export --------------------------------------------------------------


const handleExport = useCallback(() => {
  const data = buildExport({
    sessionStartedAt,
    transcript,
    batches,
    chat,
  });
  downloadSessionJson(data);
}, [sessionStartedAt, transcript, batches, chat]);

  return (
    <div className="h-screen flex flex-col bg-bg text-text">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onExport={handleExport}
      />

      {!hasApiKey && (
        <div className="px-6 py-2 bg-accent-orange/10 border-b border-accent-orange/30 text-accent-orange text-sm">
          No Groq API key set.{" "}
          <button
            onClick={() => setSettingsOpen(true)}
            className="underline hover:no-underline"
          >
            Add one in Settings
          </button>{" "}
          to begin.
        </div>
      )}

      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 grid-rows-[minmax(0,1fr)] overflow-hidden">
        <MicColumn
          isRecording={isRecording}
          transcribing={transcribing}
          recorderError={recorderError}
          transcribeError={transcribeError}
          onToggleMic={handleToggleMic}
        />
        <SuggestionsColumn
          loading={suggestionsLoading}
          error={suggestionsError}
          autoRefreshSeconds={settings.auto_refresh_seconds}
          autoRefreshActive={isRecording}
          onReload={handleReload}
          onSuggestionClick={handleSuggestionClick}
        />
        <ChatColumn
          isStreaming={chatStreaming}
          error={chatError}
          onSend={handleChatSend}
          onStop={stopChatStreaming}
        />
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;