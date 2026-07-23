"""Profile creation, asset storage, and background processing logic."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import os
from secrets import token_hex
from typing import Literal
from uuid import uuid4

from psycopg import Connection
from psycopg.types.json import Jsonb

from ..config import get_settings
from ..db import get_connection
from .auth_service import AuthenticatedUser, ensure_auth_schema
from .chunking_service import chunk_text
from .cv_parser_service import extract_pdf_text
from .embedding_service import embed_texts
from .storage_service import (
    create_signed_url,
    ensure_bucket_exists,
    get_storage_bucket_name,
    remove_files,
    upload_file,
)

AssetType = Literal["cv", "passport_photo"]
Status = Literal["pending", "uploading", "uploaded", "extracting", "chunked", "completed", "failed"]

SCHEMA_SQL = """
create table if not exists candidate_profiles (
  id uuid primary key,
  user_id uuid references auth_users(id) on delete cascade,
  first_name varchar(100) not null,
  second_name varchar(100) not null,
  email varchar(255) not null unique,
  contact_email varchar(255),
  contact_phone varchar(40),
  linkedin_url text,
  github_url text,
  other_url text,
  persona varchar(50) not null,
  public_profile_id varchar(120) not null unique,
  upload_status varchar(30) not null default 'pending',
  cv_processing_status varchar(30) not null default 'pending',
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists profile_assets (
  id uuid primary key,
  candidate_profile_id uuid not null references candidate_profiles(id) on delete cascade,
  asset_type varchar(30) not null,
  original_filename varchar(255) not null,
  content_type varchar(100) not null,
  storage_bucket varchar(100) not null,
  storage_path text not null,
  upload_status varchar(30) not null default 'pending',
  is_current boolean not null default false,
  version integer not null default 1,
  replaced_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists profile_assets_one_current_per_type
  on profile_assets (candidate_profile_id, asset_type)
  where is_current = true;

create table if not exists chunks (
  id uuid primary key,
  candidate_profile_id uuid not null references candidate_profiles(id) on delete cascade,
  profile_asset_id uuid not null references profile_assets(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  embedding_model varchar(120),
  embedding_status varchar(30) not null default 'pending',
  embedding jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null
);

create index if not exists chunks_profile_lookup_idx
  on chunks (candidate_profile_id, profile_asset_id, chunk_index);

create table if not exists chat_usage_events (
  id uuid primary key,
  candidate_profile_id uuid not null references candidate_profiles(id) on delete cascade,
  owner_user_id uuid references auth_users(id) on delete set null,
  owner_email varchar(255) not null,
  public_profile_id varchar(120) not null,
  request_count integer not null default 1,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  total_cost numeric(12, 8) not null default 0,
  model_name varchar(255),
  used_context boolean not null default false,
  source_count integer not null default 0,
  created_at timestamptz not null
);

create index if not exists chat_usage_events_candidate_lookup_idx
  on chat_usage_events (candidate_profile_id, created_at desc);

create index if not exists chat_usage_events_owner_lookup_idx
  on chat_usage_events (owner_user_id, created_at desc);

alter table candidate_profiles
  add column if not exists user_id uuid references auth_users(id) on delete cascade;

alter table candidate_profiles
  add column if not exists contact_email varchar(255);

alter table candidate_profiles
  add column if not exists contact_phone varchar(40);

create unique index if not exists candidate_profiles_user_id_unique
  on candidate_profiles (user_id)
  where user_id is not null;
"""


@dataclass(slots=True)
class UploadedPayload:
    user_id: str
    first_name: str
    second_name: str
    email: str
    contact_email: str | None
    contact_phone: str | None
    linkedin_url: str | None
    github_url: str | None
    other_url: str | None
    persona: str
    cv_content_type: str | None
    cv_filename: str | None
    cv_bytes: bytes | None
    passport_content_type: str | None
    passport_filename: str | None
    passport_bytes: bytes | None


@dataclass(slots=True)
class PreparedSubmission:
    candidate_profile_id: str
    cv_asset_id: str | None
    is_update: bool
    passport_asset_id: str | None
    public_profile_id: str
    requires_processing: bool


def _now() -> datetime:
    return datetime.now(UTC)


def _normalize_optional(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned or None


def _build_public_profile_id() -> str:
    return f"twin_{token_hex(9)}"


def _slugify_filename(filename: str) -> str:
    safe_chars = []

    for character in filename.lower():
        if character.isalnum() or character in {".", "-", "_"}:
            safe_chars.append(character)
        else:
            safe_chars.append("-")

    return "".join(safe_chars).strip("-") or "file"


def _slugify_name_part(value: str) -> str:
    return _slugify_filename(value).replace(".", "-")


def _asset_storage_path(public_profile_id: str, asset_type: AssetType, filename: str) -> str:
    timestamp = int(datetime.now(UTC).timestamp())
    safe_name = _slugify_filename(filename)
    return f"profiles/{public_profile_id}/{asset_type}/{timestamp}-{uuid4()}-{safe_name}"


def ensure_schema() -> None:
    """Ensure database tables and the storage bucket exist."""

    ensure_auth_schema()

    with get_connection(autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(SCHEMA_SQL)

    ensure_bucket_exists()


def _next_asset_version(connection: Connection, candidate_profile_id: str, asset_type: AssetType) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select coalesce(max(version), 0) + 1 as next_version
            from profile_assets
            where candidate_profile_id = %s
              and asset_type = %s
            """,
            (candidate_profile_id, asset_type),
        )
        row = cursor.fetchone()

    return int(row["next_version"]) if row else 1


def _get_or_create_candidate(
    connection: Connection,
    payload: UploadedPayload,
    *,
    reset_processing_status: bool,
) -> tuple[str, str, bool]:
    now = _now()

    with connection.cursor() as cursor:
        cursor.execute(
            """
            select id, public_profile_id
            from candidate_profiles
            where user_id = %s
               or (user_id is null and email = %s)
            for update
            """,
            (payload.user_id, payload.email),
        )
        row = cursor.fetchone()

        if row:
            parts = [
                "user_id = %s",
                "first_name = %s",
                "second_name = %s",
                "contact_email = %s",
                "contact_phone = %s",
                "linkedin_url = %s",
                "github_url = %s",
                "other_url = %s",
                "persona = %s",
            ]
            values: list[object] = [
                payload.user_id,
                payload.first_name,
                payload.second_name,
                payload.contact_email,
                payload.contact_phone,
                payload.linkedin_url,
                payload.github_url,
                payload.other_url,
                payload.persona,
            ]

            if reset_processing_status:
                parts.extend(["upload_status = 'pending'", "cv_processing_status = 'pending'"])

            parts.extend(["last_error = null", "updated_at = %s"])
            values.extend([now, row["id"]])

            cursor.execute(
                f"""
                update candidate_profiles
                set {", ".join(parts)}
                where id = %s
                """,
                values,
            )

            return str(row["id"]), str(row["public_profile_id"]), True

        candidate_profile_id = str(uuid4())
        public_profile_id = _build_public_profile_id()

        cursor.execute(
            """
            insert into candidate_profiles (
              id,
              user_id,
              first_name,
              second_name,
              email,
              contact_email,
              contact_phone,
              linkedin_url,
              github_url,
              other_url,
              persona,
              public_profile_id,
              upload_status,
              cv_processing_status,
              created_at,
              updated_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', 'pending', %s, %s)
            """,
            (
                candidate_profile_id,
                payload.user_id,
                payload.first_name,
                payload.second_name,
                payload.email,
                payload.contact_email,
                payload.contact_phone,
                payload.linkedin_url,
                payload.github_url,
                payload.other_url,
                payload.persona,
                public_profile_id,
                now,
                now,
            ),
        )

        return candidate_profile_id, public_profile_id, False


def _insert_pending_asset(
    connection: Connection,
    *,
    asset_type: AssetType,
    candidate_profile_id: str,
    content_type: str,
    filename: str,
    public_profile_id: str,
) -> str:
    asset_id = str(uuid4())
    now = _now()
    storage_path = _asset_storage_path(public_profile_id, asset_type, filename)
    storage_bucket = get_storage_bucket_name()
    version = _next_asset_version(connection, candidate_profile_id, asset_type)

    with connection.cursor() as cursor:
        cursor.execute(
            """
            insert into profile_assets (
              id,
              candidate_profile_id,
              asset_type,
              original_filename,
              content_type,
              storage_bucket,
              storage_path,
              upload_status,
              is_current,
              version,
              created_at,
              updated_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, 'pending', false, %s, %s, %s)
            """,
            (
                asset_id,
                candidate_profile_id,
                asset_type,
                filename,
                content_type,
                storage_bucket,
                storage_path,
                version,
                now,
                now,
            ),
        )

    return asset_id


def prepare_profile_submission(payload: UploadedPayload) -> PreparedSubmission:
    """Create or update the candidate profile and pending asset rows."""

    ensure_schema()

    has_cv_update = payload.cv_bytes is not None
    has_passport_update = payload.passport_bytes is not None
    requires_processing = has_cv_update or has_passport_update

    with get_connection() as connection:
        candidate_profile_id, public_profile_id, is_update = _get_or_create_candidate(
            connection,
            payload,
            reset_processing_status=requires_processing,
        )
        if not is_update and not requires_processing:
            raise ValueError("A CV PDF and passport photo are required.")

        cv_asset_id = None
        if has_cv_update and payload.cv_content_type and payload.cv_filename:
            cv_asset_id = _insert_pending_asset(
                connection,
                asset_type="cv",
                candidate_profile_id=candidate_profile_id,
                content_type=payload.cv_content_type,
                filename=payload.cv_filename,
                public_profile_id=public_profile_id,
            )

        passport_asset_id = None
        if has_passport_update and payload.passport_content_type and payload.passport_filename:
            passport_asset_id = _insert_pending_asset(
                connection,
                asset_type="passport_photo",
                candidate_profile_id=candidate_profile_id,
                content_type=payload.passport_content_type,
                filename=payload.passport_filename,
                public_profile_id=public_profile_id,
            )
        connection.commit()

    return PreparedSubmission(
        candidate_profile_id=candidate_profile_id,
        cv_asset_id=cv_asset_id,
        is_update=is_update,
        passport_asset_id=passport_asset_id,
        public_profile_id=public_profile_id,
        requires_processing=requires_processing,
    )


def _current_storage_path(connection: Connection, asset_id: str) -> str:
    with connection.cursor() as cursor:
        cursor.execute("select storage_path from profile_assets where id = %s", (asset_id,))
        row = cursor.fetchone()

    if not row:
        raise RuntimeError("Asset record not found.")

    return str(row["storage_path"])


def _content_type_for_asset(connection: Connection, asset_id: str) -> str:
    with connection.cursor() as cursor:
        cursor.execute("select content_type from profile_assets where id = %s", (asset_id,))
        row = cursor.fetchone()

    if not row:
        raise RuntimeError("Asset record not found.")

    return str(row["content_type"])


def _current_asset_row(
    connection: Connection,
    *,
    candidate_profile_id: str,
    asset_type: AssetType,
    exclude_asset_id: str,
) -> dict[str, object] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select id, storage_path
            from profile_assets
            where candidate_profile_id = %s
              and asset_type = %s
              and is_current = true
              and id <> %s
            limit 1
            """,
            (candidate_profile_id, asset_type, exclude_asset_id),
        )
        return cursor.fetchone()


def _replace_current_asset(
    connection: Connection,
    *,
    candidate_profile_id: str,
    asset_id: str,
    asset_type: AssetType,
) -> str | None:
    now = _now()
    old_asset = _current_asset_row(
        connection,
        candidate_profile_id=candidate_profile_id,
        asset_type=asset_type,
        exclude_asset_id=asset_id,
    )

    with connection.cursor() as cursor:
        if old_asset:
            if asset_type == "cv":
                cursor.execute(
                    """
                    delete from chunks
                    where profile_asset_id = %s
                    """,
                    (old_asset["id"],),
                )

            cursor.execute(
                """
                delete from profile_assets
                where id = %s
                """,
                (old_asset["id"],),
            )

        cursor.execute(
            """
            update profile_assets
            set
              upload_status = 'uploaded',
              is_current = true,
              updated_at = %s
            where id = %s
            """,
            (now, asset_id),
        )

    return str(old_asset["storage_path"]) if old_asset else None


def _mark_profile_status(
    connection: Connection,
    candidate_profile_id: str,
    *,
    upload_status: Status | None = None,
    cv_processing_status: Status | None = None,
    last_error: str | None = None,
) -> None:
    parts: list[str] = []
    values: list[object] = []

    if upload_status is not None:
        parts.append("upload_status = %s")
        values.append(upload_status)

    if cv_processing_status is not None:
        parts.append("cv_processing_status = %s")
        values.append(cv_processing_status)

    if last_error is not None:
        parts.append("last_error = %s")
        values.append(last_error)
    elif upload_status is not None or cv_processing_status is not None:
        parts.append("last_error = null")

    parts.append("updated_at = %s")
    values.append(_now())
    values.append(candidate_profile_id)

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            update candidate_profiles
            set {", ".join(parts)}
            where id = %s
            """,
            values,
        )


def _store_chunks(
    connection: Connection,
    *,
    candidate_profile_id: str,
    cv_asset_id: str,
    cv_text: str,
) -> list[tuple[str, str]]:
    settings = get_settings()
    chunks = chunk_text(cv_text, chunk_size=settings.chunk_size, overlap=settings.chunk_overlap)
    now = _now()
    stored_chunks: list[tuple[str, str]] = []

    with connection.cursor() as cursor:
        cursor.execute(
            """
            update chunks
            set is_current = false
            where candidate_profile_id = %s
              and is_current = true
            """,
            (candidate_profile_id,),
        )

        for index, chunk in enumerate(chunks):
            chunk_id = str(uuid4())
            cursor.execute(
                """
                insert into chunks (
                  id,
                  candidate_profile_id,
                  profile_asset_id,
                  chunk_index,
                  chunk_text,
                  embedding_model,
                  embedding_status,
                  embedding,
                  is_current,
                  created_at
                )
                values (%s, %s, %s, %s, %s, null, 'pending', null, true, %s)
                """,
                (chunk_id, candidate_profile_id, cv_asset_id, index, chunk, now),
            )
            stored_chunks.append((chunk_id, chunk))

    return stored_chunks


def _store_embeddings(
    connection: Connection,
    *,
    stored_chunks: list[tuple[str, str]],
    embedding_model: str,
) -> None:
    vectors = embed_texts([chunk_text for _, chunk_text in stored_chunks])

    with connection.cursor() as cursor:
        for (chunk_id, _), vector in zip(stored_chunks, vectors, strict=True):
            cursor.execute(
                """
                update chunks
                set
                  embedding_model = %s,
                  embedding_status = 'completed',
                  embedding = %s
                where id = %s
                """,
                (embedding_model, Jsonb(vector), chunk_id),
            )


def process_profile_submission(
    *,
    candidate_profile_id: str,
    cv_asset_id: str | None,
    cv_bytes: bytes | None,
    passport_asset_id: str | None,
    passport_bytes: bytes | None,
) -> None:
    """Upload assets, extract CV text, and persist chunk content."""

    ensure_schema()

    old_storage_paths: list[str] = []

    try:
        with get_connection() as connection:
            _mark_profile_status(
                connection,
                candidate_profile_id,
                upload_status="uploading",
                cv_processing_status="pending" if cv_asset_id else "completed",
            )
            old_cv_path = None
            old_passport_path = None

            if cv_asset_id and cv_bytes is not None:
                cv_path = _current_storage_path(connection, cv_asset_id)
                cv_content_type = _content_type_for_asset(connection, cv_asset_id)
                upload_file(path=cv_path, content=cv_bytes, content_type=cv_content_type)
                old_cv_path = _replace_current_asset(
                    connection,
                    candidate_profile_id=candidate_profile_id,
                    asset_id=cv_asset_id,
                    asset_type="cv",
                )

            if passport_asset_id and passport_bytes is not None:
                passport_path = _current_storage_path(connection, passport_asset_id)
                passport_content_type = _content_type_for_asset(connection, passport_asset_id)
                upload_file(
                    path=passport_path,
                    content=passport_bytes,
                    content_type=passport_content_type,
                )
                old_passport_path = _replace_current_asset(
                    connection,
                    candidate_profile_id=candidate_profile_id,
                    asset_id=passport_asset_id,
                    asset_type="passport_photo",
                )
            old_storage_paths = [
                path for path in [old_cv_path, old_passport_path] if path
            ]
            _mark_profile_status(
                connection,
                candidate_profile_id,
                upload_status="uploaded",
                cv_processing_status="extracting" if cv_asset_id else "completed",
            )

            if cv_asset_id and cv_bytes is not None:
                cv_text = extract_pdf_text(cv_bytes)
                stored_chunks = _store_chunks(
                    connection,
                    candidate_profile_id=candidate_profile_id,
                    cv_asset_id=cv_asset_id,
                    cv_text=cv_text,
                )
                _mark_profile_status(
                    connection,
                    candidate_profile_id,
                    upload_status="uploaded",
                    cv_processing_status="chunked",
                )
                _mark_profile_status(
                    connection,
                    candidate_profile_id,
                    upload_status="uploaded",
                    cv_processing_status="embedding",
                )
                embedding_model = get_settings().embedding_model
                if not embedding_model:
                    raise RuntimeError("EMBEDDING_MODEL is not configured.")
                _store_embeddings(
                    connection,
                    stored_chunks=stored_chunks,
                    embedding_model=embedding_model,
                )
            _mark_profile_status(
                connection,
                candidate_profile_id,
                upload_status="completed",
                cv_processing_status="completed",
            )
            connection.commit()
        remove_files(old_storage_paths)
    except Exception as exc:
        with get_connection() as retry_connection:
            _mark_profile_status(
                retry_connection,
                candidate_profile_id,
                upload_status="failed",
                cv_processing_status="failed",
                last_error=str(exc),
            )
            now = _now()
            with retry_connection.cursor() as cursor:
                if cv_asset_id:
                    cursor.execute(
                        """
                        update profile_assets
                        set upload_status = 'failed', updated_at = %s
                        where id = %s
                        """,
                        (now, cv_asset_id),
                    )
                if passport_asset_id:
                    cursor.execute(
                        """
                        update profile_assets
                        set upload_status = 'failed', updated_at = %s
                        where id = %s
                        """,
                        (now, passport_asset_id),
                    )
            retry_connection.commit()
        raise


def _editable_profile_query(where_clause: str) -> str:
    return f"""
        select
          cp.first_name,
          cp.second_name,
          cp.email,
          cp.contact_email,
          cp.contact_phone,
          cp.github_url,
          cp.linkedin_url,
          cp.other_url,
          cp.persona,
          cp.public_profile_id,
          cv.original_filename as cv_file_name,
          passport.original_filename as passport_file_name
        from candidate_profiles cp
        left join profile_assets cv
          on cv.candidate_profile_id = cp.id
         and cv.asset_type = 'cv'
         and cv.is_current = true
        left join profile_assets passport
          on passport.candidate_profile_id = cp.id
         and passport.asset_type = 'passport_photo'
         and passport.is_current = true
        where {where_clause}
        limit 1
    """


def get_public_profile(public_profile_id: str) -> dict[str, object] | None:
    """Return the public profile details and current passport image URL."""

    ensure_schema()

    with get_connection(autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                  cp.first_name,
                  cp.second_name,
                  cp.contact_email,
                  cp.contact_phone,
                  cp.github_url,
                  cp.linkedin_url,
                  cp.other_url,
                  cp.persona,
                  cp.public_profile_id,
                  cp.upload_status,
                  cp.cv_processing_status,
                  pa.storage_path as passport_storage_path
                from candidate_profiles cp
                left join profile_assets pa
                  on pa.candidate_profile_id = cp.id
                 and pa.asset_type = 'passport_photo'
                 and pa.is_current = true
                where cp.public_profile_id = %s
                limit 1
                """,
                (public_profile_id,),
            )
            row = cursor.fetchone()

    if not row:
        return None

    passport_url = None
    if row["passport_storage_path"]:
        passport_url = create_signed_url(str(row["passport_storage_path"]))

    return {
        "firstName": row["first_name"],
        "secondName": row["second_name"],
        "contactEmail": row["contact_email"],
        "contactPhone": row["contact_phone"],
        "githubUrl": row["github_url"],
        "linkedinUrl": row["linkedin_url"],
        "otherUrl": row["other_url"],
        "passportUrl": passport_url,
        "persona": row["persona"],
        "publicProfileId": row["public_profile_id"],
        "uploadStatus": row["upload_status"],
        "cvProcessingStatus": row["cv_processing_status"],
    }


def get_editable_profile_for_user(
    public_profile_id: str,
    *,
    user_id: str,
) -> dict[str, object] | None:
    """Return profile fields needed to prepopulate the update form."""

    ensure_schema()

    with get_connection(autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                _editable_profile_query("cp.public_profile_id = %s and cp.user_id = %s"),
                (public_profile_id, user_id),
            )
            row = cursor.fetchone()

    if not row:
        return None

    return {
        "firstName": row["first_name"],
        "secondName": row["second_name"],
        "email": row["email"],
        "contactEmail": row["contact_email"],
        "contactPhone": row["contact_phone"],
        "githubUrl": row["github_url"],
        "linkedinUrl": row["linkedin_url"],
        "otherUrl": row["other_url"],
        "persona": row["persona"],
        "publicProfileId": row["public_profile_id"],
        "publicLink": frontend_public_link(
            first_name=row["first_name"],
            second_name=row["second_name"],
            public_profile_id=row["public_profile_id"],
        ),
        "cvFileName": row["cv_file_name"],
        "passportFileName": row["passport_file_name"],
    }


def get_current_editable_profile_for_user(*, user_id: str) -> dict[str, object] | None:
    """Return the current user's editable profile if one exists."""

    ensure_schema()

    with get_connection(autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(_editable_profile_query("cp.user_id = %s"), (user_id,))
            row = cursor.fetchone()

    if not row:
        return None

    return {
        "firstName": row["first_name"],
        "secondName": row["second_name"],
        "email": row["email"],
        "contactEmail": row["contact_email"],
        "contactPhone": row["contact_phone"],
        "githubUrl": row["github_url"],
        "linkedinUrl": row["linkedin_url"],
        "otherUrl": row["other_url"],
        "persona": row["persona"],
        "publicProfileId": row["public_profile_id"],
        "publicLink": frontend_public_link(
            first_name=row["first_name"],
            second_name=row["second_name"],
            public_profile_id=row["public_profile_id"],
        ),
        "cvFileName": row["cv_file_name"],
        "passportFileName": row["passport_file_name"],
    }


def frontend_public_link(
    *,
    first_name: str,
    second_name: str,
    public_profile_id: str,
) -> str:
    """Return the frontend link for a public profile."""

    settings = get_settings()
    base_url = settings.frontend_origin.rstrip("/")
    name_slug = f"{_slugify_name_part(first_name)}-{_slugify_name_part(second_name)}"
    return f"{base_url}/twin/{name_slug}-{public_profile_id}"


def validate_upload_payload(
    *,
    cv_bytes: bytes,
    cv_content_type: str | None,
    cv_filename: str | None,
    email: str,
    contact_email: str | None,
    contact_phone: str | None,
    first_name: str,
    github_url: str | None,
    linkedin_url: str | None,
    other_url: str | None,
    passport_bytes: bytes,
    passport_content_type: str | None,
    passport_filename: str | None,
    persona: str,
    second_name: str,
    user: AuthenticatedUser,
) -> UploadedPayload:
    """Validate raw upload fields before persisting anything."""

    settings = get_settings()

    if not first_name.strip() or not second_name.strip():
        raise ValueError("First name and second name are required.")

    if not persona.strip():
        raise ValueError("Persona is required.")

    normalized_contact_email = _normalize_optional(contact_email)
    normalized_contact_phone = _normalize_optional(contact_phone)
    if normalized_contact_email and "@" not in normalized_contact_email:
        raise ValueError("Public contact email must be a valid email address.")

    if cv_bytes:
        if cv_content_type != "application/pdf":
            raise ValueError("CV must be a PDF file.")
        if len(cv_bytes) > settings.max_upload_bytes:
            raise ValueError("CV exceeds the maximum upload size.")

    if passport_bytes:
        allowed_passport_types = {"image/jpeg", "image/png", "image/webp"}
        if passport_content_type not in allowed_passport_types:
            raise ValueError("Passport photo must be JPEG, PNG, or WebP.")
        if len(passport_bytes) > settings.max_upload_bytes:
            raise ValueError("Passport photo exceeds the maximum upload size.")

    return UploadedPayload(
        user_id=user.id,
        first_name=first_name.strip(),
        second_name=second_name.strip(),
        email=user.email,
        contact_email=normalized_contact_email,
        contact_phone=normalized_contact_phone,
        linkedin_url=_normalize_optional(linkedin_url),
        github_url=_normalize_optional(github_url),
        other_url=_normalize_optional(other_url),
        persona=persona.strip(),
        cv_content_type=cv_content_type,
        cv_filename=os.path.basename(cv_filename) if cv_filename else None,
        cv_bytes=cv_bytes or None,
        passport_content_type=passport_content_type,
        passport_filename=os.path.basename(passport_filename) if passport_filename else None,
        passport_bytes=passport_bytes or None,
    )
