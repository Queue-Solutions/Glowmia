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


def _build_replicate_prompt(parsed_edits: dict, user_instruction: str) -> str:
    strict_changes = []

    # 🔥 COLOR (VERY IMPORTANT)
    if parsed_edits.get("color"):
        strict_changes.append(
            f"The dress color MUST be changed to {parsed_edits['color']} clearly and visibly. "
            f"The original color MUST NOT remain in any part of the dress."
        )

    # 🔥 LENGTH
    if parsed_edits.get("length"):
        if parsed_edits["length"] == "mini":
            strict_changes.append(
                "The dress MUST be shortened to a mini length above the knees."
            )
        elif parsed_edits["length"] == "midi":
            strict_changes.append(
                "The dress MUST be adjusted to a midi length below the knees."
            )
        elif parsed_edits["length"] == "maxi":
            strict_changes.append(
                "The dress MUST be extended to a full floor-length maxi dress."
            )

    # 🔥 SLEEVES
    if parsed_edits.get("sleeve_type"):
        if parsed_edits["sleeve_type"] == "long sleeve":
            strict_changes.append(
                "The dress MUST have long sleeves fully covering the arms."
            )
        elif parsed_edits["sleeve_type"] == "short sleeve":
            strict_changes.append(
                "The dress MUST have short sleeves."
            )
        elif parsed_edits["sleeve_type"] == "sleeveless":
            strict_changes.append(
                "The dress MUST be completely sleeveless."
            )

    # 🔥 STYLE
    if parsed_edits.get("style"):
        strict_changes.append(
            f"The overall look of the dress MUST reflect a {parsed_edits['style']} style clearly."
        )

    # 🔥 FABRIC
    if parsed_edits.get("fabric"):
        strict_changes.append(
            f"The fabric MUST visually appear as {parsed_edits['fabric']} with realistic texture."
        )

    # 🔥 OCCASION
    if parsed_edits.get("occasion"):
        strict_changes.append(
            f"The dress MUST visually fit a {parsed_edits['occasion']} occasion."
        )

    changes_block = "\n- ".join(strict_changes) if strict_changes else user_instruction

    return f"""
You are editing a professional fashion catalog image.

CRITICAL RULES (MUST FOLLOW):
- DO NOT change the model identity
- DO NOT change the face
- DO NOT change the pose
- DO NOT change the background
- DO NOT change lighting
- DO NOT generate a new person
- DO NOT duplicate the body
- DO NOT distort proportions

STRICT EDIT RULES:
- ALL requested changes MUST be applied
- NONE of the requested changes can be ignored
- If a change conflicts with the original image, MODIFY the dress to satisfy the request

APPLY THESE CHANGES EXACTLY:
- {changes_block}

FINAL REQUIREMENTS:
- Result must look realistic
- High-quality fashion catalog style
- Clean, sharp, premium look
- Edits must be clearly visible and obvious

FAILURE CONDITIONS (AVOID):
- Keeping original color when a new color is requested
- Partial edits
- Subtle changes that are not noticeable
"""


def apply_edits(image_url: str, parsed_edits: Dict[str, Any], user_instruction: str) -> Dict[str, Any]:
    if not settings.replicate_api_token:
        raise ValueError("REPLICATE_API_TOKEN is missing in .env")

    if not image_url:
        raise ValueError("image_url is required")

    prompt = _build_replicate_prompt(parsed_edits, user_instruction)

    client = replicate.Client(api_token=settings.replicate_api_token)

    output = client.run(
        settings.replicate_model,
        input={
            "input_image": image_url,
            "prompt": prompt,
            "guidance_scale": 8.5,  # 🔥 stronger adherence
            "num_inference_steps": 35,  # 🔥 better consistency
            "aspect_ratio": "match_input_image",
            "output_format": "png",
        },
    )

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
