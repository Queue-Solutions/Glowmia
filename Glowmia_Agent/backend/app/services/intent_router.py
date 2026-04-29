from app.models.chat import IntentType, Language
from app.services.prompt_builder import build_intent_prompt
from app.services.replicate_service import ReplicateService


VALID_INTENTS = {"recommend", "styling", "edit", "chat"}


class IntentRouter:
    def __init__(self, replicate_service: ReplicateService) -> None:
        self.replicate_service = replicate_service

    async def detect_intent(self, message: str, language: Language, has_selected_dress: bool = False) -> IntentType:
        prompt = build_intent_prompt(language, message, has_selected_dress=has_selected_dress)
        result = await self.replicate_service.generate_text(
            system_prompt=(
                "You classify fashion-assistant user intents. "
                "Choose exactly one label from: recommend, styling, edit, chat. "
                "Return only that single label with no punctuation, no explanation, and no extra words."
            ),
            user_prompt=prompt,
        )

        normalized = result.strip().lower()
        normalized = normalized.replace(".", "").replace(":", "").replace("-", " ").strip()

        if "\n" in normalized:
            normalized = normalized.splitlines()[0].strip()

        if " " in normalized:
            normalized = normalized.split()[0].strip()

        if normalized in VALID_INTENTS:
            return normalized  # type: ignore[return-value]

        return "chat"
