"""
POST /api/suggestions
Given a transcript window, return exactly 3 useful, context-aware suggestions.

Design notes:
- We enforce JSON mode on Groq to eliminate parse failures.
- If the model returns fewer/more than 3 items, we clamp and pad so the
  frontend always gets exactly 3 (spec requirement: "exactly 3 fresh
  suggestions"). This is a belt-and-suspenders safeguard on top of the prompt.
- If the transcript is too short to be useful (< ~40 chars), we refuse early
  so we don't burn a Groq call generating nonsense from silence.
"""

import json
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..groq_client import GroqError, chat_completion_json
from ..models import ReasoningEffort, Suggestion, SuggestionType


router = APIRouter(prefix="/api", tags=["suggestions"])


class SuggestionsRequestBody(BaseModel):
    transcript: str
    prompt: str
    reasoning_effort: ReasoningEffort = "low"


class SuggestionsResponseBody(BaseModel):
    suggestions: list[Suggestion]


# Minimum transcript length (characters) before we'll bother generating.
# Below this, the model has nothing meaningful to work with.
MIN_TRANSCRIPT_CHARS = 40

# Valid suggestion types; anything else from the model falls back to "question".
VALID_TYPES: set[str] = {
    "question",
    "talking_point",
    "answer",
    "fact_check",
    "clarifying_info",
}


@router.post("/suggestions", response_model=SuggestionsResponseBody)
async def suggestions(
    body: SuggestionsRequestBody,
    authorization: Annotated[str, Header(description="Bearer <user Groq API key>")],
) -> SuggestionsResponseBody:
    api_key = _extract_bearer(authorization)

    transcript = body.transcript.strip()
    if len(transcript) < MIN_TRANSCRIPT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Transcript too short ({len(transcript)} chars). Keep talking.",
        )

    user_content = _build_user_message(transcript)

    try:
        raw = chat_completion_json(
            api_key=api_key,
            system_prompt=body.prompt,
            user_content=user_content,
            reasoning_effort=body.reasoning_effort,
            temperature=0.4,
            json_mode=True,
        )
    except GroqError as e:
        status = e.status_code or 502
        raise HTTPException(status_code=status, detail=str(e))

    suggestions_list = _parse_and_normalize(raw)
    return SuggestionsResponseBody(suggestions=suggestions_list)


# --- Helpers -----------------------------------------------------------------

def _build_user_message(transcript: str) -> str:
    """
    The user-turn content. Kept separate from the system prompt so the
    user-editable 'prompt' field stays focused on instructions, not data.
    """
    return (
        "TRANSCRIPT (most recent conversation, verbatim):\n"
        "---\n"
        f"{transcript}\n"
        "---\n\n"
        "Generate EXACTLY 3 suggestions as specified. Return only the JSON "
        "object — no preamble, no markdown fences."
    )


def _parse_and_normalize(raw: str) -> list[Suggestion]:
    """
    Parse Groq's JSON response and coerce it into exactly 3 valid Suggestions.
    Tolerates minor formatting issues rather than failing the whole request.
    """
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Model returned invalid JSON: {e}",
        )

    items = data.get("suggestions")
    if not isinstance(items, list):
        raise HTTPException(
            status_code=502,
            detail="Model JSON missing 'suggestions' list.",
        )

    normalized: list[Suggestion] = []
    for item in items[:3]:
        if not isinstance(item, dict):
            continue

        raw_type = str(item.get("type", "")).strip().lower()
        stype: SuggestionType = (
            raw_type if raw_type in VALID_TYPES else "question"
        )  # type: ignore[assignment]

        preview = str(item.get("preview", "")).strip()
        seed = str(item.get("detail_seed", "")).strip()

        if not preview:
            continue

        normalized.append(
            Suggestion(type=stype, preview=preview, detail_seed=seed or preview)
        )

    # Pad if the model returned fewer than 3 (rare with JSON mode, but safe).
    while len(normalized) < 3:
        normalized.append(
            Suggestion(
                type="question",
                preview="Could you say more about that?",
                detail_seed="Open-ended follow-up placeholder.",
            )
        )

    return normalized[:3]


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