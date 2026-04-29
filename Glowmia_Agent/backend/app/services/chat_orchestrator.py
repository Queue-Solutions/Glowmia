from app.core.config import settings
from app.models.chat import ChatMessage, ChatSession, Language
from app.repositories.session_store import SupabaseSessionStore
from app.schemas.chat import ChatMessageRequest, ChatResponse, DressCard, SessionCreateResponse
from app.services.intent_router import IntentRouter
from app.services.prompt_builder import build_chat_prompt, build_history, build_selected_dress_context, build_style_prompt, build_system_prompt
from app.services.recommendation_service import RecommendationService
from app.services.replicate_service import ReplicateService


ARABIC_COLOR_LABELS = {
    "black": "أسود",
    "white": "أبيض",
    "red": "أحمر",
    "green": "أخضر",
    "blue": "أزرق",
    "pink": "وردي",
    "gold": "ذهبي",
    "silver": "فضي",
    "burgundy": "عنابي",
    "cream": "أوف وايت",
    "blush": "وردي فاتح",
}


class ChatOrchestrator:
    def __init__(
        self,
        session_store: SupabaseSessionStore,
        intent_router: IntentRouter,
        recommendation_service: RecommendationService,
        replicate_service: ReplicateService,
    ) -> None:
        self.session_store = session_store
        self.intent_router = intent_router
        self.recommendation_service = recommendation_service
        self.replicate_service = replicate_service

    def create_session(self, language: Language) -> SessionCreateResponse:
        session = self.session_store.create(language)
        return SessionCreateResponse(session_id=session.id, language=session.language)

    def session_exists(self, session_id: str) -> bool:
        return self.session_store.exists(session_id)

    def _user_message_type(self, intent: str) -> str:
        mapping = {
            "recommend": "recommend_request",
            "styling": "styling_request",
            "edit": "edit_request",
            "chat": "chat_message",
        }
        return mapping.get(intent, "chat_message")

    def _assistant_message_type(self, tool: str) -> str:
        mapping = {
            "recommend": "recommend_result",
            "styling": "styling_response",
            "edit": "edit_result",
            "llm": "chat_response",
        }
        return mapping.get(tool, "chat_response")

    def _localized_color(self, color: str, language: Language) -> str:
        if language == "ar":
            return ARABIC_COLOR_LABELS.get(color, color)
        return color

    def _selected_dress_summary(self, session: ChatSession, language: Language) -> str | None:
        if not session.selected_dress_id:
            return None
        dress = self.recommendation_service.get_dress_by_id(session.selected_dress_id, language)
        if not dress:
            return None

        effective_color = session.current_color or dress.color
        parts = [dress.name]
        if effective_color:
            parts.append(f"{'اللون' if language == 'ar' else 'color'}: {effective_color}")
        if dress.style:
            parts.append(f"{'الستايل' if language == 'ar' else 'style'}: {dress.style}")
        if dress.occasion:
            parts.append(f"{'المناسبة' if language == 'ar' else 'occasion'}: {dress.occasion}")
        if dress.fabric:
            parts.append(f"{'القماش' if language == 'ar' else 'fabric'}: {dress.fabric}")
        if dress.sleeve_type:
            parts.append(f"{'نوع الأكمام' if language == 'ar' else 'sleeve type'}: {dress.sleeve_type}")
        if dress.length:
            parts.append(f"{'الطول' if language == 'ar' else 'length'}: {dress.length}")
        if session.current_image_url:
            if language == "ar":
                parts.append("الصورة الحالية المعتمدة هي آخر نسخة معدلة من الفستان.")
            else:
                parts.append("The current active image is the latest edited version of the dress.")
        return ", ".join(parts)

    def _current_selected_dress_color(self, session: ChatSession, language: Language) -> str | None:
        if session.current_color:
            return session.current_color
        if not session.selected_dress_id:
            return None
        dress = self.recommendation_service.get_dress_by_id(session.selected_dress_id, language)
        return dress.color if dress else None

    def _is_selected_dress_info_question(self, message: str, language: Language) -> bool:
        lowered = message.lower()
        if language == "ar":
            return any(
                token in message
                for token in [
                    "ما لون",
                    "ايه لون",
                    "إيه لون",
                    "ما هو لون",
                    "الفستان المختار",
                    "حالياً",
                    "حاليا",
                ]
            )
        return any(
            token in lowered
            for token in [
                "what color is this dress",
                "what color is the selected dress",
                "what is the current color",
                "what color is it now",
            ]
        )

    def _answer_selected_dress_info(self, session: ChatSession, language: Language) -> str | None:
        current_color = self._current_selected_dress_color(session, language)
        if not current_color:
            return None
        if language == "ar":
            return f"لون الفستان المختار حالياً هو {current_color}."
        return f"The currently selected dress is {current_color}."

    async def handle_message(self, payload: ChatMessageRequest) -> ChatResponse:
        session = self.session_store.get(payload.session_id)
        assert session is not None

        language = payload.language or session.language
        if payload.selected_dress_id:
            self.session_store.set_selected_dress(session.id, payload.selected_dress_id)
        if payload.selected_dress_image_url:
            self.session_store.set_current_image(session.id, payload.selected_dress_image_url)

        intent = await self.intent_router.detect_intent(
            payload.message,
            language,
            has_selected_dress=bool(payload.selected_dress_id or session.selected_dress_id),
        )
        parsed_data = self.recommendation_service.analyze_preferences(payload.message) if intent == "recommend" else None

        if intent == "edit":
            edit_filters = self.recommendation_service.analyze_preferences(payload.message).get("filters", {})
            if edit_filters.get("color"):
                self.session_store.set_current_color(session.id, self._localized_color(edit_filters["color"], language))

        self.session_store.append(
            session.id,
            ChatMessage(
                role="user",
                content=payload.message,
                message_type=self._user_message_type(intent),
                dress_id=payload.selected_dress_id,
                image_url=payload.selected_dress_image_url,
                parsed_data=parsed_data,
            ),
        )

        session = self.session_store.get(payload.session_id)
        assert session is not None

        try:
            if self._is_selected_dress_info_question(payload.message, language):
                direct_answer = self._answer_selected_dress_info(session, language)
                if direct_answer:
                    return self._response_base(session, "llm", "chat", language, direct_answer)
            if intent == "recommend":
                return self._handle_recommendation(session, payload.message, language)
            if intent == "styling":
                return await self._handle_styling(session, payload.message, language)
            if intent == "edit":
                return await self._handle_edit(session, payload, language)
            return await self._handle_chat(session, payload.message, language)
        except RuntimeError:
            fallback = (
                "I need the backend integrations configured before I can complete that request. Please check Supabase and Replicate settings."
                if language == "en"
                else "أحتاج إلى إعداد تكاملات الخادم أولاً لإكمال هذا الطلب. يرجى التحقق من إعدادات Supabase وReplicate."
            )
            return self._response_base(session, "llm", intent, language, fallback)

    def _response_base(
        self,
        session: ChatSession,
        tool: str,
        intent: str,
        language: Language,
        message: str,
        metadata: dict | None = None,
        parsed_data: dict | None = None,
        dress_id: str | None = None,
        image_url: str | None = None,
        edited_image_url: str | None = None,
    ) -> ChatResponse:
        self.session_store.append(
            session.id,
            ChatMessage(
                role="assistant",
                content=message,
                message_type=self._assistant_message_type(tool),
                dress_id=dress_id,
                image_url=image_url,
                edited_image_url=edited_image_url,
                metadata=metadata,
                parsed_data=parsed_data,
            ),
        )
        return ChatResponse(
            session_id=session.id,
            tool=tool,  # type: ignore[arg-type]
            intent=intent,  # type: ignore[arg-type]
            language=language,
            message=message,
            selected_dress_id=session.selected_dress_id,
        )

    def _handle_recommendation(self, session: ChatSession, message: str, language: Language) -> ChatResponse:
        dresses = self.recommendation_service.recommend(message, language)
        reply = (
            "هذه بعض الفساتين المناسبة من المجموعة الحالية. إذا أردتِ، أقدر أضيّق الترشيحات حسب اللون أو المناسبة أو القصة أو القماش."
            if language == "ar"
            else "Here are a few dress options from the current catalog. I can narrow them further by color, occasion, silhouette, or fabric if you'd like."
        )
        response = self._response_base(
            session,
            "recommend",
            "recommend",
            language,
            reply,
            metadata={"results": [dress.__dict__ for dress in dresses]},
            parsed_data=self.recommendation_service.analyze_preferences(message),
        )
        response.dresses = [DressCard(**dress.__dict__) for dress in dresses]
        return response

    async def _handle_styling(self, session: ChatSession, message: str, language: Language) -> ChatResponse:
        dress_context = build_selected_dress_context(language, self._selected_dress_summary(session, language))
        llm_reply = await self.replicate_service.generate_text(
            system_prompt=build_system_prompt(language),
            user_prompt=f"{build_style_prompt(language, message)}{dress_context}",
            history=build_history(session.messages, settings.conversation_window),
        )
        if language == "ar":
            llm_reply = await self.replicate_service.polish_arabic_text(llm_reply)
        return self._response_base(session, "styling", "styling", language, llm_reply)

    async def _handle_edit(self, session: ChatSession, payload: ChatMessageRequest, language: Language) -> ChatResponse:
        dress_image = payload.selected_dress_image_url or session.current_image_url
        if not dress_image:
            message = (
                "Please select a dress first so I can edit that same image."
                if language == "en"
                else "من فضلك اختاري فستاناً أولاً حتى أعدل نفس الصورة."
            )
            return self._response_base(session, "edit", "edit", language, message)

        edited_image_url = await self.replicate_service.edit_image(dress_image, payload.message, language)
        self.session_store.set_current_image(session.id, edited_image_url)
        message = (
            "I updated the selected dress image while keeping the same base dress."
            if language == "en"
            else "تم تعديل صورة الفستان المختار مع الحفاظ على نفس الفستان الأساسي."
        )
        response = self._response_base(
            session,
            "edit",
            "edit",
            language,
            message,
            dress_id=payload.selected_dress_id or session.selected_dress_id,
            image_url=dress_image,
            edited_image_url=edited_image_url,
        )
        response.edited_image_url = edited_image_url
        response.selected_dress_id = payload.selected_dress_id or session.selected_dress_id
        return response

    async def _handle_chat(self, session: ChatSession, message: str, language: Language) -> ChatResponse:
        dress_context = build_selected_dress_context(language, self._selected_dress_summary(session, language))
        llm_reply = await self.replicate_service.generate_text(
            system_prompt=build_system_prompt(language),
            user_prompt=f"{build_chat_prompt(language, message)}{dress_context}",
            history=build_history(session.messages, settings.conversation_window),
        )
        if language == "ar":
            llm_reply = await self.replicate_service.polish_arabic_text(llm_reply)
        return self._response_base(session, "llm", "chat", language, llm_reply)
