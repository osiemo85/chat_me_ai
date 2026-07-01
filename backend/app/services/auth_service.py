"""Authentication and session management."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import secrets
from uuid import uuid4

from psycopg import Connection

from ..config import get_settings
from ..db import get_connection

AUTH_SCHEMA_SQL = """
create table if not exists auth_users (
  id uuid primary key,
  first_name varchar(100) not null,
  last_name varchar(100) not null,
  email varchar(255) not null unique,
  auth_provider varchar(20) not null default 'manual',
  password_hash text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists auth_sessions (
  id uuid primary key,
  user_id uuid not null references auth_users(id) on delete cascade,
  token_hash varchar(64) not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null
);

create index if not exists auth_sessions_user_lookup_idx
  on auth_sessions (user_id, expires_at);

alter table auth_users
  add column if not exists auth_provider varchar(20) not null default 'manual';

update auth_users
set auth_provider = 'manual'
where auth_provider is null or auth_provider = '';
"""


class AuthError(Exception):
    """Base authentication error."""


class InvalidCredentialsError(AuthError):
    """Raised when the provided credentials do not match any user."""


class DuplicateUserError(AuthError):
    """Raised when a user already exists for an email address."""


@dataclass(slots=True)
class AuthenticatedUser:
    """Current authenticated user details."""

    id: str
    first_name: str
    last_name: str
    email: str
    auth_provider: str


@dataclass(slots=True)
class AuthSession:
    """Authenticated session details and cookie token."""

    session_token: str
    user: AuthenticatedUser


def _now() -> datetime:
    return datetime.now(UTC)


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _normalize_name(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Name fields are required.")
    return cleaned


def _password_digest(password: str, salt: str, iterations: int) -> str:
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    )
    return derived_key.hex()


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256."""

    settings = get_settings()
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")

    salt = secrets.token_hex(16)
    iterations = settings.auth_password_iterations
    digest = _password_digest(password, salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored PBKDF2 hash."""

    try:
        algorithm, iterations_text, salt, expected_digest = stored_hash.split("$", 3)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    digest = _password_digest(password, salt, int(iterations_text))
    return hmac.compare_digest(digest, expected_digest)


def _session_expires_at() -> datetime:
    settings = get_settings()
    return _now() + timedelta(days=settings.auth_session_days)


def _hash_session_token(session_token: str) -> str:
    return hashlib.sha256(session_token.encode("utf-8")).hexdigest()


def ensure_auth_schema() -> None:
    """Ensure authentication tables exist."""

    with get_connection(autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(AUTH_SCHEMA_SQL)


def _user_from_row(row: dict[str, object]) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=str(row["id"]),
        first_name=str(row["first_name"]),
        last_name=str(row["last_name"]),
        email=str(row["email"]),
        auth_provider=str(row["auth_provider"]),
    )


def _create_session(connection: Connection, user: AuthenticatedUser) -> str:
    session_token = secrets.token_urlsafe(32)

    with connection.cursor() as cursor:
        cursor.execute(
            """
            insert into auth_sessions (id, user_id, token_hash, expires_at, created_at)
            values (%s, %s, %s, %s, %s)
            """,
            (
                str(uuid4()),
                user.id,
                _hash_session_token(session_token),
                _session_expires_at(),
                _now(),
            ),
        )

    return session_token


def register_user(*, first_name: str, last_name: str, email: str, password: str) -> AuthSession:
    """Create a user and return a fresh authenticated session."""

    ensure_auth_schema()
    normalized_email = _normalize_email(email)
    normalized_first_name = _normalize_name(first_name)
    normalized_last_name = _normalize_name(last_name)
    password_hash = hash_password(password)
    now = _now()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "select id from auth_users where email = %s limit 1",
                (normalized_email,),
            )
            if cursor.fetchone():
                raise DuplicateUserError("An account with this email already exists.")

            user_id = str(uuid4())
            cursor.execute(
                """
                insert into auth_users (
                  id,
                  first_name,
                  last_name,
                  email,
                  auth_provider,
                  password_hash,
                  created_at,
                  updated_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id,
                    normalized_first_name,
                    normalized_last_name,
                    normalized_email,
                    "manual",
                    password_hash,
                    now,
                    now,
                ),
            )
            user = AuthenticatedUser(
                id=user_id,
                first_name=normalized_first_name,
                last_name=normalized_last_name,
                email=normalized_email,
                auth_provider="manual",
            )
            session_token = _create_session(connection, user)
        connection.commit()

    return AuthSession(session_token=session_token, user=user)


def authenticate_user(*, email: str, password: str) -> AuthSession:
    """Validate credentials and create an authenticated session."""

    ensure_auth_schema()
    normalized_email = _normalize_email(email)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select id, first_name, last_name, email, auth_provider, password_hash
                from auth_users
                where email = %s
                limit 1
                """,
                (normalized_email,),
            )
            row = cursor.fetchone()

            if not row or not verify_password(password, str(row["password_hash"])):
                raise InvalidCredentialsError("Invalid email or password.")

            user = _user_from_row(row)
            session_token = _create_session(connection, user)
        connection.commit()

    return AuthSession(session_token=session_token, user=user)


def authenticate_google_user(*, email: str, first_name: str, last_name: str) -> AuthSession:
    """Create or authenticate a Google-backed user and return a fresh session."""

    ensure_auth_schema()
    normalized_email = _normalize_email(email)
    normalized_first_name = _normalize_name(first_name)
    normalized_last_name = _normalize_name(last_name)
    now = _now()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select id, first_name, last_name, email, auth_provider
                from auth_users
                where email = %s
                limit 1
                """,
                (normalized_email,),
            )
            row = cursor.fetchone()

            if row:
                user = _user_from_row(row)
                if (
                    user.auth_provider != "google"
                    or user.first_name != normalized_first_name
                    or user.last_name != normalized_last_name
                ):
                    # A verified Google login can safely claim an existing manual account
                    # with the same email and keep the existing password intact.
                    cursor.execute(
                        """
                        update auth_users
                        set first_name = %s, last_name = %s, auth_provider = %s, updated_at = %s
                        where id = %s
                        """,
                        (
                            normalized_first_name,
                            normalized_last_name,
                            "google",
                            now,
                            user.id,
                        ),
                    )
                    user = AuthenticatedUser(
                        id=user.id,
                        first_name=normalized_first_name,
                        last_name=normalized_last_name,
                        email=normalized_email,
                        auth_provider="google",
                    )
            else:
                user_id = str(uuid4())
                cursor.execute(
                    """
                    insert into auth_users (
                      id,
                      first_name,
                      last_name,
                      email,
                      auth_provider,
                      password_hash,
                      created_at,
                      updated_at
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        normalized_first_name,
                        normalized_last_name,
                        normalized_email,
                        "google",
                        "",
                        now,
                        now,
                    ),
                )
                user = AuthenticatedUser(
                    id=user_id,
                    first_name=normalized_first_name,
                    last_name=normalized_last_name,
                    email=normalized_email,
                    auth_provider="google",
                )

            session_token = _create_session(connection, user)
        connection.commit()

    return AuthSession(session_token=session_token, user=user)


def get_authenticated_user(session_token: str) -> AuthenticatedUser | None:
    """Return the authenticated user for a live session cookie."""

    ensure_auth_schema()
    token_hash = _hash_session_token(session_token)
    now = _now()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("delete from auth_sessions where expires_at <= %s", (now,))
            cursor.execute(
                """
                select u.id, u.first_name, u.last_name, u.email, u.auth_provider
                from auth_sessions s
                join auth_users u on u.id = s.user_id
                where s.token_hash = %s
                  and s.expires_at > %s
                limit 1
                """,
                (token_hash, now),
            )
            row = cursor.fetchone()
        connection.commit()

    if not row:
        return None

    return _user_from_row(row)


def delete_session(session_token: str) -> None:
    """Delete an authenticated session token if it exists."""

    ensure_auth_schema()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "delete from auth_sessions where token_hash = %s",
                (_hash_session_token(session_token),),
            )
        connection.commit()
