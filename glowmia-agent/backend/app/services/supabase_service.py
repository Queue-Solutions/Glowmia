from supabase import Client, create_client
from app.config import get_settings

settings = get_settings()

supabase: Client = create_client(settings.supabase_url, settings.supabase_key)


def fetch_all_dresses():
    response = (
        supabase.table("dresses")
        .select("*")
        .order("created_at", desc=False)
        .execute()
    )
    return response.data if response.data else []