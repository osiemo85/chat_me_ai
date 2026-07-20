"""Backend configuration."""

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from backend/.env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ``database_url`` is the canonical connection setting. Keep the Aiven
    # setting for existing deployments that have not switched providers yet.
    db_type: Literal["aiven", "supabase", "local"] = "aiven"
    database_url: str | None = None
    aiven_service_url: str | None = None
    supabase_bucket: str | None = None
    supabase_key: str | None = None
    supabase_url: str | None = None
    storage_type: Literal["supabase", "local"] = Field(
        default="supabase",
        validation_alias=AliasChoices("STORAGE_TYPE", "STORAGE_TYP", "storage_type"),
    )
    local_storage_dir: str = "storage/profile_assets"
    backend_origin: str = "http://localhost:8000"
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
    auth_session_cookie_name: str = "chat_me_ai_session"
    auth_session_days: int = 30
    auth_password_iterations: int = 600000
    google_client_id: str | None = None
    google_client_secret: str | None = None
    paystack_secret_key: str | None = None
    paystack_public_key: str | None = None
    paystack_hosted_plan_url: str = "https://paystack.shop/pay/pj14u6z8jv"
    app_public_base_url: str = "http://localhost:3000"
    free_public_chat_limit: int = 2
    admin_emails: str = ""
    max_upload_bytes: int = 10 * 1024 * 1024
    chunk_overlap: int = 200
    chunk_size: int = 1200


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings."""

    return Settings()
