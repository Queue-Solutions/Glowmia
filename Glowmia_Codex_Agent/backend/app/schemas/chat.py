from typing import Literal

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    language: Literal["en", "ar"] = "en"


class SessionCreateResponse(BaseModel):
    session_id: str
    language: Literal["en", "ar"]


class DressCard(BaseModel):
    id: str
    name: str
    color: str | None = None
    occasion: str | None = None
    style: str | None = None
    sleeve_type: str | None = None
    length: str | None = None
    fabric: str | None = None
    fit: str | None = None
    description: str | None = None
    image_url: str | None = None
    front_view_url: str | None = None
    back_view_url: str | None = None
    side_view_url: str | None = None
    cover_image_url: str | None = None


class ChatMessageRequest(BaseModel):
    session_id: str
    message: str = Field(min_length=1)
    language: Literal["en", "ar"] = "en"
    selected_dress_id: str | None = None
    selected_dress_image_url: str | None = None
    mode_hint: Literal["recommend", "edit", "styling", "chat"] | None = None


class ChatResponse(BaseModel):
    session_id: str
    tool: Literal["llm", "recommend", "edit", "styling"]
    intent: Literal["recommend", "styling", "edit", "chat"]
    language: Literal["en", "ar"]
    message: str
    dresses: list[DressCard] = Field(default_factory=list)
    edited_image_url: str | None = None
    selected_dress_id: str | None = None
