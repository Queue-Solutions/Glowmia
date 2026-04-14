import re
from typing import Any, Dict, List, Optional


def normalize_text(text: str) -> str:
    text = text.lower().strip()

    # Arabic normalization
    text = text.replace("أ", "ا")
    text = text.replace("إ", "ا")
    text = text.replace("آ", "ا")
    text = text.replace("ى", "ي")
    text = text.replace("ة", "ه")

    # Remove tashkeel
    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)

    # Normalize spaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


def contains_any(text: str, variants: List[str]) -> bool:
    return any(v in text for v in variants)


def _collect_detected_terms(applied: Dict[str, str], value_maps: Dict[str, Dict[str, List[str]]]) -> List[str]:
    """
    Collect all phrases that correspond to the applied normalized values.
    Used to reduce false positives in ignored terms.
    """
    detected_terms: List[str] = []

    for field_name, normalized_value in applied.items():
        field_map = value_maps.get(field_name, {})
        variants = field_map.get(normalized_value, [])
        detected_terms.extend(variants)

    return detected_terms


def _extract_ignored_terms(text: str, applied: Dict[str, str], value_maps: Dict[str, Dict[str, List[str]]]) -> List[str]:
    """
    Heuristic only:
    - Remove known filler words
    - Remove words already covered by detected variants
    - Return a short list of meaningful leftover tokens/phrases
    """
    stop_words = {
        "make", "it", "more", "less", "and", "please", "the", "a", "an", "to", "for",
        "خليه", "اعمليه", "عايزه", "عايز", "لو", "بس", "شويه", "شويه", "كده", "هذا",
        "دي", "ده", "في", "من", "على", "مع", "او", "أو", "then", "also", "just"
    }

    detected_terms = _collect_detected_terms(applied, value_maps)

    # remove multi-word detected terms first
    leftover_text = text
    for phrase in sorted(detected_terms, key=len, reverse=True):
        if phrase:
            leftover_text = leftover_text.replace(phrase, " ")

    leftover_text = re.sub(r"[^\w\u0600-\u06FF\s]", " ", leftover_text)
    tokens = [t.strip() for t in leftover_text.split() if t.strip()]

    ignored: List[str] = []
    seen = set()

    for token in tokens:
        if token in stop_words:
            continue
        if len(token) <= 2:
            continue
        if token in seen:
            continue
        seen.add(token)
        ignored.append(token)

    return ignored[:5]


def parse_edit_instruction(instruction: str) -> Dict[str, Any]:
    text = normalize_text(instruction)

    edits: Dict[str, Optional[str]] = {
        "color": None,
        "sleeve_type": None,
        "style": None,
        "fabric": None,
        "length": None,
        "occasion": None,
    }

    # ----------------------------
    # COLORS
    # ----------------------------
    color_map = {
        "blue": [
            "blue", "navy", "royal blue",
            "ازرق", "كحلي", "لبني", "نيلي"
        ],
        "black": [
            "black",
            "اسود"
        ],
        "white": [
            "white",
            "ابيض", "اوف وايت", "سكري"
        ],
        "red": [
            "red",
            "احمر"
        ],
        "green": [
            "green",
            "اخضر", "زيتي"
        ],
        "pink": [
            "pink",
            "وردي", "بينك"
        ],
        "cream": [
            "cream", "beige", "nude",
            "كريمي", "بيج", "نود"
        ],
        "gold": [
            "gold",
            "ذهبي"
        ],
        "silver": [
            "silver",
            "فضي"
        ],
        "burgundy": [
            "burgundy", "maroon", "wine",
            "خمري", "نبيتي"
        ],
        "purple": [
            "purple", "lavender", "lilac",
            "بنفسجي", "موف", "ليلكي"
        ],
    }

    # ----------------------------
    # SLEEVES
    # ----------------------------
    sleeve_map = {
        "long sleeve": [
            "long sleeve", "long sleeves",
            "كم طويل", "اكمام طويله", "اكمام طويل", "بكم طويل", "كم",
            "ضيف كم طويل", "ضيفي كم طويل", "خليه بكم طويل"
        ],
        "short sleeve": [
            "short sleeve", "short sleeves",
            "كم قصير", "بكم قصير", "اكمام قصيره", "اكمام قصير",
            "قصر الكم", "قصري الكم", "shorten the sleeves", "shorter sleeves"
        ],
        "sleeveless": [
            "sleeveless",
            "بدون اكمام", "من غير كم", "شيل الكم", "شيلي الكم", "من غير اكمام"
        ],
    }

    # ----------------------------
    # STYLE
    # ----------------------------
    style_map = {
        "elegant": [
            "elegant", "classy", "chic",
            "شيك", "انيق", "ارقى", "افخم", "ستايل شيك"
        ],
        "soft": [
            "soft", "simple", "minimal",
            "ناعم", "بسيط", "هادي", "رقيق"
        ],
        "luxury": [
            "luxury", "fancy", "glamorous", "glam",
            "فاخر", "فخم", "جلام", "ملوكي"
        ],
        "feminine": [
            "feminine",
            "انثوي", "بناتي"
        ],
        "modest": [
            "modest", "covered",
            "محتشم", "مقفول", "استر"
        ],
        "bold": [
            "bold",
            "جريء", "ملفت"
        ],
    }

    # ----------------------------
    # FABRIC
    # ----------------------------
    fabric_map = {
        "satin": [
            "satin",
            "ساتان"
        ],
        "silk": [
            "silk",
            "حرير"
        ],
        "lace": [
            "lace",
            "دانتيل"
        ],
        "tulle": [
            "tulle",
            "تول"
        ],
        "chiffon": [
            "chiffon",
            "شيفون"
        ],
        "velvet": [
            "velvet",
            "قطيفه", "مخمل"
        ],
    }

    # ----------------------------
    # LENGTH
    # ----------------------------
    length_map = {
        "maxi": [
            "maxi", "full length",
            "طويل", "طوليه", "خليه طويل", "خليه اطول", "طوليه"
        ],
        "midi": [
            "midi",
            "متوسط", "نصف طويل"
        ],
        "mini": [
            "mini", "short",
            "قصير", "قصريه", "خليه قصير", "قصريه شويه",
            "shorter", "shorten it", "make it shorter"
        ],
    }

    # ----------------------------
    # OCCASION / MOOD
    # ----------------------------
    occasion_map = {
        "wedding": [
            "wedding",
            "فرح", "مناسب لفرح", "للزفاف"
        ],
        "engagement": [
            "engagement",
            "خطوبه", "شبكه"
        ],
        "party": [
            "party",
            "حفله", "سهرة", "سهره"
        ],
        "casual": [
            "casual",
            "كاجوال", "يومي", "بسيط للخروج"
        ],
        "formal": [
            "formal",
            "رسمي", "سواريه"
        ],
    }

    value_maps = {
        "color": color_map,
        "sleeve_type": sleeve_map,
        "style": style_map,
        "fabric": fabric_map,
        "length": length_map,
        "occasion": occasion_map,
    }

    # ----------------------------
    # DETECT COLORS
    # ----------------------------
    for normalized_value, variants in color_map.items():
        if contains_any(text, variants):
            edits["color"] = normalized_value
            break

    # ----------------------------
    # DETECT SLEEVES
    # ----------------------------
    for normalized_value, variants in sleeve_map.items():
        if contains_any(text, variants):
            edits["sleeve_type"] = normalized_value
            break

    # Handle natural Arabic "add sleeves" if sleeve type not specified
    if edits["sleeve_type"] is None:
        if contains_any(text, ["ضيف كم", "ضيفي كم", "ضيف اكمام", "ضيفي اكمام", "خليه بكم"]):
            edits["sleeve_type"] = "long sleeve"

    # ----------------------------
    # DETECT STYLE
    # ----------------------------
    for normalized_value, variants in style_map.items():
        if contains_any(text, variants):
            edits["style"] = normalized_value
            break

    # ----------------------------
    # DETECT FABRIC
    # ----------------------------
    for normalized_value, variants in fabric_map.items():
        if contains_any(text, variants):
            edits["fabric"] = normalized_value
            break

    # ----------------------------
    # DETECT LENGTH
    # ----------------------------
    for normalized_value, variants in length_map.items():
        if contains_any(text, variants):
            edits["length"] = normalized_value
            break

    # ----------------------------
    # DETECT OCCASION
    # ----------------------------
    for normalized_value, variants in occasion_map.items():
        if contains_any(text, variants):
            edits["occasion"] = normalized_value
            break

    # ----------------------------
    # EXTRA NATURAL ARABIC RULES
    # ----------------------------
    if contains_any(text, ["خليه اشيك", "خليه شيك", "اعمليه شيك", "عايزاه شيك"]):
        edits["style"] = "elegant"

    if contains_any(text, ["خليه ناعم", "اعمليه ناعم", "اخف", "ابسط"]):
        edits["style"] = "soft"

    if contains_any(text, ["خليه فخم", "اعمليه فخم", "افخم", "ارقى"]):
        edits["style"] = "luxury"

    if contains_any(text, ["خليه محتشم", "اعمليه محتشم", "استر", "اقفل الصدر"]):
        edits["style"] = "modest"

    if contains_any(text, ["خليه ساتان", "اعمليه ساتان"]):
        edits["fabric"] = "satin"

    if contains_any(text, ["خليه دانتيل", "اعمليه دانتيل"]):
        edits["fabric"] = "lace"

    if contains_any(text, ["خليه حرير", "اعمليه حرير"]):
        edits["fabric"] = "silk"

    if contains_any(text, ["خليه شيفون", "اعمليه شيفون"]):
        edits["fabric"] = "chiffon"

    # ----------------------------
    # STRUCTURED OUTPUT
    # ----------------------------
    applied = {k: v for k, v in edits.items() if v is not None}
    ignored = _extract_ignored_terms(text=text, applied=applied, value_maps=value_maps)

    if len(applied) >= 2:
        confidence = "high"
    elif len(applied) == 1:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "applied": applied,
        "ignored": ignored,
        "confidence": confidence,
        "raw_instruction": instruction,
        "normalized_instruction": text,
    }