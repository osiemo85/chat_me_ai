"""Profile asset storage helpers."""

from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

from supabase import Client, create_client
from storage3.exceptions import StorageApiError

from ..config import get_settings


def _require_supabase_storage_settings() -> tuple[str, str, str]:
    settings = get_settings()
    missing = [
        name
        for name, value in {
            "SUPABASE_URL": settings.supabase_url,
            "SUPABASE_KEY": settings.supabase_key,
            "SUPABASE_BUCKET": settings.supabase_bucket,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Supabase storage is not configured. Missing: "
            + ", ".join(missing)
            + "."
        )

    return (
        str(settings.supabase_url),
        str(settings.supabase_key),
        str(settings.supabase_bucket),
    )


def _local_storage_root() -> Path:
    settings = get_settings()
    return Path(settings.local_storage_dir).expanduser().resolve()


def _resolve_local_storage_path(path: str) -> Path:
    cleaned_path = path.strip().lstrip("/")
    if not cleaned_path:
        raise ValueError("Storage path is required.")

    root = _local_storage_root()
    resolved = (root / cleaned_path).resolve()
    if root != resolved and root not in resolved.parents:
        raise ValueError("Storage path escapes the configured local storage directory.")

    return resolved


def get_storage_bucket_name() -> str:
    """Return the database bucket label for the configured storage backend."""

    settings = get_settings()
    if settings.storage_type == "local":
        return "local"

    _, _, supabase_bucket = _require_supabase_storage_settings()
    return supabase_bucket


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """Return a cached Supabase client."""

    supabase_url, supabase_key, _ = _require_supabase_storage_settings()
    return create_client(supabase_url, supabase_key)


def ensure_bucket_exists() -> None:
    """Create the configured storage target if it does not already exist."""

    settings = get_settings()
    if settings.storage_type == "local":
        _local_storage_root().mkdir(parents=True, exist_ok=True)
        return

    _, _, supabase_bucket = _require_supabase_storage_settings()
    client = get_supabase_client()
    buckets = client.storage.list_buckets()

    if any(
        getattr(bucket, "name", None) == supabase_bucket
        or (isinstance(bucket, dict) and bucket.get("name") == supabase_bucket)
        for bucket in buckets
    ):
        return

    client.storage.create_bucket(
        supabase_bucket,
        options={
            "public": False,
            "allowed_mime_types": [
                "application/pdf",
                "image/jpeg",
                "image/png",
                "image/webp",
            ],
            "file_size_limit": str(settings.max_upload_bytes),
        },
    )


def upload_file(*, path: str, content: bytes, content_type: str) -> None:
    """Upload a file into the configured storage backend."""

    if get_settings().storage_type == "local":
        target_path = _resolve_local_storage_path(path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(content)
        return

    _, _, supabase_bucket = _require_supabase_storage_settings()
    client = get_supabase_client()
    client.storage.from_(supabase_bucket).upload(
        path=path,
        file=content,
        file_options={
            "cache-control": "3600",
            "content-type": content_type,
            "upsert": "false",
        },
    )


def create_signed_url(path: str, expires_in: int = 3600) -> str:
    """Create a URL for a private asset."""

    settings = get_settings()
    if settings.storage_type == "local":
        encoded_path = quote(path.strip().lstrip("/"), safe="/")
        return f"{settings.backend_origin.rstrip('/')}/api/v1/profiles/assets/{encoded_path}"

    _, _, supabase_bucket = _require_supabase_storage_settings()
    client = get_supabase_client()
    try:
        response = client.storage.from_(supabase_bucket).create_signed_url(
            path,
            expires_in,
        )
    except StorageApiError as exc:
        if "object not found" in str(exc).lower():
            return ""
        raise

    return response.get("signedURL") or response.get("signed_url") or ""


def remove_files(paths: list[str]) -> None:
    """Delete files from the configured storage backend."""

    if not paths:
        return

    if get_settings().storage_type == "local":
        for path in paths:
            target_path = _resolve_local_storage_path(path)
            if target_path.exists() and target_path.is_file():
                target_path.unlink()
        return

    _, _, supabase_bucket = _require_supabase_storage_settings()
    client = get_supabase_client()
    client.storage.from_(supabase_bucket).remove(paths)


def resolve_local_asset_path(path: str) -> Path:
    """Resolve a local asset path for API serving."""

    if get_settings().storage_type != "local":
        raise RuntimeError("Local storage is not enabled.")

    return _resolve_local_storage_path(path)
