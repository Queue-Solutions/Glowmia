import re


def normalize_text(text: str) -> str:
    text = text.lower().strip()

    # Arabic normalization
    text = text.replace("أ", "ا")
    text = text.replace("إ", "ا")
    text = text.replace("آ", "ا")
    text = text.replace("ى", "ي")
    text = text.replace("ة", "ه")

    # remove tashkeel
    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)

    # normalize spaces
    text = re.sub(r"\s+", " ", text).strip()

    return text


def extract_preferences(query: str):
    query = normalize_text(query)

    preferences = {
        "color": None,
        "occasion": [],
        "style": []
    }

    # 🔥 COLOR
    colors = {
        "black": ["black", "اسود"],
        "white": ["white", "ابيض"],
        "red": ["red", "احمر"],
        "blue": ["blue", "ازرق"],
        "green": ["green", "اخضر"],
        "burgundy": ["burgundy", "خمري"],
        "gold": ["gold", "ذهبي"],
        "silver": ["silver", "فضي"],
        "pink": ["pink", "وردي"],
        "cream": ["cream", "كريمي"]
    }

    for key, values in colors.items():
        if any(v in query for v in values):
            preferences["color"] = key
            break  # stop after first match

    # 🔥 OCCASION (FIXED)
    occasion_map = {
        "wedding": ["wedding", "فرح"],
        "engagement": ["engagement", "خطوبه"],
        "reception": ["reception"],
        "party": ["party", "حفله"],
        "casual": ["casual", "كاجوال"],
        "formal": ["formal", "سهرة", "مسائي"]
    }

    for key, values in occasion_map.items():
        if any(v in query for v in values):
            if key not in preferences["occasion"]:
                preferences["occasion"].append(key)

    # 🔥 STYLE
    style_map = {
        "elegant": ["elegant", "classy", "chic", "شيك", "انيق"],
        "soft": ["soft", "simple", "ناعم", "بسيط"],
        "bold": ["bold", "جريء"],
        "luxury": ["luxury", "fancy", "فاخر"],
        "feminine": ["feminine", "انثوي"]
    }

    for key, values in style_map.items():
        if any(v in query for v in values):
            if key not in preferences["style"]:
                preferences["style"].append(key)

    return preferences