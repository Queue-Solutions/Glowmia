from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = Field(default="Glowmia AI Agent", alias="APP_NAME")
    app_host: str = Field(default="127.0.0.1", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_key: str = Field(default="", alias="SUPABASE_KEY")
    replicate_api_token: str = Field(default="", alias="REPLICATE_API_TOKEN")
    replicate_model: str = Field(default="", alias="REPLICATE_MODEL")
    replicate_llm_model: str = Field(default="", alias="REPLICATE_LLM_MODEL")
    max_recommendations: int = 4
    conversation_window: int = 8
    request_timeout_seconds: float = 60.0

    @field_validator("app_host", mode="before")
    @classmethod
    def default_host(cls, value: str | None) -> str:
        return value or "127.0.0.1"

    @field_validator("app_port", mode="before")
    @classmethod
    def default_port(cls, value: str | int | None) -> int:
        if value in (None, ""):
            return 8000
        return int(value)

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
