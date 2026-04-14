from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.chat_service import (
    create_session,
    get_session_messages,
    recommend_in_session,
    edit_in_session,
)

router = APIRouter(prefix="/chat", tags=["chat"])


class CreateSessionRequest(BaseModel):
    title: Optional[str] = None


class RecommendInSessionRequest(BaseModel):
    query: str


class EditInSessionRequest(BaseModel):
    dress_id: str
    image_url: str
    instruction: str


@router.post("/sessions")
def create_chat_session(request: CreateSessionRequest):
    try:
        session = create_session(title=request.title)
        return {
            "message": "Session created successfully",
            "session": session,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/messages")
def get_chat_session_messages(session_id: str):
    try:
        messages = get_session_messages(session_id)
        return {
            "session_id": session_id,
            "count": len(messages),
            "messages": messages,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/recommend")
def recommend_inside_session(session_id: str, request: RecommendInSessionRequest):
    try:
        result = recommend_in_session(
            session_id=session_id,
            query=request.query,
        )
        return {
            "session_id": session_id,
            **result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/edit")
def edit_inside_session(session_id: str, request: EditInSessionRequest):
    try:
        result = edit_in_session(
            session_id=session_id,
            dress_id=request.dress_id,
            original_image_url=request.image_url,
            instruction=request.instruction,
        )

        if result.get("error"):
            return {
                "session_id": session_id,
                **result,
            }

        return {
            "session_id": session_id,
            "message": "Dress edited successfully",
            **result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))