"""
POST /api/transcribe
Accepts an audio chunk (multipart/form-data) + the user's Groq key, forwards
to Whisper Large V3, returns transcribed text.
"""

from fastapi import APIRouter, File, Header, HTTPException, UploadFile

from ..groq_client import GroqError, transcribe_audio
from ..models import TranscribeResponse


router = APIRouter(prefix="/api", tags=["transcribe"])


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(..., description="Audio blob (webm/opus, mp3, wav...)."),
    authorization: str = Header(..., description="Bearer <user Groq API key>"),
) -> TranscribeResponse:
    """
    The user's Groq API key is taken from the Authorization header and
    forwarded to Groq. It is not logged or stored on the backend.
    """
    api_key = _extract_bearer(authorization)

    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file.")

    # Whisper enforces a max file size; Groq's current limit is ~25MB.
    # At webm/opus bitrates, 30s is well under, but we guard anyway.
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file too large (>25MB).")

    try:
        result = transcribe_audio(
            api_key=api_key,
            audio_bytes=audio_bytes,
            filename=file.filename or "audio.webm",
            content_type=file.content_type or "audio/webm",
        )
    except GroqError as e:
        status = e.status_code or 502
        raise HTTPException(status_code=status, detail=str(e))

    text = (result.get("text") or "").strip()
    return TranscribeResponse(text=text)


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