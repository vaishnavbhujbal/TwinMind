"""
FastAPI app entry point.

Production-friendly CORS: reads allowed origins from an env var
ALLOWED_ORIGINS (comma-separated). Defaults to local dev origins so
running locally still works without configuration.
"""

import os
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import chat, suggestions, transcribe


def _parse_allowed_origins() -> list[str]:
    """
    Read CORS origins from env var. Format: comma-separated URLs.
    Example: "https://app.vercel.app,https://twinmind-copilot.vercel.app"

    Falls back to local dev origins so `uvicorn app.main:app` still
    works during development without setting any env var.
    """
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    if not raw:
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="TwinMind Copilot API",
    description="Backend for live meeting suggestions powered by Groq.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "twinmind-copilot-api",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/")
def root():
    return {"message": "TwinMind Copilot API. See /api/health."}


# Register routers
app.include_router(transcribe.router)
app.include_router(suggestions.router)
app.include_router(chat.router)