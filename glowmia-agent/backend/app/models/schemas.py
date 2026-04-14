from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DressBase(BaseModel):
    id: str
    name: str
    image_url: str
    category: Optional[str] = None
    occasion: Optional[List[str]] = None
    color: Optional[str] = None
    sleeve_type: Optional[str] = None
    length: Optional[str] = None
    style: Optional[List[str]] = None
    fabric: Optional[str] = None
    fit: Optional[str] = None
    description: Optional[str] = None
    name_ar: Optional[str] = None
    description_ar: Optional[str] = None
    color_ar: Optional[str] = None
    sleeve_type_ar: Optional[str] = None
    length_ar: Optional[str] = None
    fabric_ar: Optional[str] = None
    fit_ar: Optional[str] = None
    occasion_ar: Optional[List[str]] = None
    style_ar: Optional[List[str]] = None
    created_at: Optional[str] = None


class DressesResponse(BaseModel):
    count: int
    dresses: List[DressBase]


class EditRequest(BaseModel):
    dress_id: str
    image_url: str
    instruction: str


class EditResponse(BaseModel):
    dress_id: str
    original_image_url: str
    edited_image_url: Optional[str] = None
    parsed_edits: Dict[str, Any]
    provider: str
    model: Optional[str] = None
    message: str