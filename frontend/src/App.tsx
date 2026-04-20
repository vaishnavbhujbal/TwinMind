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
import { ApiError, transcribeChunk } from "./libs/api";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, hasApiKey } = useSettings();
  const { appendTranscript } = useSession();

  // --- Transcription state ---------------------------------------------------
  const [transcribing, setTranscribing] = useState(0);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // Track whether the next chunk is a manual-reload flush so we can chain
  // the suggestions fetch AFTER the transcript appends (spec: "manually
  // updates transcript then suggestions").
  const pendingManualReloadRef = useRef<boolean>(false);

  // fetchSuggestions is defined below via useSuggestions(). A ref lets us
  // call the latest closure from inside handleChunk without recreating it.
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
        if (text) appendTranscript(text);
      } catch (e) {
        const msg = e instanceof ApiError ? e.detail : (e as Error).message;
        setTranscribeError(`Transcription failed: ${msg}`);
      } finally {
        setTranscribing((n) => Math.max(0, n - 1));
        if (wasManualReload) {
          // queueMicrotask lets React flush the transcript append before we
          // read transcriptText inside fetchSuggestions.
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

  // Keep the ref pointed at the latest fetchSuggestions closure.
  useEffect(() => {
    fetchSuggestionsRef.current = fetchSuggestions;
  }, [fetchSuggestions]);

  // Auto-refresh timer: while recording, flush the current take every N
  // seconds so transcript is current, and handleChunk will chain into
  // suggestions via the pendingManualReloadRef flag.
  useEffect(() => {
    if (!isRecording) return;
    const ms = Math.max(10, settings.auto_refresh_seconds) * 1000;

    const id = window.setInterval(() => {
      pendingManualReloadRef.current = true;
      flush();
    }, ms);

    return () => window.clearInterval(id);
  }, [isRecording, settings.auto_refresh_seconds, flush]);

  // --- Manual reload --------------------------------------------------------
  const handleReload = useCallback(() => {
    if (!hasApiKey) return;

    if (isRecording) {
      pendingManualReloadRef.current = true;
      flush();
    } else {
      void fetchSuggestions();
    }
  }, [hasApiKey, isRecording, flush, fetchSuggestions]);

  // --- Mic toggle -----------------------------------------------------------
  const handleToggleMic = useCallback(() => {
    if (isRecording) stop();
    else void start();
  }, [isRecording, start, stop]);

  // --- Suggestion click (Step 7 will wire to chat) --------------------------
  const handleSuggestionClick = useCallback(() => {
    console.log("suggestion clicked");
  }, []);

  // --- Export (Step 8) ------------------------------------------------------
  const handleExport = useCallback(() => {
    console.log("export session");
  }, []);

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
        <ChatColumn />
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;