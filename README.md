# TwinMind Copilot

Live meeting suggestions powered by Groq. Built for the TwinMind assignment.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS v3
- **Backend:** FastAPI (Python 3.12)
- **Models (via Groq):**
  - Whisper Large V3 — transcription
  - GPT-OSS 120B — live suggestions + chat
- **Deployment:** Vercel (frontend) + Railway (backend)

## Local development

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Paste your Groq API key in Settings to begin.

## Bring-your-own-key

The app does not ship a Groq API key. Users paste their own key in the Settings
modal. The key is stored only in their browser's localStorage and forwarded to
the backend per-request via `Authorization: Bearer` — never logged, never
persisted.

_More sections (prompt strategy, tradeoffs, architecture) added as the project
develops._