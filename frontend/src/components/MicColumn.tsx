import { useSession } from "../context/SessionContext";
import { useSettings } from "../context/SettingsContext";

type MicColumnProps = {
  isRecording: boolean;
  transcribing: number;
  recorderError: string | null;
  transcribeError: string | null;
  onToggleMic: () => void;
};

export default function MicColumn({
  isRecording,
  transcribing,
  recorderError,
  transcribeError,
  onToggleMic,
}: MicColumnProps) {
  const { hasApiKey } = useSettings();
  const { transcript } = useSession();

  // Newest transcript first — matches the suggestions column ordering and
  // means the latest chunk is always visible at the top without needing to
  // scroll. Older chunks are accessible by scrolling down.
  const reversedTranscript = [...transcript].reverse();

  const statusLabel = isRecording
    ? transcribing > 0
      ? "Recording • Transcribing"
      : "Recording"
    : transcribing > 0
    ? "Transcribing"
    : "Idle";

  return (
    <section className="flex flex-col h-full min-h-0 border-r border-border bg-bg-elevated">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
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

      <div className="flex-shrink-0 px-4 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMic}
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

      {(recorderError || transcribeError) && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-accent-orange/10">
          <p className="text-xs text-accent-orange">
            {recorderError ?? transcribeError}
          </p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {transcript.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-text-faint">
              {isRecording
                ? "Listening… first chunk appears here."
                : "No transcript yet — start the mic."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transcribing > 0 && (
              <div className="text-xs text-text-faint italic">
                Transcribing latest chunk…
              </div>
            )}
            {reversedTranscript.map((chunk, idx) => (
              <div key={chunk.id} className="text-sm leading-relaxed">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-faint mb-0.5">
                  <span>
                    {new Date(chunk.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  {idx === 0 && (
                    <span className="px-1.5 py-0.5 rounded-sm bg-accent-blue/20 text-accent-blue">
                      Latest
                    </span>
                  )}
                </div>
                <div className="text-text">{chunk.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}