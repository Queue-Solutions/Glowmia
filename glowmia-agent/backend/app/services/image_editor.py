from typing import Any, Dict, Iterable, Optional
import json
import logging

import replicate

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

_DIRECT_URL_KEYS = (
    "edited_image_url",
    "editedImageUrl",
    "url",
    "image_url",
    "imageUrl",
    "output_url",
    "outputUrl",
)

_NESTED_OUTPUT_KEYS = (
    "output",
    "outputs",
    "data",
    "result",
    "results",
    "prediction",
    "predictions",
)


def _coerce_http_url(value: Any) -> Optional[str]:
    if value is None:
        return None

    if isinstance(value, str):
        normalized = value.strip()
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
        return None

    try:
        normalized = str(value).strip()
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
    except Exception:
        return None

    return None


def _iter_collection(value: Any) -> Iterable[Any]:
    if isinstance(value, (list, tuple, set)):
        return value
    return ()


def _safe_output_preview(output: Any) -> str:
    try:
        if hasattr(output, "model_dump") and callable(output.model_dump):
            preview = output.model_dump()
        elif hasattr(output, "dict") and callable(output.dict):
            preview = output.dict()
        else:
            preview = output

        serialized = json.dumps(preview, default=str, ensure_ascii=True)
    except Exception:
        serialized = repr(output)

    if len(serialized) > 1500:
        return f"{serialized[:1500]}..."

    return serialized


def _to_output_url(output: Any) -> Optional[str]:
    if output is None:
        return None

    direct_url = _coerce_http_url(output)
    if direct_url:
        return direct_url

    for item in _iter_collection(output):
        normalized = _to_output_url(item)
        if normalized:
            return normalized

    if isinstance(output, dict):
        for key in _DIRECT_URL_KEYS:
            if key in output:
                normalized = _to_output_url(output.get(key))
                if normalized:
                    return normalized

        for key in _NESTED_OUTPUT_KEYS:
            if key in output:
                normalized = _to_output_url(output.get(key))
                if normalized:
                    return normalized

        return None

    url = getattr(output, "url", None)
    if callable(url):
        try:
            url = url()
        except Exception:
            url = None

    normalized_url = _to_output_url(url)
    if normalized_url:
        return normalized_url

    for method_name in ("model_dump", "dict", "to_dict"):
        method = getattr(output, method_name, None)
        if callable(method):
            try:
                normalized = _to_output_url(method())
                if normalized:
                    return normalized
            except Exception:
                continue

    for key in _DIRECT_URL_KEYS:
        try:
            normalized = _to_output_url(getattr(output, key, None))
            if normalized:
                return normalized
        except Exception:
            continue

    for key in _NESTED_OUTPUT_KEYS:
        try:
            normalized = _to_output_url(getattr(output, key, None))
            if normalized:
                return normalized
        except Exception:
            continue

    try:
        iterator = iter(output)
    except Exception:
        iterator = ()

    for item in iterator:
        normalized = _to_output_url(item)
        if normalized:
            return normalized

    return None


def _is_length_only_request(user_instruction: str) -> bool:
    instruction_lower = (user_instruction or "").lower().strip()

    color_keywords = [
        "blue", "red", "green", "yellow", "black", "white", "gold", "silver",
        "pink", "purple", "burgundy", "beige", "cream", "color", "colour",
        "لون", "ذهبي", "ازرق", "أزرق", "احمر", "أحمر", "اسود", "أسود",
        "ابيض", "أبيض", "وردي", "بينك",
    ]

    if any(word in instruction_lower for word in color_keywords):
        return False

    english_patterns = [
        "make it short",
        "make it shorter",
        "shorten it",
        "shorten the dress",
        "make the dress short",
        "make the dress shorter",
        "make it mini",
        "mini dress",
    ]

    if any(pattern in instruction_lower for pattern in english_patterns):
        return True

    arabic_patterns = [
        "خليها قصيرة",
        "خلي الفستان قصير",
        "قصري الفستان",
        "اقصري الفستان",
        "اجعليها قصيرة",
        "فستان قصير",
        "قصير",
    ]

    return any(pattern in user_instruction for pattern in arabic_patterns)


def _build_replicate_prompt(parsed_edits: Dict[str, Any], user_instruction: str) -> str:
    requested_changes = []
    preserve_instructions = []

    is_length_only = _is_length_only_request(user_instruction)

    if is_length_only:
        requested_changes.append(
            "Shorten ONLY the dress length. Keep the same dress design. Do not modify color, fabric, sleeves, neckline, bodice, silhouette, slit, embellishments, model, pose, background, or lighting."
        )
        preserve_instructions.extend(
            [
                "Keep the exact original dress color. Do not change the dress color.",
                "Keep the exact original fabric and texture.",
                "Keep the exact original sleeves, neckline, bodice, waist, fit, and silhouette.",
                "Do not add slits, decorations, patterns, or new design elements.",
                "Do not redesign the dress.",
            ]
        )
    else:
        if parsed_edits.get("color"):
            requested_changes.append(
                f"Change ONLY the dress color to {parsed_edits['color']}. Preserve all other dress details."
            )
        else:
            preserve_instructions.append("Do not change the dress color. Keep the exact original color.")

        if parsed_edits.get("length"):
            length = parsed_edits["length"]
            if length == "mini":
                requested_changes.append("Change ONLY the dress length to mini length above the knees.")
            elif length == "midi":
                requested_changes.append("Change ONLY the dress length to midi length below the knees.")
            elif length == "maxi":
                requested_changes.append("Change ONLY the dress length to full floor-length maxi.")
            else:
                requested_changes.append(f"Change ONLY the dress length to {length}.")
        else:
            preserve_instructions.append("Do not change the dress length.")

        if parsed_edits.get("sleeve_type"):
            sleeve_type = parsed_edits["sleeve_type"]
            requested_changes.append(f"Change ONLY the sleeves to {sleeve_type}.")
        else:
            preserve_instructions.append("Do not change the sleeves.")

        if parsed_edits.get("neckline"):
            requested_changes.append(f"Change ONLY the neckline to {parsed_edits['neckline']}.")
        else:
            preserve_instructions.append("Do not change the neckline.")

        if parsed_edits.get("style"):
            requested_changes.append(
                f"Adjust ONLY the requested style detail to be more {parsed_edits['style']}, while preserving the original dress identity."
            )
        else:
            preserve_instructions.append("Do not change the silhouette, fit, or overall dress shape.")

        if parsed_edits.get("fabric"):
            requested_changes.append(f"Change ONLY the fabric appearance to {parsed_edits['fabric']}.")
        else:
            preserve_instructions.append("Do not change the fabric or texture.")

        if parsed_edits.get("occasion"):
            requested_changes.append(
                f"Make the dress feel suitable for a {parsed_edits['occasion']} occasion without changing unrelated details."
            )

    preserve_instructions.extend(
        [
            "Keep the model's face, expression, hair, body, proportions, and pose exactly the same.",
            "Keep the background, lighting, shadows, camera angle, framing, and image composition identical.",
            "Do not generate a new person.",
            "Do not duplicate body parts.",
            "Do not change skin tone or facial features.",
            "Do not create a new dress design.",
        ]
    )

    changes_section = (
        "\n".join(f"• {change}" for change in requested_changes)
        if requested_changes
        else "• Apply only the user requested edit."
    )

    preserve_section = "\n".join(f"• {instruction}" for instruction in preserve_instructions)

    return f"""This is a STRICT image editing task, NOT a new image generation task.

You must preserve the original image identity. Use the provided input image as the source of truth.

REQUESTED EDITS:
{changes_section}

STRICT PRESERVATION RULES:
{preserve_section}

QUALITY REQUIREMENTS:
• Professional fashion catalog image
• Realistic, clean, premium result
• Seamless edit
• The requested edit must be visible
• Everything not listed as a requested edit must stay the same

CRITICAL FAILURE CONDITIONS:
• Changing the dress color when color was not requested is wrong
• Changing the neckline, sleeves, fabric, silhouette, or style when not requested is wrong
• Redesigning the dress is wrong
• Replacing the model or pose is wrong
• Changing the background or lighting is wrong

Only apply the requested edit and preserve everything else."""


def _build_replicate_input_payload(image_url: str, prompt: str) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "input_image": image_url,
        "prompt": prompt,
        "guidance_scale": 10,
        "num_inference_steps": 40,
        "aspect_ratio": "match_input_image",
        "output_format": "png",
    }

    # Some Replicate image-edit models support strength / prompt_strength.
    # If the selected model ignores unsupported keys, remove these if Replicate returns a schema error.
    payload["strength"] = 0.3
    payload["prompt_strength"] = 0.25

    return payload


def apply_edits(
    image_url: str,
    parsed_edits: Dict[str, Any],
    user_instruction: str,
) -> Dict[str, Any]:
    if not settings.replicate_api_token:
        raise ValueError("REPLICATE_API_TOKEN is missing in .env")

    if not image_url:
        raise ValueError("image_url is required")

    logger.info(
        "[EDIT_FLOW] Starting image edit | user_request=%r | parsed_edits=%s",
        user_instruction,
        parsed_edits,
    )

    prompt = _build_replicate_prompt(parsed_edits, user_instruction)

    client = replicate.Client(api_token=settings.replicate_api_token)

    input_payload = _build_replicate_input_payload(image_url, prompt)

    safe_payload = dict(input_payload)
    safe_payload["input_image"] = "[REDACTED]"

    logger.info("[EDIT_DEBUG] User original edit request: %r", user_instruction)
    logger.info("[EDIT_DEBUG] Parsed edits: %s", parsed_edits)
    logger.info("[EDIT_DEBUG] Final prompt sent to Replicate:\n%s", prompt)
    logger.info("[EDIT_DEBUG] Replicate input payload: %s", safe_payload)

    try:
        output = client.run(
            settings.replicate_model,
            input=input_payload,
        )
    except Exception as error:
        message = str(error)

        # Fallback if current Replicate model rejects optional tuning parameters.
        if "strength" in message or "prompt_strength" in message or "unexpected" in message.lower():
            logger.warning(
                "[EDIT_FLOW] Replicate rejected optional edit-control parameters. Retrying without strength/prompt_strength. error=%s",
                message,
            )

            fallback_payload = dict(input_payload)
            fallback_payload.pop("strength", None)
            fallback_payload.pop("prompt_strength", None)

            safe_fallback_payload = dict(fallback_payload)
            safe_fallback_payload["input_image"] = "[REDACTED]"

            logger.info("[EDIT_DEBUG] Fallback Replicate input payload: %s", safe_fallback_payload)

            output = client.run(
                settings.replicate_model,
                input=fallback_payload,
            )
        else:
            raise

    logger.info(
        "Replicate edit response received | model=%s | output_type=%s | output=%s",
        settings.replicate_model,
        type(output).__name__,
        _safe_output_preview(output),
    )

    edited_image_url = _to_output_url(output)

    if not edited_image_url:
        logger.error(
            "Replicate returned no editable image URL | model=%s | output_type=%s | output=%s",
            settings.replicate_model,
            type(output).__name__,
            _safe_output_preview(output),
        )
        raise ValueError(
            f"Replicate returned no editable image URL. output_type={type(output).__name__}"
        )

    return {
        "edited_image_url": edited_image_url,
        "editedImageUrl": edited_image_url,
        "provider": "replicate",
        "model": settings.replicate_model,
        "prompt_used": prompt,
        "applied_edits": parsed_edits,
    }