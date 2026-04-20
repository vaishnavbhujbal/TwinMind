import { useEffect, useRef, useState } from "react";
import { useSession } from "../context/SessionContext";
import { useSettings } from "../context/SettingsContext";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { ApiError, transcribeChunk } from "../libs/api";

export default function MicColumn() {
  const { settings, hasApiKey } = useSettings();
  const { transcript, appendTranscript } = useSession();

  const [transcribing, setTranscribing] = useState(0); // in-flight count
  const [lastError, setLastError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Stable handler for each audio chunk emitted by the recorder.
  const handleChunk = async (blob: Blob) => {
    if (!hasApiKey) {
      setLastError("Add your Groq API key in Settings to begin.");
      return;
    }
    setTranscribing((n) => n + 1);
    setLastError(null);
    try {
      const { text } = await transcribeChunk(settings.groq_api_key, blob);
      if (text) appendTranscript(text);
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : (e as Error).message;
      setLastError(`Transcription failed: ${msg}`);
    } finally {
      setTranscribing((n) => Math.max(0, n - 1));
    }
  };

  const { isRecording, error: recorderError, start, stop } = useAudioRecorder({
    onChunk: handleChunk,
    chunkMs: 30_000,
  });

  // Auto-scroll transcript to the latest chunk
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length]);

  const toggleMic = () => {
    if (isRecording) stop();
    else start();
  };

  // Compose the header status badge
  const statusLabel = isRecording
    ? transcribing > 0
      ? "Recording • Transcribing"
      : "Recording"
    : transcribing > 0
    ? "Transcribing"
    : "Idle";

  return (
    <section className="flex flex-col h-full border-r border-border bg-bg-elevated">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold tracking-wider text-text-muted uppercase">
          1. Mic &amp; Transcript
        </h2>
        <span
          className={`text-xs uppercase tracking-wider ${
            isRecording ? "text-accent-green" : "text-text-faint"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Mic button + hint */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMic}
            disabled={!hasApiKey}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              !hasApiKey
                ? "bg-bg-card cursor-not-allowed"
                : isRecording
                ? "bg-red-600 hover:bg-red-500"
                : "bg-accent-blue hover:bg-accent-blue/80"
            }`}
          >
            {isRecording ? (
              <span className="w-3 h-3 bg-white rounded-sm" />
            ) : (
              <span className="w-3 h-3 rounded-full bg-white" />
            )}
          </button>
          <p className="text-sm text-text-muted">
            {!hasApiKey
              ? "Add your API key in Settings to enable the mic."
              : isRecording
              ? "Recording… a new chunk will be transcribed every ~30s."
              : "Click mic to start. Transcript appends every ~30s."}
          </p>
        </div>
      </div>

      {/* Errors */}
      {(lastError || recorderError) && (
        <div className="px-4 py-3 border-b border-border bg-accent-orange/10">
          <p className="text-xs text-accent-orange">
            {recorderError ?? lastError}
          </p>
        </div>
      )}

      {/* Transcript body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {transcript.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-text-faint">
              {isRecording
                ? "Listening… first chunk appears in ~30s."
                : "No transcript yet — start the mic."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transcript.map((chunk) => (
              <div key={chunk.id} className="text-sm leading-relaxed">
                <div className="text-[10px] uppercase tracking-wider text-text-faint mb-0.5">
                  {new Date(chunk.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </div>
                <div className="text-text">{chunk.text}</div>
              </div>
            ))}
            {transcribing > 0 && (
              <div className="text-xs text-text-faint italic">
                Transcribing latest chunk…
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}