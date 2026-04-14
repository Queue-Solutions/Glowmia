from fastapi import APIRouter, HTTPException
from app.models.schemas import DressBase, DressesResponse
from app.services.supabase_service import fetch_all_dresses

router = APIRouter(prefix="/dresses", tags=["dresses"])


@router.get("", response_model=DressesResponse)
def get_dresses():
    try:
        dresses = fetch_all_dresses()
        return DressesResponse(count=len(dresses), dresses=dresses)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch dresses: {str(exc)}")