import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ChatMessage, SuggestionBatch, TranscriptChunk } from "../types";

type SessionContextValue = {
  // Transcript
  transcript: TranscriptChunk[];
  transcriptText: string; // joined, useful for prompts
  appendTranscript: (text: string) => void;

  // Suggestions (wired in Step 6)
  batches: SuggestionBatch[];
  addBatch: (batch: SuggestionBatch) => void;

  // Chat (wired in Step 7)
  chat: ChatMessage[];
  appendChat: (msg: ChatMessage) => void;
  updateChat: (id: string, patch: Partial<ChatMessage>) => void;

  // Session meta
  sessionStartedAt: string;
};

const SessionContext = createContext<SessionContextValue | null>(null);


function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}


export function SessionProvider({ children }: { children: ReactNode }) {
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([]);
  const [batches, setBatches] = useState<SuggestionBatch[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [sessionStartedAt] = useState<string>(() => new Date().toISOString());

  const appendTranscript = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscript((prev) => [
      ...prev,
      {
        id: makeId("tx"),
        created_at: new Date().toISOString(),
        text: clean,
      },
    ]);
  }, []);

  const addBatch = useCallback((batch: SuggestionBatch) => {
    // Newest batch first.
    setBatches((prev) => [batch, ...prev]);
  }, []);

  const appendChat = useCallback((msg: ChatMessage) => {
    setChat((prev) => [...prev, msg]);
  }, []);

  const updateChat = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setChat((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const transcriptText = useMemo(
    () => transcript.map((c) => c.text).join(" "),
    [transcript],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      transcript,
      transcriptText,
      appendTranscript,
      batches,
      addBatch,
      chat,
      appendChat,
      updateChat,
      sessionStartedAt,
    }),
    [
      transcript,
      transcriptText,
      appendTranscript,
      batches,
      addBatch,
      chat,
      appendChat,
      updateChat,
      sessionStartedAt,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}


export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}