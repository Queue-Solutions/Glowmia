from datetime import datetime, timezone
from uuid import uuid4

import httpx
from supabase import Client, create_client

from app.core.config import settings
from app.models.chat import ChatMessage, ChatSession, Language


class SupabaseSessionStore:
    def __init__(self) -> None:
        self._client: Client | None = None
        self._language_cache: dict[str, Language] = {}
        self._selected_dress_cache: dict[str, str | None] = {}
        self._current_image_cache: dict[str, str | None] = {}
        self._current_color_cache: dict[str, str | None] = {}

    def _get_client(self) -> Client:
        if self._client is None:
            if not settings.supabase_url or not settings.supabase_key:
                raise RuntimeError("Supabase credentials are not configured")
            self._client = create_client(settings.supabase_url, settings.supabase_key)
        return self._client

    def _reset_client(self) -> None:
        self._client = None

    def _run_with_reconnect(self, operation):
        last_error: Exception | None = None

        for attempt in range(2):
            client = self._get_client()
            try:
                return operation(client)
            except (httpx.HTTPError, OSError) as exc:
                last_error = exc
                self._reset_client()
                if attempt == 0:
                    continue
                break

        raise RuntimeError("Supabase session store is temporarily unavailable") from last_error

    def _infer_language_from_session_row(self, row: dict) -> Language:
        title = str(row.get("title") or "").strip()
        if any("\u0600" <= char <= "\u06FF" for char in title):
            return "ar"
        return "en"

    def create(self, language: Language) -> ChatSession:
        session_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        self._run_with_reconnect(lambda client: client.table("chat_sessions").insert(
            {
                "id": session_id,
                "title": "جلسة Glowmia" if language == "ar" else "Glowmia Session",
                "status": "active",
                "last_message_at": now,
            }
        ).execute())

        self._language_cache[session_id] = language
        self._selected_dress_cache[session_id] = None
        self._current_image_cache[session_id] = None
        self._current_color_cache[session_id] = None
        return ChatSession(id=session_id, language=language)

    def get(self, session_id: str) -> ChatSession | None:
        session_rows = self._run_with_reconnect(
            lambda client: client.table("chat_sessions").select("*").eq("id", session_id).limit(1).execute().data or []
        )
        if not session_rows:
            return None

        message_rows = (
            self._run_with_reconnect(
                lambda client: client.table("chat_messages")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=False)
                .limit(50)
                .execute()
                .data
                or []
            )
        )

        selected_dress_id = self._selected_dress_cache.get(session_id)
        if selected_dress_id is None:
            for row in reversed(message_rows):
                if row.get("dress_id"):
                    selected_dress_id = str(row["dress_id"])
                    break

        current_image_url = self._current_image_cache.get(session_id)
        if current_image_url is None:
            for row in reversed(message_rows):
                if row.get("edited_image_url"):
                    current_image_url = row.get("edited_image_url")
                    break
                if row.get("image_url"):
                    current_image_url = row.get("image_url")
                    break

        current_color = self._current_color_cache.get(session_id)
        language = self._language_cache.get(session_id) or self._infer_language_from_session_row(session_rows[0])
        self._language_cache[session_id] = language

        messages = [
            ChatMessage(
                role=row.get("role") or "assistant",
                content=row.get("text") or "",
                message_type=row.get("message_type") or "chat",
                dress_id=row.get("dress_id"),
                image_url=row.get("image_url"),
                edited_image_url=row.get("edited_image_url"),
                parsed_data=row.get("parsed_data"),
                metadata=row.get("metadata"),
            )
            for row in message_rows
        ]

        return ChatSession(
            id=session_id,
            language=language,
            messages=messages,
            selected_dress_id=selected_dress_id,
            current_image_url=current_image_url,
            current_color=current_color,
        )

    def exists(self, session_id: str) -> bool:
        response = self._run_with_reconnect(
            lambda client: client.table("chat_sessions").select("id").eq("id", session_id).limit(1).execute()
        )
        return bool(response.data)

    def append(self, session_id: str, message: ChatMessage) -> ChatSession:
        now = datetime.now(timezone.utc).isoformat()
        self._run_with_reconnect(lambda client: client.table("chat_messages").insert(
            {
                "session_id": session_id,
                "role": message.role,
                "message_type": message.message_type,
                "text": message.content or None,
                "dress_id": message.dress_id,
                "image_url": message.image_url,
                "edited_image_url": message.edited_image_url,
                "parsed_data": message.parsed_data,
                "metadata": message.metadata,
            }
        ).execute())
        self._run_with_reconnect(
            lambda client: client.table("chat_sessions").update({"updated_at": now, "last_message_at": now}).eq("id", session_id).execute()
        )

        session = self.get(session_id)
        assert session is not None
        return session

    def set_selected_dress(self, session_id: str, dress_id: str | None) -> ChatSession:
        self._selected_dress_cache[session_id] = dress_id
        session = self.get(session_id)
        assert session is not None
        session.selected_dress_id = dress_id
        return session

    def set_current_image(self, session_id: str, image_url: str | None) -> ChatSession:
        self._current_image_cache[session_id] = image_url
        session = self.get(session_id)
        assert session is not None
        session.current_image_url = image_url
        return session

    def set_current_color(self, session_id: str, color: str | None) -> ChatSession:
        self._current_color_cache[session_id] = color
        session = self.get(session_id)
        assert session is not None
        session.current_color = color
        return session
