"""
Thin wrapper around the Groq API.

Design notes:
- The user's API key is passed per-call, never stored at module level.
- Chat completions are the normal JSON endpoint; streaming is exposed
  separately for the chat route later.
- Audio transcription uses multipart/form-data.
- We use the OpenAI-compatible /openai/v1 endpoint set — same shapes as OpenAI,
  which simplifies the integration.
"""

from typing import Optional, Iterator
import json
import requests


GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# Model IDs locked by the assignment spec.
MODEL_TRANSCRIPTION = "whisper-large-v3"
MODEL_CHAT = "openai/gpt-oss-120b"

# Request timeouts (seconds). Whisper can be slow on larger chunks.
TIMEOUT_TRANSCRIBE = 60
TIMEOUT_CHAT = 90


class GroqError(Exception):
    """Raised when Groq returns a non-2xx or the response is malformed."""

    def __init__(self, message: str, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _auth_header(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"}


# --- Transcription -----------------------------------------------------------

def transcribe_audio(
    api_key: str,
    audio_bytes: bytes,
    filename: str = "audio.webm",
    content_type: str = "audio/webm",
) -> dict:
    """
    Transcribe an audio blob using Whisper Large V3.

    Returns Groq's JSON response, typically:
        {"text": "...", "x_groq": {...}}
    """
    url = f"{GROQ_BASE_URL}/audio/transcriptions"

    files = {"file": (filename, audio_bytes, content_type)}
    data = {
        "model": MODEL_TRANSCRIPTION,
        # "verbose_json" could give us segments/timestamps, but we don't need
        # them for this app — plain JSON keeps responses small.
        "response_format": "json",
        "temperature": "0",
    }

    try:
        res = requests.post(
            url,
            headers=_auth_header(api_key),
            files=files,
            data=data,
            timeout=TIMEOUT_TRANSCRIBE,
        )
    except requests.RequestException as e:
        raise GroqError(f"Network error talking to Groq: {e}") from e

    if not res.ok:
        raise GroqError(
            f"Groq transcription failed: {res.text[:300]}",
            status_code=res.status_code,
        )

    try:
        return res.json()
    except ValueError as e:
        raise GroqError(f"Groq returned invalid JSON: {e}") from e


# --- Chat completions (non-streaming) ----------------------------------------

def chat_completion_json(
    api_key: str,
    system_prompt: str,
    user_content: str,
    reasoning_effort: str = "low",
    temperature: float = 0.4,
    json_mode: bool = True,
) -> str:
    """
    Call GPT-OSS 120B for a single completion. Used for live suggestions.

    Returns the raw string content from the assistant message. Caller is
    responsible for parsing (we request JSON mode when json_mode=True).
    """
    url = f"{GROQ_BASE_URL}/chat/completions"

    body: dict = {
        "model": MODEL_CHAT,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "reasoning_effort": reasoning_effort,
        "temperature": temperature,
        "stream": False,
    }

    if json_mode:
        body["response_format"] = {"type": "json_object"}

    try:
        res = requests.post(
            url,
            headers={**_auth_header(api_key), "Content-Type": "application/json"},
            json=body,
            timeout=TIMEOUT_CHAT,
        )
    except requests.RequestException as e:
        raise GroqError(f"Network error talking to Groq: {e}") from e

    if not res.ok:
        raise GroqError(
            f"Groq chat failed: {res.text[:300]}",
            status_code=res.status_code,
        )

    try:
        data = res.json()
        return data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError) as e:
        raise GroqError(f"Unexpected Groq response shape: {e}") from e


# --- Chat completions (streaming) --------------------------------------------


def chat_completion_stream(
    api_key: str,
    system_prompt: str,
    user_content: str,
    reasoning_effort: str = "medium",
    temperature: float = 0.5,
) -> Iterator[str]:
    """
    Streaming chat completion. Yields content tokens as they arrive.

    Used for the chat route and detailed suggestion expansions — first-token
    latency matters for UX.

    We decode the byte stream as UTF-8 explicitly. Passing decode_unicode=True
    to iter_lines() makes `requests` guess the encoding from response headers,
    and if Groq's SSE response doesn't include a charset it falls back to
    Latin-1, which mangles multi-byte UTF-8 characters (em dashes, curly
    quotes, bullets) into sequences like â≡≡ on the client.
    """
    url = f"{GROQ_BASE_URL}/chat/completions"

    body = {
        "model": MODEL_CHAT,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "reasoning_effort": reasoning_effort,
        "temperature": temperature,
        "stream": True,
    }

    try:
        res = requests.post(
            url,
            headers={**_auth_header(api_key), "Content-Type": "application/json"},
            json=body,
            timeout=TIMEOUT_CHAT,
            stream=True,
        )
    except requests.RequestException as e:
        raise GroqError(f"Network error talking to Groq: {e}") from e

    if not res.ok:
        body_text = res.text[:300]
        raise GroqError(f"Groq chat stream failed: {body_text}", status_code=res.status_code)

    # Iterate raw bytes and decode as UTF-8 ourselves. iter_lines() without
    # decode_unicode returns bytes; we split on \n and decode each line.
    for raw_line in res.iter_lines(decode_unicode=False):
        if not raw_line:
            continue

        try:
            line = raw_line.decode("utf-8")
        except UnicodeDecodeError:
            # Extremely rare (Groq always sends UTF-8), but don't kill the
            # stream if one chunk is malformed.
            continue

        if not line.startswith("data:"):
            continue

        payload = line[len("data:"):].strip()
        if payload == "[DONE]":
            return

        try:
            chunk = json.loads(payload)
            delta = chunk["choices"][0].get("delta", {})
            content = delta.get("content")
            if content:
                yield content
        except (ValueError, KeyError, IndexError):
            continue