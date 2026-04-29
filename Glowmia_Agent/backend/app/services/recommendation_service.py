from typing import Any

from supabase import Client, create_client

from app.core.config import settings
from app.core.logging import get_logger
from app.models.chat import Dress, Language

logger = get_logger(__name__)


class RecommendationService:
    def __init__(self) -> None:
        self._client: Client | None = None

    def _get_client(self) -> Client:
        if self._client is None:
            if not settings.supabase_url or not settings.supabase_key:
                raise RuntimeError("Supabase credentials are not configured")
            self._client = create_client(settings.supabase_url, settings.supabase_key)
        return self._client

    def _normalize_display_value(self, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, list):
            normalized_items = [str(item).strip() for item in value if str(item).strip()]
            return ", ".join(normalized_items) if normalized_items else None
        normalized = str(value).strip()
        return normalized or None

    def _normalize_list(self, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        normalized = str(value).strip()
        return [normalized] if normalized else []

    def _extract_filters(self, message: str) -> dict[str, str]:
        lowered = message.lower()
        filters: dict[str, str] = {}

        keywords = {
            "occasion": {
                "wedding": "wedding",
                "party": "party",
                "casual": "casual",
                "formal": "formal",
                "evening": "evening",
                "work": "work",
                "حفلة": "party",
                "حفله": "party",
                "حفلات": "party",
                "زفاف": "wedding",
                "عرس": "wedding",
                "كاجوال": "casual",
                "رسمي": "formal",
                "سهرة": "evening",
                "مسائي": "evening",
                "للعمل": "work",
            },
            "color": {
                "black": "black",
                "white": "white",
                "red": "red",
                "green": "green",
                "blue": "blue",
                "pink": "pink",
                "gold": "gold",
                "silver": "silver",
                "burgundy": "burgundy",
                "cream": "cream",
                "blush": "blush",
                "أسود": "black",
                "اسود": "black",
                "أبيض": "white",
                "ابيض": "white",
                "أحمر": "red",
                "احمر": "red",
                "أخضر": "green",
                "اخضر": "green",
                "أزرق": "blue",
                "ازرق": "blue",
                "وردي": "pink",
                "ذهبي": "gold",
                "فضي": "silver",
                "عنابي": "burgundy",
                "كريمي": "cream",
                "أوف وايت": "cream",
                "اوف وايت": "cream",
                "بلش": "blush",
            },
            "style": {
                "minimal": "minimal",
                "romantic": "romantic",
                "classic": "classic",
                "modern": "modern",
                "bold": "bold",
                "luxury": "luxury",
                "soft": "soft",
                "elegant": "elegant",
                "ناعم": "soft",
                "رومانسي": "romantic",
                "كلاسيكي": "classic",
                "مودرن": "modern",
                "جريء": "bold",
                "فاخر": "luxury",
                "أنيق": "elegant",
                "انيق": "elegant",
            },
            "sleeve_type": {
                "sleeveless": "sleeveless",
                "long sleeve": "long sleeve",
                "short sleeve": "short sleeve",
                "one shoulder": "one shoulder",
                "off shoulder": "off shoulder",
                "بدون أكمام": "sleeveless",
                "بدون اكمام": "sleeveless",
                "كم طويل": "long sleeve",
                "كم قصير": "short sleeve",
                "كتف واحدة": "one shoulder",
                "أكتاف مكشوفة": "off shoulder",
            },
            "length": {
                "mini": "mini",
                "midi": "midi",
                "maxi": "maxi",
                "قصير": "mini",
                "متوسط": "midi",
                "طويل": "maxi",
                "ماكسي": "maxi",
                "ميدي": "midi",
            },
        }

        for field, options in keywords.items():
            for option, canonical_value in options.items():
                if option in lowered:
                    filters[field] = canonical_value
                    break

        return filters

    def analyze_preferences(self, message: str) -> dict[str, Any]:
        return {
            "filters": self._extract_filters(message),
            "tokens": self._tokenize_message(message),
        }

    def _localized_value(self, row: dict[str, Any], field: str, language: Language) -> str | None:
        localized_key = f"{field}_ar"
        preferred_value = row.get(localized_key) if language == "ar" else row.get(field)
        fallback_value = row.get(field) if language == "ar" else row.get(localized_key)
        return self._normalize_display_value(preferred_value) or self._normalize_display_value(fallback_value)

    def _map_row(self, row: dict[str, Any], language: Language) -> Dress:
        primary_image = row.get("front_view_url") or row.get("image_url") or row.get("cover_image_url")
        return Dress(
            id=str(row.get("id", "")),
            name=self._localized_value(row, "name", language) or row.get("title") or "Glowmia Dress",
            color=self._localized_value(row, "color", language),
            occasion=self._localized_value(row, "occasion", language),
            style=self._localized_value(row, "style", language),
            sleeve_type=self._localized_value(row, "sleeve_type", language),
            length=self._localized_value(row, "length", language),
            fabric=self._localized_value(row, "fabric", language),
            fit=self._localized_value(row, "fit", language),
            description=self._localized_value(row, "description", language),
            image_url=primary_image,
            front_view_url=row.get("front_view_url"),
            back_view_url=row.get("back_view_url"),
            side_view_url=row.get("side_view_url"),
            cover_image_url=row.get("cover_image_url"),
        )

    def _value_contains(self, value: Any, expected: str) -> bool:
        if value is None:
            return False
        if isinstance(value, list):
            return any(expected.lower() in str(item).lower() for item in value)
        return expected.lower() in str(value).lower()

    def _color_matches(self, value: Any, expected: str) -> bool:
        if value is None:
            return False
        aliases = {
            "white": {"white", "cream", "off white", "off-white", "silver", "أبيض", "ابيض", "أوف وايت", "اوف وايت", "كريمي", "فضي"},
            "cream": {"cream", "off white", "off-white", "white", "كريمي", "أوف وايت", "اوف وايت", "أبيض", "ابيض"},
            "silver": {"silver", "white", "فضي", "أبيض", "ابيض"},
            "red": {"red", "burgundy", "أحمر", "احمر", "عنابي"},
            "burgundy": {"burgundy", "red", "عنابي", "أحمر", "احمر"},
        }
        acceptable = aliases.get(expected.lower().strip(), {expected.lower().strip()})
        if isinstance(value, list):
            return any(str(item).lower().strip() in acceptable for item in value)
        normalized = str(value).lower().strip()
        return normalized in acceptable

    def _value_equals(self, value: Any, expected: str) -> bool:
        if value is None:
            return False
        expected_normalized = expected.lower().strip()
        if isinstance(value, list):
            return any(str(item).lower().strip() == expected_normalized for item in value)
        return str(value).lower().strip() == expected_normalized

    def _tokenize_message(self, message: str) -> list[str]:
        sanitized = message.lower().replace(",", " ").replace("،", " ")
        return [token.strip() for token in sanitized.split() if len(token.strip()) >= 2]

    def _row_search_text(self, row: dict[str, Any]) -> str:
        searchable_fields = [
            "name",
            "name_ar",
            "description",
            "description_ar",
            "color",
            "color_ar",
            "fabric",
            "fabric_ar",
            "fit",
            "fit_ar",
            "sleeve_type",
            "sleeve_type_ar",
            "length",
            "length_ar",
            "category",
            "occasion",
            "occasion_ar",
            "style",
            "style_ar",
        ]

        values: list[str] = []
        for field in searchable_fields:
            values.extend(self._normalize_list(row.get(field)))
        return " ".join(value.lower() for value in values)

    def _score_row(self, row: dict[str, Any], filters: dict[str, str], tokens: list[str]) -> int:
        score = 0
        search_text = self._row_search_text(row)
        for field, expected in filters.items():
            if field == "color":
                exact_match = self._color_matches(row.get(field), expected) or self._color_matches(row.get(f"{field}_ar"), expected)
            else:
                exact_match = self._value_equals(row.get(field), expected) or self._value_equals(row.get(f"{field}_ar"), expected)
            fuzzy_match = self._value_contains(row.get(field), expected) or self._value_contains(row.get(f"{field}_ar"), expected)
            if exact_match:
                score += 30 if field == "color" else 8
            elif fuzzy_match:
                score += 15 if field == "color" else 3
        for token in tokens:
            if token in search_text:
                score += 1
        return score

    def _row_matches_required_filters(self, row: dict[str, Any], filters: dict[str, str]) -> bool:
        strict_fields = {"color", "occasion", "length", "sleeve_type"}
        for field, expected in filters.items():
            if field not in strict_fields:
                continue
            if field == "color":
                if self._color_matches(row.get(field), expected) or self._color_matches(row.get(f"{field}_ar"), expected):
                    continue
            elif self._value_equals(row.get(field), expected) or self._value_equals(row.get(f"{field}_ar"), expected):
                continue
            if self._value_contains(row.get(field), expected) or self._value_contains(row.get(f"{field}_ar"), expected):
                continue
            return False
        return True

    def recommend(self, message: str, language: Language) -> list[Dress]:
        client = self._get_client()
        analysis = self.analyze_preferences(message)
        filters = analysis["filters"]
        tokens = analysis["tokens"]
        rows = client.table("dresses").select("*").limit(30).execute().data or []

        if filters:
            strictly_filtered = [row for row in rows if self._row_matches_required_filters(row, filters)]
            if strictly_filtered:
                rows = strictly_filtered

        scored_rows = sorted(rows, key=lambda row: self._score_row(row, filters, tokens), reverse=True)
        if filters or tokens:
            ranked_rows = [row for row in scored_rows if self._score_row(row, filters, tokens) > 0]
        else:
            ranked_rows = scored_rows

        dresses = [self._map_row(row, language) for row in ranked_rows[: settings.max_recommendations]]
        logger.info("Recommendation query returned %s dresses", len(dresses))
        return dresses

    def get_dress_by_id(self, dress_id: str, language: Language) -> Dress | None:
        client = self._get_client()
        rows = client.table("dresses").select("*").eq("id", dress_id).limit(1).execute().data or []
        if not rows:
            return None
        return self._map_row(rows[0], language)
