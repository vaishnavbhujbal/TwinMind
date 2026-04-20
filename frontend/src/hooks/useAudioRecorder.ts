import { useCallback, useEffect, useRef, useState } from "react";

type UseAudioRecorderOptions = {
  /** Called with a complete, standalone audio blob every `chunkMs` ms. */
  onChunk: (blob: Blob) => void;
  /** Chunk duration in milliseconds. Default: 30000 (30s). */
  chunkMs?: number;
};

type UseAudioRecorderResult = {
  isRecording: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Flush the current in-progress chunk immediately (used by manual Reload). */
  flush: () => void;
};

// Pick the best supported mime type. webm/opus is the safest cross-browser
// default; we fall back gracefully if the browser disagrees.
function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return "";
}


export function useAudioRecorder({
  onChunk,
  chunkMs = 30_000,
}: UseAudioRecorderOptions): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs (not state) — these don't need to trigger re-renders and need to be
  // read inside callbacks that were created earlier.
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");
  // Guard against the onstop handler firing after user stopped recording.
  const shouldContinueRef = useRef<boolean>(false);

  const clearChunkTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Starts a single "take" that records for chunkMs then stops. When onstop
  // fires we emit the blob and, if still recording, start the next take.
  const startTake = useCallback(() => {
    const stream = streamRef.current;
    const mime = mimeTypeRef.current;
    if (!stream) return;

    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const type = mime || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];

      // Skip empty / near-empty blobs (e.g., if recorder was stopped immediately)
      if (blob.size > 500) {
        onChunk(blob);
      }

      if (shouldContinueRef.current) {
        // Start the next take immediately.
        startTake();
      }
    };

    recorder.start();
    recorderRef.current = recorder;

    // Stop after chunkMs so onstop fires with a complete, standalone blob.
    timerRef.current = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, chunkMs);
  }, [chunkMs, onChunk]);

  const start = useCallback(async () => {
    setError(null);
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mimeTypeRef.current = pickMimeType();
      shouldContinueRef.current = true;
      setIsRecording(true);
      startTake();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not access microphone.";
      setError(msg);
      cleanupStream();
      setIsRecording(false);
    }
  }, [isRecording, startTake]);

  const stop = useCallback(() => {
    shouldContinueRef.current = false;
    clearChunkTimer();

    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    cleanupStream();
    setIsRecording(false);
  }, []);

  const flush = useCallback(() => {
    // Ends the current take early. onstop emits the blob, and because
    // shouldContinueRef is still true, the next take starts immediately.
    clearChunkTimer();
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") {
      rec.stop();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldContinueRef.current = false;
      clearChunkTimer();
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      cleanupStream();
    };
  }, []);

  return { isRecording, error, start, stop, flush };
}