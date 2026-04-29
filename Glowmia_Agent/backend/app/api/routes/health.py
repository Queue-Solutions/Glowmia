import os

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    payload = {"status": "ok"}

    runtime_fingerprint = os.getenv("GLOWMIA_AGENT_BACKEND_FINGERPRINT", "").strip()
    backend_path = os.getenv("GLOWMIA_AGENT_BACKEND_PATH", "").strip()

    if runtime_fingerprint:
        payload["runtime_fingerprint"] = runtime_fingerprint

    if backend_path:
        payload["backend_path"] = backend_path

    return payload
