// Shared type definitions used across the app.

export type ReasoningEffort = "low" | "medium" | "high";

export type SuggestionType =
  | "question"
  | "talking_point"
  | "answer"
  | "fact_check"
  | "clarifying_info";

export type Suggestion = {
  id: string;
  type: SuggestionType;
  preview: string;
  detail_seed: string;
};

export type SuggestionBatch = {
  id: string;
  created_at: string; // ISO 8601
  suggestions: Suggestion[];
};

export type TranscriptChunk = {
  id: string;
  created_at: string; // ISO 8601
  text: string;
};

export type ChatMessage = {
  id: string;
  created_at: string;
  role: "user" | "assistant";
  content: string;
  // When set, this message was created by clicking a suggestion.
  suggestion_id?: string;
};

export type Settings = {
  groq_api_key: string;

  // Prompts
  suggestions_prompt: string;
  detailed_prompt: string;
  chat_prompt: string;

  // Context window sizes (in characters — simpler for users than tokens)
  suggestions_context_chars: number;
  detailed_context_chars: number;

  // Behavior
  auto_refresh_seconds: number;

  // Reasoning effort per call type
  suggestions_effort: ReasoningEffort;
  detailed_effort: ReasoningEffort;
  chat_effort: ReasoningEffort;
};