import { useCallback, useRef, useState } from "react";
import { streamChat, type ChatTurnApi } from "../lib/api";
import { useSettings } from "../context/SettingsContext";
import { useSession } from "../context/SessionContext";
import type { ChatMessage, Suggestion } from "../types";

type UseChatResult = {
  isStreaming: boolean;
  error: string | null;
  /** Free-form user message typed into the chat input. */
  sendMessage: (text: string) => Promise<void>;
  /** User clicked a live suggestion card; expand into a detailed answer. */
  expandSuggestion: (sug: Suggestion) => Promise<void>;
  /** Cancel the in-flight stream, if any. */
  stopStreaming: () => void;
};

/**
 * Convert raw Groq/backend error strings into user-friendly messages.
 * The most common failure on free-tier Groq is a 429 rate-limit error
 * with a JSON body — surface it as plain text the user can act on.
 */
function formatChatError(raw: string): string {
  const lower = raw.toLowerCase();

  // Rate limit (Groq free tier: 8K TPM on GPT-OSS 120B)
  if (lower.includes("rate limit") || lower.includes("429")) {
    // Try to extract the suggested wait time from Groq's message
    const waitMatch = raw.match(/try again in ([\d.]+)s/i);
    const waitSec = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) : null;
    return waitSec
      ? `Groq rate limit hit. Please wait ~${waitSec}s and try again.`
      : "Groq rate limit hit. Please wait ~30s and try again.";
  }

  // Auth failure
  if (lower.includes("401") || lower.includes("invalid api key") || lower.includes("missing groq")) {
    return "Invalid or missing Groq API key. Open Settings to update it.";
  }

  // Network / backend down
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Could not reach the backend. Check your connection.";
  }

  // Unknown — strip JSON noise but keep the original message
  if (raw.length > 200) {
    return raw.slice(0, 200) + "…";
  }
  return raw;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The user-facing content shown when a suggestion is clicked. This is what
 * the USER sees in the chat thread as their "message". It mirrors the
 * preview so the conversation history reads naturally.
 */
function userMessageForSuggestion(sug: Suggestion): string {
  return sug.preview;
}

/**
 * What we send to Groq as the "new user message" when expanding a suggestion.
 * Includes the preview AND the detail_seed so the model stays consistent
 * with what the card promised.
 */
function backendMessageForSuggestion(sug: Suggestion): string {
  return [
    `I clicked on a live suggestion of type "${sug.type}". Expand it for me.`,
    "",
    `Suggestion preview: ${sug.preview}`,
    `Angle / rationale: ${sug.detail_seed}`,
  ].join("\n");
}

export function useChat(): UseChatResult {
  const { settings, hasApiKey } = useSettings();
  const { transcriptText, chat, appendChat, updateChat } = useSession();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aborts the fetch if the user starts another message before the last finishes,
  // or stops streaming, or unmounts. One request in flight at a time.
  const abortRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  /**
   * Core streaming orchestration shared by both flows.
   *
   * @param userContent   The message as it should appear in the USER's chat bubble.
   * @param backendMessage The message text sent to the backend (may include extra context).
   * @param systemPrompt  Which prompt to use (detailed vs chat).
   * @param contextChars  Transcript window size in chars.
   * @param reasoning     Reasoning effort to request.
   * @param suggestionId  If this was triggered by a suggestion click, its id.
   */
  const runStream = useCallback(
    async (
      userContent: string,
      backendMessage: string,
      systemPrompt: string,
      contextChars: number,
      reasoning: "low" | "medium" | "high",
      suggestionId?: string,
    ) => {
      if (!hasApiKey) {
        setError("Add your Groq API key in Settings to use chat.");
        return;
      }
      if (!userContent.trim()) return;

      // Stop any previous in-flight request.
      stopStreaming();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setIsStreaming(true);

      // 1) Append the user's turn to the chat thread.
      const now = new Date().toISOString();
      const userMsg: ChatMessage = {
        id: makeId("msg"),
        created_at: now,
        role: "user",
        content: userContent,
        suggestion_id: suggestionId,
      };
      appendChat(userMsg);

      // 2) Append an empty assistant turn that we'll fill in token-by-token.
      const assistantId = makeId("msg");
      appendChat({
        id: assistantId,
        created_at: new Date().toISOString(),
        role: "assistant",
        content: "",
      });

      // 3) Build history for Groq (everything in chat BEFORE this turn).
      //    We don't include the just-appended empty assistant message.
      // take the last N turns to keep the context window manageable — for having the control over the information send 
      const MAX_HISTORY_TURNS = 5;
      const recentHistory = chat.slice(-MAX_HISTORY_TURNS);
      const historyForApi: ChatTurnApi[] = recentHistory.map((m) => ({
      role: m.role,
      content: m.content,
      }));

      // 4) Trim transcript to the configured window.
      const transcriptWindow = transcriptText.slice(-contextChars);

      // 5) Stream tokens into the assistant message.
      let acc = "";
      await streamChat({
        apiKey: settings.groq_api_key,
        transcript: transcriptWindow,
        history: historyForApi,
        message: backendMessage,
        prompt: systemPrompt,
        reasoningEffort: reasoning,
        signal: controller.signal,
        onToken: (token) => {
          acc += token;
          updateChat(assistantId, { content: acc });
        },
        onError: (msg) => {
        setError(formatChatError(msg));
        },
        onDone: () => {
          setIsStreaming(false);
          abortRef.current = null;
          // If we got zero tokens AND no error surfaced, mark the bubble so
          // users aren't left staring at an empty assistant message.
          if (acc.trim().length === 0) {
            updateChat(assistantId, {
              content: "_(No response received. Try again?)_",
            });
          }
        },
      });
    },
    [
      hasApiKey,
      stopStreaming,
      appendChat,
      updateChat,
      chat,
      transcriptText,
      settings.groq_api_key,
    ],
  );

  // --- Public API ----------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string) => {
      await runStream(
        text.trim(),
        text.trim(),
        settings.chat_prompt,
        settings.detailed_context_chars,
        settings.chat_effort,
      );
    },
    [
      runStream,
      settings.chat_prompt,
      settings.detailed_context_chars,
      settings.chat_effort,
    ],
  );

  const expandSuggestion = useCallback(
    async (sug: Suggestion) => {
      await runStream(
        userMessageForSuggestion(sug),
        backendMessageForSuggestion(sug),
        settings.detailed_prompt,
        settings.detailed_context_chars,
        settings.detailed_effort,
        sug.id,
      );
    },
    [
      runStream,
      settings.detailed_prompt,
      settings.detailed_context_chars,
      settings.detailed_effort,
    ],
  );

  return {
    isStreaming,
    error,
    sendMessage,
    expandSuggestion,
    stopStreaming,
  };
}