from functools import lru_cache

from app.repositories.session_store import SupabaseSessionStore
from app.services.chat_orchestrator import ChatOrchestrator
from app.services.intent_router import IntentRouter
from app.services.recommendation_service import RecommendationService
from app.services.replicate_service import ReplicateService


@lru_cache
def get_session_store() -> SupabaseSessionStore:
    return SupabaseSessionStore()


@lru_cache
def get_replicate_service() -> ReplicateService:
    return ReplicateService()


@lru_cache
def get_recommendation_service() -> RecommendationService:
    return RecommendationService()


@lru_cache
def get_intent_router() -> IntentRouter:
    return IntentRouter(get_replicate_service())


@lru_cache
def get_chat_orchestrator() -> ChatOrchestrator:
    return ChatOrchestrator(
        session_store=get_session_store(),
        intent_router=get_intent_router(),
        recommendation_service=get_recommendation_service(),
        replicate_service=get_replicate_service(),
    )
