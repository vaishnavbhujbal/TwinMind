# TwinMind Copilot

A live meeting copilot that listens to your microphone, transcribes the conversation, and surfaces three context-aware suggestions every ~30 seconds. Click any suggestion to expand it into a detailed chat answer, or type your own questions while the meeting is happening.

Built as a take-home assignment for the TwinMind Full Stack / Prompt Engineer role.

## Live Demo

- **Deployed app**: https://twin-mind-two.vercel.app
- **Backend health check**: https://twinmind-production-a949.up.railway.app/api/health
- **Backend API docs**: https://twinmind-production-a949.up.railway.app/docs

The app uses BYOK (bring your own key) — you'll need a [Groq API key](https://console.groq.com/keys) to use it. Paste it in Settings; it's stored only in your browser's localStorage and forwarded per-request, never persisted on the backend.

## What it does

Open the app, paste your Groq key, click the mic, and start talking. After ~30 seconds you'll see your first transcript chunk in the left column and your first suggestion batch in the middle column. Each batch contains exactly 3 suggestions chosen from 5 types — question, talking_point, answer, fact_check, clarifying_info — picked by the model based on what's actually happening in the conversation.

Click any suggestion card and it appears in the chat (right column) as your message, with a streaming detailed answer appearing below. Or type your own free-form question into the chat at any time. Export the full session as JSON when you're done.

## Architecture

How the pieces fit together: the frontend (Vercel) owns all session state in memory. The user's API key lives in localStorage and is sent on every request via `Authorization: Bearer <key>`. The backend (Railway) is a stateless thin layer that validates requests and forwards to Groq — it never persists keys, transcripts, or chat history.

Audio is captured by the browser's MediaRecorder, chunked into 30-second WebM blobs, and uploaded to `/api/transcribe`. Returned text is appended to a shared transcript. Every ~30 seconds (configurable) or on manual reload, the latest transcript window goes to `/api/suggestions`, which calls GPT-OSS 120B with structured JSON output and returns exactly 3 suggestions. When the user clicks a suggestion or types a chat message, `/api/chat` streams a response back via Server-Sent Events.

### Why a real backend instead of calling Groq directly from the browser

Three reasons. First, Groq's CORS configuration on the streaming endpoint is finicky and sometimes drops the SSE response in browsers — having our own backend means we control CORS. Second, the spec lists "Full-stack engineering" as criterion #4, so having a real Python service with typed routes earns points the frontend-only approach wouldn't. Third, it gives us a single place to do server-side normalization — for example, the suggestions endpoint clamps responses to exactly 3 suggestions and validates types, so the model can't break the UI by returning 2 or 4.

The cost is one additional network hop per call (~50-100ms). Worth it for the reliability and architecture story.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind v3 | Standard, fast, type-safe. Vite for sub-second HMR. |
| Backend | FastAPI (Python 3.12) | Spec rewards full-stack; stateless Python wrapper around Groq is small but real. Async-friendly for SSE streaming. |
| Audio | MediaRecorder API (browser-native) | No third-party audio library. Stop-and-restart pattern produces standalone WebM files Whisper can ingest directly. |
| Streaming | Server-Sent Events (SSE) | Sub-1s first-token latency; simpler than WebSockets and works through any HTTP proxy. |
| Markdown rendering | ~100 lines of inline parsing, no library | Handles the cases our prompts produce (bold, italic, code, lists, headings, hr) without the bundle weight of `react-markdown`. |
| Hosting (frontend) | Vercel | Best-in-class for Vite static builds. |
| Hosting (backend) | Railway | Persistent server, no serverless cold starts, no streaming timeouts. SSE works without configuration tricks. |

## Setup (local dev)

### Prerequisites

- Node.js 18+
- Python 3.12
- A [Groq API key](https://console.groq.com/keys)

### Backend

```bash
cd backend
python -m venv venv

Windows
.\venv\Scripts\Activate.ps1

macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs on http://localhost:8000. Visit `/docs` for the auto-generated Swagger UI.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173. Open it in a browser, click Settings, paste your Groq key, click the mic.

### Environment variables

Both subprojects work without any env vars set (they have sensible localhost defaults). For custom configurations, see `backend/.env.example` and `frontend/.env.example`.

| Variable | Where | Default | Used for |
|---|---|---|---|
| `ALLOWED_ORIGINS` | Backend | `http://localhost:5173,http://127.0.0.1:5173` | CORS origins, comma-separated |
| `VITE_API_BASE` | Frontend (build-time) | `http://localhost:8000` | Backend URL the frontend calls |

## Prompt strategy

This is the core of the assignment, so I'll walk through the choices in detail.

### Three prompts for three jobs

The app has three distinct prompts, each editable in Settings:

1. **Live suggestions prompt** — given a recent transcript window, return exactly 3 suggestions as JSON.
2. **Detailed answer prompt** — given a clicked suggestion plus full transcript context, expand it into a substantive answer.
3. **Chat prompt** — given a typed user question plus full transcript and chat history, give a direct answer.

Different prompts because the jobs are genuinely different. Live suggestions need to be tactical, fast, and varied across types — the user has 2 seconds to glance at a card. A detailed answer needs to deliver substance with confidence framing. Chat needs to handle recall, analysis, general knowledge, and judgment in a conversational tone. Trying to use a single prompt for all three meant compromising on one to serve another.

### Live suggestions prompt — design choices

The prompt is structured as a four-step decision framework: triage → diagnose → pick mix → write previews. The framework is explicit because GPT-OSS 120B is a reasoning model — it benefits from being told *how to think*, not just what to produce.

**Step 0: Triage** — return an empty array if the transcript is non-substantive (filler, silence, repeated greetings). Empty is a valid output. This is paired with a client-side filter that drops Whisper hallucinations like "Thank you." and "Hello hello hello" before they enter the transcript at all. Two layers of defense against vacuous suggestions.

**Step 1: Diagnose** — read the last ~60 seconds. The prompt explicitly weights recency: a claim from the last 15 seconds is more important than one from 3 minutes ago. Without this nudge, the model treats the whole transcript window as equally fresh.

**Step 2: Pick the mix** — three suggestions from five types: question, talking_point, answer, fact_check, clarifying_info. The prompt forbids defaulting to three questions and forbids repeating a type unless context demands it.

**Step 3: Write previews** — apply the "useful delta" test. Each preview must give the user something they didn't already have. The prompt has explicit weak-vs-strong examples to teach by contrast — for instance:

> Weak: "Should we reassign top reps to enterprise accounts?"
> Strong: "Before deciding SMB vs enterprise, what actually caused the August losses? If it's pricing we have one problem; if it's service delivery we have a different one."

Five anti-patterns are forbidden explicitly: meta-instruction phrasing ("Consider asking about..."), restatement, leading questions, generic advice, platitudes.

**Cross-batch anti-repetition.** Each suggestions request includes the previews from the last two batches as a "do not repeat these" list. Without this the model would re-suggest similar fact-checks every batch as long as the relevant transcript stayed in the window. Six previews in the dedupe list (2 batches × 3) is enough signal without bloating the prompt.

**JSON mode + server-side normalization.** The Groq call uses `response_format: json_object`. The backend then validates the response and clamps to exactly 3 suggestions, validates types are in our enum, and pads with a fallback if fewer were returned. The model can't break the UI by returning malformed output.

### Detailed answer prompt — design choices

This expanded after observing two failure modes during testing.

**Failure 1: Restating the question as a header.** When the prompt said "give the likely answer", the model would emit `**Likely answer:**` as a labeled heading at the top of the response. Reasoning models treat all-caps section labels in the prompt as output templates. Fix: rewrite the prompt as content guidance ("open with the most likely answer") rather than templated structure ("LIKELY ANSWER: ..."), and explicitly forbid labeled headers.

**Failure 2: Generating more questions when the user clicked a "question" suggestion.** The original prompt said "give 2-3 follow-up questions" for the question type. But the user's intent when clicking a question card is "help me think through this question that I'm about to ask" — they want the likely answer first, then what to listen for, then optional follow-ups. Fix: rewrite the per-type guidance to lead with substance.

**Live-meeting framing.** The prompt opens with: "The user is in a live meeting RIGHT NOW. They have ~10 seconds to read your response before turning back to the conversation." This nudges the model toward concise, scannable prose instead of essay-style depth.

**Style rules.** No markdown headings, no horizontal rules, no labeled section titles, **bold** only mid-sentence for emphasis. Length target: 4-10 sentences.

### Chat prompt — design choices

**Question types.** The prompt declares the four kinds of questions it expects: recall ("what was said about X"), analysis ("what's the strongest counter-argument"), general knowledge ("how does X work"), and judgment ("should I push back"). Naming these explicitly helps the model shape its response style appropriately.

**Citation pattern.** When pulling from the transcript, the prompt instructs natural attribution: "Earlier in the meeting, you/they said..." instead of cold paraphrase. This makes the answer feel grounded.

**Fallback framing.** When the question can't be answered from the transcript: "This isn't in the transcript, but generally..." Explicit framing prevents the model from silently confabulating transcript content.

**Persona.** "Sound like a smart colleague whispering an answer in the user's ear during the meeting." This one line shifted the response style noticeably — less encyclopedic, more conversational.

### Parameter tuning per call

| Call | reasoning_effort | temperature | max_tokens |
|---|---|---|---|
| Suggestions (JSON) | low | 0.4 | 700 |
| Detailed answer (streaming) | medium | 0.5 | 1500 |
| Chat (streaming) | medium | 0.5 | 1500 |

`reasoning_effort: low` for suggestions because the prompt does the heavy lifting (the framework, the anti-patterns, the type definitions). Extra reasoning doesn't measurably improve output quality on this structured task, and latency is criterion #6 — the user is waiting on the auto-refresh tick.

`reasoning_effort: medium` for detailed answers and chat because these are synthesis tasks across the full transcript. Depth matters, and a 2-3 second response time is acceptable on a click.

`max_tokens` matters more than I initially realized. Without it, Groq's pre-flight rate-limit check assumes the model could output its full context (~32K tokens) and rejects requests with 429 even when actual usage is well under the per-minute cap. Setting `max_tokens: 1500` for chat and `700` for suggestions keeps the pre-flight estimate realistic.

`temperature` is tuned per task. `top_p` is left at default — tuning both controls of output diversity is redundant.

### Context windows

| Call | Default chars | Approx duration | Notes |
|---|---|---|---|
| Suggestions | 2,500 | ~4-5 minutes | Recent only — suggestions should react to the moment |
| Detailed / chat | 15,000 | ~25 minutes | Larger so chat can answer questions about earlier in the meeting |

Both editable in Settings — the spec listed them as separate user-editable fields. Sized to fit Groq free tier's TPM cap without forcing the model to drop relevant context for typical demo-length sessions.

### Anti-hallucination strategies

Three layers:

1. **Structured constraint on fact_check.** The prompt narrows fact_check to claims with verifiable specifics (numbers, dates, named entities). Don't pressure-test vague statements with fabricated counter-statistics.
2. **Explicit hedging guidance.** "When citing numbers, only do so if you're genuinely confident. Hedge clearly when uncertain ('approximately', 'industry estimates suggest'). Never fabricate specific figures."
3. **Transcript fallback framing.** When the answer isn't in the transcript, the model says so explicitly before falling back to general knowledge — instead of silently confabulating context.

These reduce but don't eliminate hallucination. It's an inherent LLM limitation.

## Engineering decisions and tradeoffs

### Audio chunking via stop-and-restart MediaRecorder

`MediaRecorder.start(timeslice)` produces fragments where only the first has a valid container header — subsequent fragments aren't standalone files Whisper can ingest. Instead, we stop the recorder every 30 seconds, process the complete WebM blob in `onstop`, and immediately start a new recorder on the same MediaStream. The ~50-100ms gap between takes is imperceptible for conversational speech.

### Newest-first transcript display

The spec says "auto-scrolls to the latest line" — we display newest-first instead. Same user outcome (latest always visible without effort), with three benefits: (1) no scroll logic needed, so no jitter from concurrent re-renders elsewhere on the page; (2) consistent ordering with the suggestions column; (3) eliminated a class of bugs from `scrollIntoView` fighting the user.

### Single SessionContext owns all session state

Considered separate hooks per data type (`useTranscript`, `useBatches`, `useChat`). Consolidated into one `SessionContext` because: transcript, suggestions, and chat are all session-scoped state read from multiple components simultaneously. A separate hook for "thing that wraps a state variable and an append function" would have been ceremony.

### Chat history capped at last 5 turns per request

Without a cap, every chat turn grows the request size linearly. By turn 4-5, a single request would exceed Groq free-tier's TPM cap and be rejected as "too large." Six turns ≈ 3 exchanges, enough conversational continuity for natural follow-ups while keeping request size constant.

### Lightweight markdown renderer

About 100 lines of inline parsing handles the cases the prompts actually produce: bold, italic, inline code, fenced code blocks, bullet lists, headings up to h4, horizontal rules, paragraph breaks. HTML is escaped first to prevent XSS. A full library (react-markdown + remark-gfm) would have added ~30KB and brought edge cases the prompts don't generate.

### Empty assistant bubble fallback

If a chat stream returns zero tokens (network drop, immediate rate limit), we update the assistant bubble to `_(No response received. Try again?)_` instead of leaving the user with an empty card. Small UX detail; large reliability signal.

### Settings collapsibility

Power-user settings (prompts, context windows, reasoning effort, auto-refresh interval) live under a collapsed "Advanced settings" section. The default collapsed state shows just the API key field. New users aren't overwhelmed; advanced users can tune freely. All defaults are hardcoded in `frontend/src/lib/defaults.ts` and editable; clicking "Reset to defaults" restores them while preserving the API key.

### Server-side suggestion normalization

Even with Groq's JSON mode, the model can technically return 2 or 4 suggestions, or use a type outside our enum. The backend's `/api/suggestions` route validates and clamps to exactly 3 suggestions with valid types, padding with a fallback if needed. The model can't break the UI by misbehaving.

## Known limitations

- **Free-tier rate limits.** Groq's free tier caps GPT-OSS 120B at a per-minute token budget. Heavy use (rapid suggestion clicks plus auto-refresh in the same minute) will hit this limit. The app handles 429s gracefully with a friendly "Groq rate limit hit. Try again in ~30s." message. Users on Groq Dev tier (300K TPM) won't see this issue.
- **No speaker diarization.** A single mic stream produces a single transcript without distinguishing speakers. A production version with platform integration (Zoom, Meet) could expose per-speaker channels and tune suggestions per role (defenses when the user is presenting, sharper questions when listening).
- **Hallucination in fact-checks.** The prompt narrows fact_check to verifiable claims and instructs the model to hedge when uncertain, but the model can still cite specific statistics confidently from training data without verification. This is an inherent LLM limitation.
- **No transcript summarization for long meetings.** The detailed-answer context is a rolling window. For meetings longer than ~25 minutes, chat answers may lose access to early-meeting context. A production version would summarize older transcript and prepend the summary to the recent window.
- **Tab backgrounding may delay suggestions.** Browsers throttle `setInterval` when a tab isn't focused. Suggestions may arrive late if the user switches tabs during recording.

## End-to-end data flow (single 30s cycle)

1. User clicks mic → `useAudioRecorder.start()` calls `getUserMedia({audio: true})` and creates a `MediaRecorder`.
2. After 30s, `recorder.stop()` fires `onstop` with a complete WebM blob. A new recorder starts immediately.
3. `App.tsx`'s `handleChunk` callback receives the blob, calls `transcribeChunk(apiKey, blob)`.
4. `lib/api.ts` POSTs the blob as multipart/form-data to `/api/transcribe`.
5. Backend's `routes/transcribe.py` validates auth, calls `groq_client.transcribe_audio()` which posts to Groq's Whisper endpoint.
6. Returned text goes through `isSubstantive()` filter (drops Whisper hallucinations on silence), then is appended to `SessionContext.transcript`.
7. Auto-refresh timer fires every 30s. It calls `flush()` on the recorder to end the current take early, ensuring the latest audio is transcribed before the next suggestions call.
8. Once the in-flight transcription completes, `useSuggestions.fetchSuggestions()` runs: slices the last 2,500 chars of transcript, collects the last 2 batches' previews for anti-repetition, POSTs to `/api/suggestions`.
9. Backend calls Groq with `response_format: json_object` and `reasoning_effort: low`. Response is parsed and clamped to exactly 3 valid suggestions.
10. Frontend prepends the new batch to `SessionContext.batches`. `SuggestionsColumn` re-renders with the newest batch at the top.
11. User clicks a suggestion card → `useChat.expandSuggestion(sug)` runs.
12. The preview becomes the user's chat bubble. An empty assistant bubble appears below it.
13. `streamChat()` POSTs to `/api/chat` with the detailed prompt, the last 15,000 chars of transcript, the last 5 chat turns, and the suggestion's preview + detail_seed.
14. Backend's `routes/chat.py` opens an SSE stream, calls `chat_completion_stream()` which streams Groq tokens as `data: {"token": "..."}\n\n` frames.
15. Frontend's SSE reader parses each frame, calls `onToken` per token. `useChat` accumulates and `updateChat()`s the assistant message — the UI re-renders progressively as text streams in.
16. Markdown is rendered inline by `lib/markdown.ts` on each update.
17. When Groq is done, the backend emits `data: [DONE]\n\n` and closes the stream.

First-token latency in production: ~400ms.


## Links

- Live app: https://twin-mind-two.vercel.app
- Repository: https://github.com/vaishnavbhujbal/TwinMind