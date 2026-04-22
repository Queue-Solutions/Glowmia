from app.models.chat import IntentType, Language
from app.services.prompt_builder import build_intent_prompt
from app.services.replicate_service import ReplicateService


class IntentRouter:
    def __init__(self, replicate_service: ReplicateService) -> None:
        self.replicate_service = replicate_service

    async def detect_intent(self, message: str, language: Language) -> IntentType:
        lowered = message.lower()

        english_recommend = ["recommend", "suggest", "show me", "find me", "dress for", "looking for a dress"]
        english_info = [
            "what color is this dress",
            "what color is the selected dress",
            "what is the color of this dress",
            "what is the current color",
            "what color is it now",
            "is it green now",
            "is it blue now",
            "is it red now",
        ]
        english_styling = ["style", "wear with", "match", "accessories", "how do i style", "how to style", "shoe color", "what shoes"]
        english_edit = [
            "edit",
            "change the dress",
            "modify the dress",
            "change color",
            "change sleeves",
            "make it",
            "turn it",
            "close the neckline",
            "open the slit",
            "add sleeves",
            "remove sleeves",
        ]

        arabic_recommend = ["اقترح", "ترشيح", "فستان", "فساتين", "فساتين مناسبة", "أريد فستان", "أبغى فستان", "عايزة فستان", "عاوزه فستان"]
        arabic_info = [
            "ما لون",
            "ايه لون",
            "إيه لون",
            "ما هو لون",
            "ماهي لون",
            "ما لون الفستان",
            "ما لون الفستان المختار",
            "ما لون الفستان حاليا",
            "ما لون الفستان حالياً",
            "الفستان المختار حاليا",
            "الفستان المختار حالياً",
        ]
        arabic_styling = ["نسق", "تنسيق", "ألبس معه", "اكسسوارات", "إكسسوارات", "ستايل", "أنسق", "يلبق معه", "لون حذاء", "حذاء"]
        arabic_edit = [
            "عدلي",
            "عدل",
            "عدّل",
            "غير",
            "غيّر",
            "تعديل الصورة",
            "غيّر اللون",
            "غيري اللون",
            "عدلي الفستان",
            "خليه",
            "خلّيه",
            "خليها",
            "خلّيها",
            "اقفلي",
            "افتحي",
            "افتح",
            "قفلي",
            "غيّريه",
            "غيريه",
            "زوّدي",
            "ضيفي",
            "أضيفي",
        ]

        if any(token in lowered for token in english_info):
            return "chat"
        if any(token in lowered for token in english_recommend):
            return "recommend"
        if any(token in lowered for token in english_edit):
            return "edit"
        if any(token in lowered for token in english_styling):
            return "styling"

        if any(token in message for token in arabic_info):
            return "chat"
        if any(token in message for token in arabic_recommend):
            return "recommend"
        if any(token in message for token in arabic_edit):
            return "edit"
        if any(token in message for token in arabic_styling):
            return "styling"

        prompt = build_intent_prompt(language, message)
        result = await self.replicate_service.generate_text(
            system_prompt=(
                "You classify fashion-assistant user intents. "
                "Return exactly one token: recommend, styling, edit, or chat."
            ),
            user_prompt=prompt,
        )
        normalized = result.strip().lower()
        if normalized in {"recommend", "styling", "edit", "chat"}:
            return normalized  # type: ignore[return-value]
        return "chat"
