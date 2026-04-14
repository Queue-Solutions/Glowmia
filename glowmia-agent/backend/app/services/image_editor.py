from typing import Any, Dict, Optional
import replicate
from app.config import get_settings

settings = get_settings()


def _to_output_url(output: Any) -> Optional[str]:
    if output is None:
        return None

    if isinstance(output, list) and output:
        return _to_output_url(output[0])

    url = getattr(output, "url", None)
    if isinstance(url, str) and url:
        return url

    try:
        value = str(output)
        if value.startswith("http://") or value.startswith("https://"):
            return value
    except Exception:
        pass

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

    edited_image_url = _to_output_url(output)

    if not edited_image_url:
        raise ValueError("Replicate returned no editable image URL")

    return {
        "edited_image_url": edited_image_url,
        "provider": "replicate",
        "model": settings.replicate_model,
        "prompt_used": prompt,
        "applied_edits": parsed_edits,
    }