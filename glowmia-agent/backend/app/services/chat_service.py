from typing import List, Dict, Any, Optional
from datetime import datetime

from app.services.supabase_service import supabase
from app.services.recommender import recommend_dresses
from app.services.supabase_service import fetch_all_dresses
from app.services.prompt_parser import extract_preferences
from app.services.llm_parser import extract_preferences_llm
from app.services.edit_parser import parse_edit_instruction
from app.services.image_editor import apply_edits


def create_session(title: Optional[str] = None) -> Dict[str, Any]:
    response = supabase.table("chat_sessions").insert({
        "title": title or "New Chat",
    }).execute()
    return response.data[0]


def get_session_messages(session_id: str) -> List[Dict[str, Any]]:
    response = (
        supabase.table("chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data if response.data else []


def add_message(data: Dict[str, Any]) -> None:
    supabase.table("chat_messages").insert(data).execute()

    supabase.table("chat_sessions").update({
        "last_message_at": datetime.utcnow().isoformat()
    }).eq("id", data["session_id"]).execute()


def format_recommendation_dress(dress: Dict[str, Any]) -> Dict[str, Any]:
    """Format a dress for recommendations by using front image for display."""
    # Create a copy to avoid modifying the original
    formatted = dict(dress)
    
    # Store the original full image as detail_image_url for editing (fallback to current image_url)
    if "image_url" in formatted and formatted.get("image_url"):
        # If we have a separate detail image already, preserve it; otherwise use image_url as the detail
        if "detail_image_url" not in formatted or not formatted.get("detail_image_url"):
            formatted["detail_image_url"] = formatted["image_url"]
    
    # Use front_view_url for display (with fallback to image_url if front doesn't exist)
    if formatted.get("front_view_url"):
        formatted["image_url"] = formatted["front_view_url"]
    
    return formatted


def recommend_in_session(session_id: str, query: str) -> Dict[str, Any]:
    dresses = fetch_all_dresses()

    prefs = extract_preferences_llm(query)
    if not prefs:
        prefs = extract_preferences(query)

    results = recommend_dresses(dresses, prefs)
    
    # Format results to use cover images for display
    formatted_results = [format_recommendation_dress(dress) for dress in results]

    add_message({
        "session_id": session_id,
        "role": "user",
        "message_type": "recommend_request",
        "text": query,
    })

    add_message({
        "session_id": session_id,
        "role": "assistant",
        "message_type": "recommend_result",
        "parsed_data": prefs,
        "metadata": {
            "results": formatted_results
        }
    })

    return {
        "query": query,
        "parsed_preferences": prefs,
        "results": formatted_results
    }


def get_latest_image_for_dress(session_id: str, dress_id: str, fallback_image: str) -> str:
    response = (
        supabase.table("chat_messages")
        .select("edited_image_url")
        .eq("session_id", session_id)
        .eq("dress_id", dress_id)
        .not_.is_("edited_image_url", None)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    data = response.data

    if data and len(data) > 0 and data[0]["edited_image_url"]:
        return data[0]["edited_image_url"]

    return fallback_image


def edit_in_session(
    session_id: str,
    dress_id: str,
    original_image_url: str,
    instruction: str
) -> Dict[str, Any]:
    parsed = parse_edit_instruction(instruction)

    applied = parsed.get("applied", {})
    ignored = parsed.get("ignored", [])
    confidence = parsed.get("confidence", "low")

    if not applied:
        return {
            "error": "No supported structured edits were detected yet. Try something like 'make it blue' or 'add long sleeves'.",
            "parsed_edits": {},
            "ignored": ignored,
            "confidence": confidence,
        }

    image_to_edit = get_latest_image_for_dress(
        session_id=session_id,
        dress_id=dress_id,
        fallback_image=original_image_url
    )

    result = apply_edits(
        image_url=image_to_edit,
        parsed_edits=applied,
        user_instruction=instruction,
    )

    add_message({
        "session_id": session_id,
        "role": "user",
        "message_type": "edit_request",
        "text": instruction,
        "dress_id": dress_id,
        "image_url": image_to_edit
    })

    add_message({
        "session_id": session_id,
        "role": "assistant",
        "message_type": "edit_result",
        "dress_id": dress_id,
        "image_url": image_to_edit,
        "edited_image_url": result.get("edited_image_url"),
        "parsed_data": {
            "applied": applied,
            "ignored": ignored,
            "confidence": confidence,
            "raw_instruction": parsed.get("raw_instruction"),
            "normalized_instruction": parsed.get("normalized_instruction"),
        },
        "metadata": result
    })

    return {
        "dress_id": dress_id,
        "original_image_url": image_to_edit,
        "edited_image_url": result.get("edited_image_url"),
        "parsed_edits": applied,
        "ignored": ignored,
        "confidence": confidence,
    }
