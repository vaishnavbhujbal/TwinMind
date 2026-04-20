"""
Pydantic schemas for request/response validation across the API.

Kept in one place so all endpoints reference the same types and FastAPI
auto-generates consistent OpenAPI docs.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field


# --- Shared types ------------------------------------------------------------

ReasoningEffort = Literal["low", "medium", "high"]

SuggestionType = Literal[
    "question",
    "talking_point",
    "answer",
    "fact_check",
    "clarifying_info",
]


# --- /api/transcribe ---------------------------------------------------------

class TranscribeResponse(BaseModel):
    text: str = Field(..., description="Transcribed text from the audio chunk.")
    duration_s: Optional[float] = Field(
        None, description="Duration of the audio in seconds, if reported by Whisper."
    )


# --- /api/suggestions --------------------------------------------------------

class Suggestion(BaseModel):
    type: SuggestionType
    preview: str
    detail_seed: str


class SuggestionsRequest(BaseModel):
    transcript: str = Field(..., description="Recent transcript text to generate suggestions from.")
    prompt: str = Field(..., description="System prompt to use (editable by user in settings).")
    reasoning_effort: ReasoningEffort = "low"


class SuggestionsResponse(BaseModel):
    suggestions: list[Suggestion]


# --- /api/chat ---------------------------------------------------------------

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    transcript: str
    history: list[ChatTurn] = Field(default_factory=list)
    message: str
    prompt: str
    reasoning_effort: ReasoningEffort = "medium"


# --- Errors ------------------------------------------------------------------

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None