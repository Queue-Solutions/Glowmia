from fastapi import APIRouter, HTTPException

from app.models.schemas import EditRequest, EditResponse
from app.services.edit_parser import parse_edit_instruction
from app.services.image_editor import apply_edits

router = APIRouter(prefix="/edit", tags=["edit"])


@router.post("", response_model=EditResponse)
def edit_dress(request: EditRequest):
    try:
        parsed = parse_edit_instruction(request.instruction)
        applied = parsed.get("applied", {})

        if not applied:
            return EditResponse(
                dress_id=request.dress_id,
                original_image_url=request.image_url,
                edited_image_url=request.image_url,
                parsed_edits={},
                provider="replicate",
                model=None,
                message="No supported structured edits were detected yet. Try something like 'make it blue' or 'add long sleeves'.",
            )

        result = apply_edits(
            image_url=request.image_url,
            parsed_edits=applied,
            user_instruction=request.instruction,
        )

        return EditResponse(
            dress_id=request.dress_id,
            original_image_url=request.image_url,
            edited_image_url=result.get("edited_image_url"),
            parsed_edits=applied,
            provider=result.get("provider", "replicate"),
            model=result.get("model"),
            message="Dress edited successfully with Replicate.",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))