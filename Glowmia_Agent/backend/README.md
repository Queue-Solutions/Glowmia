# Glowmia Backend

Production-oriented FastAPI backend for the Glowmia AI fashion assistant.

## Features

- Chat session creation and message handling
- Intent routing for recommendations, styling advice, and image editing
- Supabase-backed dress recommendations
- Replicate-backed LLM chat and image editing
- English and Arabic prompt handling
- Session memory stored behind a repository interface for future upgrades

## Run

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Environment

Copy `.env.example` into `.env` and add your real values.

## API

- `POST /api/v1/sessions`
- `POST /api/v1/chat/message`
- `GET /api/v1/health`
