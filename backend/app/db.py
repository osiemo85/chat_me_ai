"""Database helpers for the configured PostgreSQL provider."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator
from urllib.parse import parse_qs, urlparse

from psycopg import Connection, connect
from psycopg.rows import dict_row

from .config import get_settings


@contextmanager
def get_connection(autocommit: bool = False) -> Iterator[Connection]:
    """Yield a TLS-enabled psycopg connection for the configured database.

    Supabase transaction poolers (port 6543) do not support prepared
    statements. psycopg otherwise starts preparing repeated statements by
    default, so explicitly disable that behavior for this endpoint.
    """

    settings = get_settings()
    if settings.db_type in {"local", "supabase"}:
        database_url = settings.database_url
    elif settings.db_type == "aiven":
        database_url = settings.aiven_service_url or settings.database_url
    else:  # pragma: no cover - Literal validation normally catches this.
        raise ValueError(f"Unsupported DB_TYPE: {settings.db_type}")

    if not database_url:
        setting_name = (
            "DATABASE_URL"
            if settings.db_type in {"local", "supabase"}
            else "AIVEN_SERVICE_URL"
        )
        raise RuntimeError(f"{setting_name} must be configured for DB_TYPE={settings.db_type}.")

    parsed_url = urlparse(database_url)
    query = parse_qs(parsed_url.query)
    default_sslmode = "disable" if settings.db_type == "local" else "require"
    connection_options: dict[str, object] = {
        "autocommit": autocommit,
        "row_factory": dict_row,
        "sslmode": query.get("sslmode", [default_sslmode])[0],
    }
    if parsed_url.port == 6543:
        connection_options["prepare_threshold"] = None

    connection = connect(
        database_url,
        **connection_options,
    )

    try:
        yield connection
    finally:
        connection.close()
