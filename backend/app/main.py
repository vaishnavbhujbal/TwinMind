from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from .routes import chat, suggestions, transcribe


app = FastAPI(
    title="TwinMind Copilot API",
    description="Backend for live meeting suggestions powered by Groq.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
    return {"message": "TwinMind Copilot API"}


# Register routers
app.include_router(transcribe.router)
app.include_router(suggestions.router)
app.include_router(chat.router)