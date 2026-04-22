from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

Language = Literal["en", "ar"]
ToolType = Literal["llm", "recommend", "edit", "styling"]
IntentType = Literal["recommend", "styling", "edit", "chat"]


@dataclass
class Dress:
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


@dataclass
class ChatMessage:
    role: Literal["system", "user", "assistant"]
    content: str
    message_type: str = "chat"
    dress_id: str | None = None
    image_url: str | None = None
    edited_image_url: str | None = None
    parsed_data: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ChatSession:
    language: Language
    id: str = field(default_factory=lambda: str(uuid4()))
    messages: list[ChatMessage] = field(default_factory=list)
    selected_dress_id: str | None = None
    current_image_url: str | None = None
    current_color: str | None = None
