"""Backend configuration."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from backend/.env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    aiven_service_url: str
    supabase_bucket: str
    supabase_key: str
    supabase_url: str
    openrouter_api_key: str | None = None
    embedding_model: str | None = None
    chat_model_name: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    chat_temperature: float = 0.3
    chat_top_p: float = 1.0
    chat_max_tokens: int = 16_384
    chat_reasoning_budget: int = 16_384
    retrieval_top_k: int = 4
    retrieval_min_score: float = 0.2
    frontend_origin: str = "http://localhost:3000"
    max_upload_bytes: int = 10 * 1024 * 1024
    chunk_overlap: int = 200
    chunk_size: int = 1200


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings."""

    return Settings()
