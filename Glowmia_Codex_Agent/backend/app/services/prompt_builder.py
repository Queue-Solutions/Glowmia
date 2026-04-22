from app.models.chat import ChatMessage, Language


SYSTEM_PROMPT = """
You are Glowmia, an elegant AI fashion assistant for dresses.

Core behavior:
- Be warm, natural, specific, and stylistically aware.
- Avoid repetitive filler and generic assistant phrasing.
- If the user wants dress recommendations, gather helpful preferences naturally and support product lookup.
- If the user asks for styling advice, answer conversationally with practical fashion guidance.
- If the user wants to edit a selected dress, keep the response focused on changing the same dress image, never inventing a new outfit or a different person.
- Support both English and Arabic fluently.
- When replying in Arabic, use clear, natural Modern Standard Arabic with a polished tone.
- Keep recommendations grounded in available catalog items provided separately.
""".strip()


def build_history(messages: list[ChatMessage], limit: int) -> list[dict[str, str]]:
    clipped_messages = messages[-limit:]
    return [{"role": item.role, "content": item.content} for item in clipped_messages]


def build_system_prompt(language: Language) -> str:
    if language == "ar":
        return (
            f"{SYSTEM_PROMPT}\n\n"
            "Arabic mode rules:\n"
            "- Reply in polished, natural Arabic unless the user clearly switches languages.\n"
            "- Prefer fashion vocabulary that feels premium, clear, and concise.\n"
            "- Avoid literal machine-like phrasing and avoid repeating the same compliments.\n"
            "- Do not insert stray English words inside Arabic sentences.\n"
            "- If details are missing, ask for the most useful fashion preferences naturally."
        )

    return (
        f"{SYSTEM_PROMPT}\n\n"
        "English mode rules:\n"
        "- Reply in polished, natural English.\n"
        "- Keep the tone premium, warm, and stylistically confident.\n"
        "- Avoid repetitive assistant filler and generic advice."
    )


def build_style_prompt(language: Language, user_message: str) -> str:
    if language == "ar":
        return (
            "قدمي نصيحة تنسيق عملية وراقية حول طلب المستخدم التالي، بنبرة طبيعية وغير مكررة، "
            "مع اقتراحات واضحة تناسب الألوان والإكسسوارات والأحذية إن لزم. اكتبي بالعربية فقط ومن دون أي كلمات إنجليزية:\n"
            f"{user_message}"
        )

    return (
        "Give practical, fashion-aware styling advice for the user's request with a natural, polished tone:\n"
        f"{user_message}"
    )


def build_chat_prompt(language: Language, user_message: str) -> str:
    if language == "ar":
        return f"ردي كمساعدة أزياء ذكية وراقية على رسالة المستخدم التالية، وبالعربية فقط من دون كلمات إنجليزية:\n{user_message}"
    return f"Reply as a polished AI fashion assistant to the following user message:\n{user_message}"


def build_selected_dress_context(language: Language, dress_summary: str | None) -> str:
    if not dress_summary:
        return ""
    if language == "ar":
        return f"\nمعلومات الفستان المختار حالياً:\n{dress_summary}\nاستخدمي هذه المعلومات كمرجع أساسي في الرد، وبالعربية فقط."
    return f"\nCurrent selected dress details:\n{dress_summary}\nUse these details as the primary context for your response."


def build_intent_prompt(language: Language, user_message: str) -> str:
    instruction = (
        "Classify the intent as exactly one of: recommend, styling, edit, chat. "
        "Return only the label."
    )
    if language == "ar":
        return (
            f"{instruction}\n"
            "Arabic hint: requests for dress suggestions or catalog options are recommend; "
            "styling help is styling; changing the selected dress image is edit.\n"
            f"رسالة المستخدم: {user_message}"
        )
    return f"{instruction}\nUser message: {user_message}"


def build_edit_prompt(language: Language, user_message: str) -> str:
    if language == "ar":
        return (
            "عدلي نفس الفستان الموجود في الصورة فقط. يجب تنفيذ التعديل المطلوب فعلياً على الفستان نفسه، "
            "خصوصاً إذا طلب المستخدم تغيير اللون أو الأكمام أو فتحة الصدر أو تفاصيل القصة. "
            "حافظي على لون الفستان الحالي كما هو تماماً ما لم يطلب المستخدم تغيير اللون بشكل صريح. "
            "لا تغيري الشخص، ولا الوجه، ولا الخلفية بشكل جذري، ولا تستبدلي الفستان بملابس أخرى. "
            "حافظي على نفس موديل الفستان ونفس التكوين العام للصورة، لكن طبقي التغيير المطلوب بوضوح وظهور ملحوظ.\n"
            f"{user_message}"
        )

    return (
        "Edit the same dress shown in the source image only. You must visibly apply the requested dress change, "
        "especially color, sleeves, neckline, slit, or fabric-detail changes. Preserve the current dress color exactly "
        "unless the user explicitly asks to change the color. Do not change the person, face, pose, or scene radically. "
        "Do not replace the dress with unrelated clothing or a different subject. Preserve the base dress identity, "
        "composition, and silhouette while applying this request clearly:\n"
        f"{user_message}"
    )


def build_edit_translation_prompt(user_message: str) -> str:
    return (
        "Translate the following Arabic fashion image-edit request into clear, concise English for an image editing model. "
        "Keep the exact requested dress changes, especially color, sleeves, neckline, slit, fit, and fabric details. "
        "Return only the translated instruction.\n"
        f"{user_message}"
    )
