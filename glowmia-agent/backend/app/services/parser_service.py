from typing import Dict, Any
from app.config import settings
from app.services.prompt_parser import parse_prompt_rule_based
from app.services.llm_parser import extract_preferences_llm


def _normalize_mode(mode: str) -> str:
    mode = (mode or "").strip().lower()
    if mode not in {"rule", "llm", "hybrid"}:
        return "hybrid"
    return mode


def parse_user_query(user_query: str) -> Dict[str, Any]:
    """
    Main parser entrypoint used by the whole system.
    """

    mode = _normalize_mode(settings.parser_mode)

    if mode == "rule":
        parsed = parse_prompt_rule_based(user_query)
        parsed["_parser_used"] = "rule"
        return parsed

    if mode == "llm":
        parsed = extract_preferences_llm(user_query)
        if not parsed:
            raise ValueError("LLM parser returned no result")
        parsed["_parser_used"] = "llm"
        return parsed

    # hybrid
    parsed = extract_preferences_llm(user_query)
    if parsed:
        parsed["_parser_used"] = "llm"
        return parsed

    parsed = parse_prompt_rule_based(user_query)
    parsed["_parser_used"] = "rule_fallback"
    return parsed