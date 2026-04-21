"""
POST /api/chat
Streaming chat endpoint.

Used for two flows, both writing into the same session chat thread:
1. User clicks a live suggestion -> expansion with the "detailed" prompt.
2. User types into the chat input -> answer with the "chat" prompt.

The frontend chooses which prompt to send in the request body. The backend
doesn't know or care which flow triggered the call — it just forwards the
system prompt, the full transcript, and the chat history to Groq.

Response format: Server-Sent Events (SSE). Each token arrives as:
    data: {"token": "Hello"}
    data: {"token": " world"}
    data: [DONE]
"""

import json
from typing import Annotated, AsyncIterator, Literal

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..groq_client import GroqError, chat_completion_stream
from ..models import ReasoningEffort


router = APIRouter(prefix="/api", tags=["chat"])


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequestBody(BaseModel):
    transcript: str = Field(..., description="Meeting transcript context.")
    history: list[ChatTurn] = Field(
        default_factory=list,
        description="Prior turns in this session's chat thread.",
    )
    message: str = Field(..., description="The new user message to answer.")
    prompt: str = Field(
        ...,
        description="System prompt to use (detailed-answer or chat, per frontend).",
    )
    reasoning_effort: ReasoningEffort = "medium"


@router.post("/chat")
async def chat(
    body: ChatRequestBody,
    authorization: Annotated[str, Header(description="Bearer <user Groq API key>")],
) -> StreamingResponse:
    api_key = _extract_bearer(authorization)

    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Empty message.")

    user_content = _build_user_message(body)

    async def event_stream() -> AsyncIterator[str]:
        """
        Yields SSE-formatted chunks. Each data payload is a JSON object with
        a single "token" field, followed by a final "[DONE]" sentinel.
        Errors mid-stream are emitted as {"error": "..."} so the client can
        surface them cleanly.
        """
        try:
            for token in chat_completion_stream(
                api_key=api_key,
                system_prompt=body.prompt,
                user_content=user_content,
                reasoning_effort=body.reasoning_effort,
                temperature=0.5,
            ):
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
        except GroqError as e:
            err = json.dumps({"error": str(e)})
            yield f"data: {err}\n\n"
        except Exception as e:  # pragma: no cover — unexpected failure path
            err = json.dumps({"error": f"Unexpected backend error: {e}"})
            yield f"data: {err}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            # Disable proxy buffering so tokens arrive as soon as they're written.
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# --- Helpers -----------------------------------------------------------------

def _build_user_message(body: ChatRequestBody) -> str:
    """
    Compose the user-turn content for Groq. We flatten the transcript and
    chat history into one text block — the system prompt already tells the
    model how to interpret them.
    """
    parts: list[str] = []

    if body.transcript.strip():
        parts.append("MEETING TRANSCRIPT (so far):\n---\n" + body.transcript.strip() + "\n---")

    if body.history:
        lines = []
        for turn in body.history:
            role = "USER" if turn.role == "user" else "ASSISTANT"
            lines.append(f"[{role}] {turn.content}")
        parts.append("CHAT HISTORY (this session):\n" + "\n".join(lines))

    parts.append("NEW USER MESSAGE:\n" + body.message.strip())

    return "\n\n".join(parts)


def _extract_bearer(header_value: str) -> str:
    prefix = "Bearer "
    if not header_value.startswith(prefix):
        raise HTTPException(
            status_code=401,
            detail="Authorization header must be 'Bearer <groq-api-key>'.",
        )
    key = header_value[len(prefix):].strip()
    if not key:
        raise HTTPException(status_code=401, detail="Missing Groq API key.")
    return key