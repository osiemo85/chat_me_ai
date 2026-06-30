"""Supabase storage helpers."""

from functools import lru_cache

from supabase import Client, create_client

from ..config import get_settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """Return a cached Supabase client."""

    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_key)


def ensure_bucket_exists() -> None:
    """Create the configured bucket if it does not already exist."""

    settings = get_settings()
    client = get_supabase_client()
    buckets = client.storage.list_buckets()

    if any(
        getattr(bucket, "name", None) == settings.supabase_bucket
        or (isinstance(bucket, dict) and bucket.get("name") == settings.supabase_bucket)
        for bucket in buckets
    ):
        return

    client.storage.create_bucket(
        settings.supabase_bucket,
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
    """Upload a file into the configured Supabase bucket."""

    settings = get_settings()
    client = get_supabase_client()
    client.storage.from_(settings.supabase_bucket).upload(
        path=path,
        file=content,
        file_options={
            "cache-control": "3600",
            "content-type": content_type,
            "upsert": "false",
        },
    )


def create_signed_url(path: str, expires_in: int = 3600) -> str:
    """Create a signed URL for a private asset."""

    settings = get_settings()
    client = get_supabase_client()
    response = client.storage.from_(settings.supabase_bucket).create_signed_url(
        path,
        expires_in,
    )

    return response.get("signedURL") or response.get("signed_url") or ""


def remove_files(paths: list[str]) -> None:
    """Delete files from the configured Supabase bucket."""

    if not paths:
        return

    settings = get_settings()
    client = get_supabase_client()
    client.storage.from_(settings.supabase_bucket).remove(paths)
