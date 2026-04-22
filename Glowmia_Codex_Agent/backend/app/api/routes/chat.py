from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_chat_orchestrator
from app.schemas.chat import (
    ChatMessageRequest,
    ChatResponse,
    SessionCreateRequest,
    SessionCreateResponse,
)
from app.services.chat_orchestrator import ChatOrchestrator

router = APIRouter()


@router.post("/sessions", response_model=SessionCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreateRequest,
    orchestrator: ChatOrchestrator = Depends(get_chat_orchestrator),
) -> SessionCreateResponse:
    return orchestrator.create_session(payload.language)


@router.post("/chat/message", response_model=ChatResponse)
async def send_message(
    payload: ChatMessageRequest,
    orchestrator: ChatOrchestrator = Depends(get_chat_orchestrator),
) -> ChatResponse:
    try:
        return await orchestrator.handle_message(payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
