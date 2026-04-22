# Glowmia Frontend Demo

Standalone demo frontend for testing the Glowmia backend API.

## Purpose

- Separate from the production backend handoff
- Replaceable later by the main website frontend
- Useful for validating chat, recommendations, and image editing flows

## Run

```bash
npm install
npm run dev
```

## Environment

Create `.env` with:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```
