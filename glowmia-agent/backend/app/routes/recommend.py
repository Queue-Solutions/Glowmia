from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.supabase_service import fetch_all_dresses
from app.services.prompt_parser import extract_preferences
from app.services.recommender import recommend_dresses
from app.services.llm_parser import extract_preferences_llm

router = APIRouter(prefix="/recommend", tags=["recommend"])


class RecommendRequest(BaseModel):
    query: str


@router.post("")
def recommend(request: RecommendRequest):
    try:
        dresses = fetch_all_dresses()

        # Try LLM parser first
        prefs = extract_preferences_llm(request.query)

        # Fallback to rule-based parser if LLM fails
        if not prefs:
            prefs = extract_preferences(request.query)

        results = recommend_dresses(dresses, prefs)

        return {
            "query": request.query,
            "parsed_preferences": prefs,
            "results": results,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))