/**
 * Frontend API client for the TwinMind Copilot backend.
 *
 * All requests pass the user's Groq API key as a Bearer token. The key is
 * read from localStorage (via SettingsContext) at call sites — this file
 * never reads storage directly, so it stays easy to test and reason about.
 */

// Vite replaces import.meta.env.VITE_API_BASE at build time. For local dev
// we fall back to the FastAPI default.
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8000";


export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`API ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}


async function parseError(res: Response): Promise<never> {
  let detail = res.statusText;
  try {
    const body = await res.json();
    detail = body.detail ?? body.error ?? detail;
  } catch {
    // non-JSON body; keep statusText
  }
  throw new ApiError(res.status, detail);
}


// --- /api/health -------------------------------------------------------------

export type HealthResponse = {
  status: string;
  service: string;
  time: string;
};

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) return parseError(res);
  return res.json();
}


// --- /api/transcribe ---------------------------------------------------------

export type TranscribeResponse = {
  text: string;
  duration_s: number | null;
};

/**
 * Send an audio blob to the backend for transcription via Whisper Large V3.
 * The backend forwards the user's Groq key to Groq without logging it.
 */
export async function transcribeChunk(
  apiKey: string,
  blob: Blob,
): Promise<TranscribeResponse> {
  if (!apiKey) throw new ApiError(401, "Missing Groq API key.");

  const form = new FormData();
  // Prefer a .webm filename so Whisper's format detection has a useful hint.
  form.append("file", blob, "chunk.webm");

  const res = await fetch(`${API_BASE}/api/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // Do NOT set Content-Type — fetch will set it with the correct boundary.
    },
    body: form,
  });

  if (!res.ok) return parseError(res);
  return res.json();
}