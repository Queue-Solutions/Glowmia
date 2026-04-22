# Glowmia

Glowmia is split into two intentionally separate applications:

- `backend/` contains the production-oriented FastAPI service
- `frontend/` contains the standalone demo/testing client

This separation keeps the backend easy to hand off to another developer later for integration into the main website.

## Structure

```text
backend/
frontend/
```

## Next setup steps

1. Add your real keys and URLs into `backend/.env`.
2. Ensure your Supabase project contains a `dresses` table with the expected fields.
3. Install backend and frontend dependencies separately.
4. Start the backend first, then the frontend demo.
