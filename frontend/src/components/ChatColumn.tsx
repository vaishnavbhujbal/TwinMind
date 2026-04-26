import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useSession } from "../context/SessionContext";
import { useSettings } from "../context/SettingsContext";
import { renderMarkdown } from "../lib/markdown";
import type { ChatMessage } from "../types";

type ChatColumnProps = {
  isStreaming: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
};

export default function ChatColumn({
  isStreaming,
  error,
  onSend,
  onStop,
}: ChatColumnProps) {
  const { hasApiKey } = useSettings();
  const { chat } = useSession();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Chat follows the conventional bottom-anchored pattern: newest at the
  // bottom, auto-scroll to the latest message.
  // Because chat messages are append-only and grow both in count AND length
  // (streaming), we re-scroll on both triggers.
  const lastMessageLength = chat[chat.length - 1]?.content.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length, lastMessageLength]);

  const handleSendClick = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !hasApiKey) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const placeholder = !hasApiKey
    ? "Add your Groq API key in Settings to chat."
    : isStreaming
    ? "Waiting for response…"
    : "Ask anything…";

  return (
    <section className="flex flex-col h-full min-h-0 bg-bg-elevated">
      {/* Column header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold tracking-wider text-text-muted uppercase">
          3. Chat (Detailed Answers)
        </h2>
        <span className="text-xs text-text-faint uppercase tracking-wider">
          Session-only
        </span>
      </div>

      {/* Info card (only when the chat is empty) */}
      {chat.length === 0 && (
        <div className="flex-shrink-0 px-4 py-4 border-b border-border">
          <div className="rounded-md border border-border bg-bg-card px-3 py-3">
            <p className="text-xs text-text-muted leading-relaxed">
              Clicking a suggestion adds it to this chat and streams a detailed
              answer. You can also type questions directly.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-accent-orange/10">
          <p className="text-xs text-accent-orange">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
        {chat.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-text-faint text-center px-4">
              Click a suggestion or type a question below.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {chat.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {isStreaming && <StreamingIndicator />}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={!hasApiKey}
            rows={1}
            className="flex-1 px-3 py-2 rounded-md bg-bg-card border border-border text-sm text-text placeholder-text-faint outline-none focus:border-border-strong resize-none max-h-32"
            style={{ minHeight: "38px" }}
          />
          {isStreaming ? (
            <button
              onClick={onStop}
              className="px-4 py-2 rounded-md bg-accent-orange hover:bg-accent-orange/80 text-white text-sm font-medium transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSendClick}
              disabled={!hasApiKey || !input.trim()}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !hasApiKey || !input.trim()
                  ? "bg-bg-card text-text-faint cursor-not-allowed"
                  : "bg-accent-blue hover:bg-accent-blue/80 text-white"
              }`}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// --- Subcomponents ------------------------------------------------------------

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg px-3 py-2 bg-accent-blue/20 border border-accent-blue/30">
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </p>
          <div className="text-[10px] text-text-faint mt-1">
            {new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
    );
  }

  // Assistant: render markdown
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-lg px-3 py-2 bg-bg-card border border-border">
        <div
          className="text-sm text-text [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />
        <div className="text-[10px] text-text-faint mt-1">
          {new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-lg px-3 py-2 bg-bg-card border border-border">
        <div className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-text-faint animate-pulse" />
          <span
            className="w-1.5 h-1.5 rounded-full bg-text-faint animate-pulse"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-text-faint animate-pulse"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}