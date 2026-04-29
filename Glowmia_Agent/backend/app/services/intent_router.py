import re
import unicodedata

from app.core.logging import get_logger
from app.models.chat import IntentType, Language
from app.services.prompt_builder import build_intent_prompt
from app.services.replicate_service import ReplicateService


logger = get_logger(__name__)

VALID_INTENTS = {"recommend", "styling", "edit", "chat"}

STYLING_TERMS = (
    "style this",
    "how should i style",
    "what goes with",
    "what color shoes",
    "what shoes",
    "which shoes",
    "what bag",
    "which bag",
    "accessories",
    "jewelry",
    "heels",
    "shoes",
    "bag",
    "pair with",
    "match with",
    "matches with",
    "\u064a\u0644\u064a\u0642",
    "\u064a\u0646\u0627\u0633\u0628",
    "\u064a\u0644\u0628\u0642",
    "\u062c\u0632\u0645\u0647",
    "\u062d\u0630\u0627\u0621",
    "\u0643\u0639\u0628",
    "\u0634\u0646\u0637\u0647",
    "\u062d\u0642\u064a\u0628\u0647",
    "\u0627\u0643\u0633\u0633\u0648\u0627\u0631",
    "\u0625\u0643\u0633\u0633\u0648\u0627\u0631",
    "\u0627\u0643\u0633\u0633\u0648\u0627\u0631\u0627\u062a",
    "\u0625\u0643\u0633\u0633\u0648\u0627\u0631\u0627\u062a",
    "\u0645\u062c\u0648\u0647\u0631\u0627\u062a",
    "\u0646\u0633\u0642",
    "\u0646\u0633\u0642\u064a",
    "\u064a\u0646\u0641\u0639 \u0645\u0639",
)

RECOMMEND_TERMS = (
    "recommend",
    "show me",
    "looking for",
    "i need a dress",
    "suggest",
    "dress for",
    "\u0627\u0639\u0631\u0636\u064a",
    "\u0627\u0642\u062a\u0631\u062d\u064a",
    "\u0627\u0631\u064a\u062f \u0641\u0633\u062a\u0627\u0646",
    "\u0627\u0628\u063a\u0649 \u0641\u0633\u062a\u0627\u0646",
    "\u0627\u0628\u063a\u064a \u0641\u0633\u062a\u0627\u0646",
    "\u0639\u0627\u064a\u0632 \u0641\u0633\u062a\u0627\u0646",
    "\u0639\u0627\u064a\u0632\u0647 \u0641\u0633\u062a\u0627\u0646",
    "\u0639\u0627\u0648\u0632 \u0641\u0633\u062a\u0627\u0646",
    "\u0639\u0627\u0648\u0632\u0647 \u0641\u0633\u062a\u0627\u0646",
    "\u0647\u0627\u062a\u0644\u064a \u0641\u0633\u062a\u0627\u0646",
    "\u0648\u0631\u064a\u0646\u064a \u0641\u0633\u062a\u0627\u0646",
    "\u0645\u062d\u062a\u0627\u062c \u0641\u0633\u062a\u0627\u0646",
)

RECOMMEND_REQUEST_VERBS = (
    "\u0627\u0631\u064a\u062f",
    "\u0627\u0628\u063a\u0649",
    "\u0627\u0628\u063a\u064a",
    "\u0639\u0627\u064a\u0632",
    "\u0639\u0627\u064a\u0632\u0647",
    "\u0639\u0627\u0648\u0632",
    "\u0639\u0627\u0648\u0632\u0647",
    "\u0647\u0627\u062a\u0644\u064a",
    "\u0648\u0631\u064a\u0646\u064a",
    "\u0645\u062d\u062a\u0627\u062c",
    "recommend",
    "show me",
    "suggest",
)

EDIT_TERMS = (
    "edit",
    "modify",
    "retouch",
    "change the",
    "change this",
    "change that",
    "make it",
    "turn it",
    "add ",
    "remove ",
    "replace ",
    "swap ",
    "shorten",
    "lengthen",
    "adjust",
    "\u0639\u062f\u0644",
    "\u0639\u062f\u0644\u064a",
    "\u063a\u064a\u0631",
    "\u063a\u064a\u0631\u064a",
    "\u062e\u0644\u064a\u0647",
    "\u062e\u0644\u064a\u0647\u0627",
    "\u0636\u064a\u0641",
    "\u0627\u0636\u064a\u0641",
    "\u0634\u064a\u0644",
)


def _normalize_message(message: str) -> str:
    normalized = unicodedata.normalize("NFKC", message).lower()
    normalized = re.sub(r"[\u064b-\u065f\u0670\u06d6-\u06ed]", "", normalized)

    replacements = {
        "\u0623": "\u0627",
        "\u0625": "\u0627",
        "\u0622": "\u0627",
        "\u0649": "\u064a",
        "\u0629": "\u0647",
        "\u0624": "\u0648",
        "\u0626": "\u064a",
    }

    for source, target in replacements.items():
        normalized = normalized.replace(source, target)

    normalized = re.sub(r"[^\w\s\u0600-\u06ff]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _contains_any(normalized_message: str, terms: tuple[str, ...]) -> bool:
    return any(term in normalized_message for term in terms)


def _has_dress_token(normalized_message: str) -> bool:
    tokens = normalized_message.split()
    return any(token == "\u0641\u0633\u062a\u0627\u0646" or token.startswith("\u0641\u0633\u062a\u0627\u0646") for token in tokens)


def _looks_like_catalog_request(normalized_message: str) -> bool:
    if not _has_dress_token(normalized_message):
        return False

    tokens = normalized_message.split()
    has_request_verb = _contains_any(normalized_message, RECOMMEND_REQUEST_VERBS)

    if has_request_verb:
        return True

    return len(tokens) <= 3


class IntentRouter:
    def __init__(self, replicate_service: ReplicateService) -> None:
        self.replicate_service = replicate_service

    async def detect_intent(self, message: str, language: Language, has_selected_dress: bool = False) -> IntentType:
        normalized_message = _normalize_message(message)
        rule_intent: str | None = None
        llm_intent: str | None = None

        if has_selected_dress and _contains_any(normalized_message, EDIT_TERMS):
            rule_intent = "edit"
        elif _contains_any(normalized_message, STYLING_TERMS):
            rule_intent = "styling"
        elif _contains_any(normalized_message, RECOMMEND_TERMS) or _looks_like_catalog_request(normalized_message):
            rule_intent = "recommend"

        if rule_intent:
            logger.info(
                "Intent router selected rule intent | normalized='%s' | rule_intent=%s | final_intent=%s",
                normalized_message,
                rule_intent,
                rule_intent,
            )
            return rule_intent  # type: ignore[return-value]

        prompt = build_intent_prompt(language, message, has_selected_dress=has_selected_dress)
        result = await self.replicate_service.generate_text(
            system_prompt=(
                "You classify fashion-assistant user intents. "
                "Choose exactly one label from: recommend, styling, edit, chat. "
                "Return only that single label with no punctuation, no explanation, and no extra words."
            ),
            user_prompt=prompt,
        )

        normalized_result = result.strip().lower()
        normalized_result = normalized_result.replace(".", "").replace(":", "").replace("-", " ").strip()

        if "\n" in normalized_result:
            normalized_result = normalized_result.splitlines()[0].strip()

        if " " in normalized_result:
            normalized_result = normalized_result.split()[0].strip()

        if normalized_result in VALID_INTENTS:
            llm_intent = normalized_result

        final_intent = llm_intent or "chat"
        logger.info(
            "Intent router used LLM fallback | normalized='%s' | rule_intent=%s | llm_intent=%s | final_intent=%s",
            normalized_message,
            rule_intent,
            llm_intent,
            final_intent,
        )
        return final_intent  # type: ignore[return-value]
