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
            "- Reply only in polished, natural Arabic unless the user clearly switches languages.\n"
            "- Use Arabic script only. Do not insert English, Cyrillic, or other foreign-script words unless they are unavoidable brand names.\n"
            "- If a product attribute arrives in English and it is not a brand name, translate it naturally into Arabic.\n"
            "- Prefer premium, concise, fashion-aware wording.\n"
            "- Avoid literal machine-like phrasing and avoid repeating the same compliments.\n"
            "- If details are missing, ask only for the most useful fashion preferences."
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
            "Provide practical, refined styling advice for the following user request. "
            "Reply entirely in natural Arabic script, with clear suggestions for accessories, shoes, layering, colors, or finishing touches when relevant. "
            "Do not insert foreign-script words unless they are unavoidable brand names.\n"
            f"User request: {user_message}"
        )

    return (
        "Give practical, fashion-aware styling advice for the user's request with a natural, polished tone:\n"
        f"{user_message}"
    )


def build_chat_prompt(language: Language, user_message: str) -> str:
    if language == "ar":
        return (
            "Reply as a polished AI fashion assistant in natural Arabic script only. "
            "Do not use foreign-script words unless they are unavoidable brand names.\n"
            f"User message: {user_message}"
        )
    return f"Reply as a polished AI fashion assistant to the following user message:\n{user_message}"


def build_selected_dress_context(language: Language, dress_summary: str | None) -> str:
    if not dress_summary:
        return ""
    if language == "ar":
        return (
            "\nCurrent selected dress details for context:\n"
            f"{dress_summary}\n"
            "Use these details as the primary reference for the reply, but keep the final answer fully in natural Arabic script."
        )
    return f"\nCurrent selected dress details:\n{dress_summary}\nUse these details as the primary context for your response."


def build_intent_prompt(language: Language, user_message: str, has_selected_dress: bool = False) -> str:
    instruction = (
        "Classify the intent as exactly one of: recommend, styling, edit, chat. "
        "Return only the label."
    )
    if language == "ar":
        selected_dress_note = (
            "\nهناك فستان محدد بالفعل في الجلسة الحالية.\n"
            "- إذا طلب المستخدم إظهار صورة جديدة لنفس الفستان مع إضافة مرئية مثل عقد أو أقراط أو حزام أو أكمام أو أي تفصيلة ظاهرة، فالتصنيف الصحيح هو edit.\n"
            "- إذا قال المستخدم مثلاً: أضيفي عقداً، وريني صورة، ابعتيلي صورة، أو خليه مع قلادة، فاعتبر هذا edit ما دام المقصود تعديل صورة الفستان المختار نفسه.\n"
            "- إذا كان يريد نصيحة فقط عن ماذا يناسب الفستان من دون تعديل الصورة، فالتصنيف الصحيح هو styling.\n"
            if has_selected_dress
            else ""
        )
        return (
            f"{instruction}\n"
            "The user message may be in Arabic. Understand the meaning, not surface keywords.\n"
            "recommend = asking for dress suggestions, catalog options, or help choosing a dress.\n"
            "styling = asking for advice on how to style or accessorize a dress without changing the image itself.\n"
            "edit = asking to visually modify the selected dress image itself, including adding or changing visible items or details.\n"
            "chat = general conversation or questions that are not recommendation, styling, or edit requests.\n"
            f"{selected_dress_note}"
            f"User message: {user_message}"
        )
    selected_dress_note = (
        "\nA dress is already selected in the current session.\n"
        "- If the user asks to show or send an image of that same dress with a visible added item such as a necklace, earrings, belt, sleeves, or another visible detail, classify it as edit.\n"
        "- If they want advice only, without changing the image, classify it as styling.\n"
        if has_selected_dress
        else ""
    )
    return f"{instruction}{selected_dress_note}\nUser message: {user_message}"


def build_edit_prompt(language: Language, user_message: str) -> str:
    base_instruction = (
        "Edit the exact same dress shown in the source image and keep the same person, pose, framing, camera angle, lighting, and overall scene. "
        "Apply only the requested change and preserve every other visible detail unless the user explicitly asks to change it. "
        "Do not redesign the dress, do not alter unrelated areas, and do not introduce new garments, new people, or background changes. "
        "If the request is to add an accessory or a small fashion detail, add only that item and leave everything else unchanged. "
        "If the request is to change one attribute such as color, sleeves, neckline, slit, fabric detail, fit, or embellishment, change only that attribute and preserve all other attributes. "
        "Preserve the base garment identity so the result still clearly looks like the same original dress."
    )

    if language == "ar":
        return (
            f"{base_instruction} "
            "The user request may have been translated from Arabic, but you must still obey it strictly and avoid any extra creative changes.\n"
            f"Requested change: {user_message}"
        )

    return f"{base_instruction}\nRequested change: {user_message}"


def build_edit_translation_prompt(user_message: str) -> str:
    return (
        "Translate the following Arabic fashion image-edit request into clear, concise English for an image editing model. "
        "Keep the exact requested dress changes, especially color, sleeves, neckline, slit, fit, fabric details, and accessories. "
        "Do not add creative changes. Return only the translated instruction.\n"
        f"{user_message}"
    )
