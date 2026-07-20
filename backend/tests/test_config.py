from app.config import Settings


def test_settings_accept_local_db_type_without_supabase_storage_values() -> None:
    settings = Settings(
        _env_file=None,
        db_type="local",
        database_url="postgresql://postgres:postgres@localhost:5432/chat_me_ai",
    )

    assert settings.db_type == "local"
    assert settings.database_url == "postgresql://postgres:postgres@localhost:5432/chat_me_ai"
    assert settings.supabase_url is None
    assert settings.supabase_key is None
    assert settings.supabase_bucket is None


def test_settings_accept_local_storage_type() -> None:
    settings = Settings(
        _env_file=None,
        db_type="local",
        database_url="postgresql://postgres:postgres@localhost:5432/chat_me_ai",
        STORAGE_TYPE="local",
        local_storage_dir="storage/profile_assets",
        backend_origin="http://localhost:8000",
    )

    assert settings.storage_type == "local"
    assert settings.local_storage_dir == "storage/profile_assets"
    assert settings.backend_origin == "http://localhost:8000"


def test_settings_accept_legacy_storage_typ_env_alias() -> None:
    settings = Settings(
        _env_file=None,
        db_type="local",
        database_url="postgresql://postgres:postgres@localhost:5432/chat_me_ai",
        STORAGE_TYP="local",
    )

    assert settings.storage_type == "local"
