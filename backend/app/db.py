"""Database helpers for Aiven Postgres."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from psycopg import Connection, connect
from psycopg.rows import dict_row

from .config import get_settings


@contextmanager
def get_connection(autocommit: bool = False) -> Iterator[Connection]:
    """Yield a psycopg connection configured for Aiven Postgres."""

    settings = get_settings()
    connection = connect(
        settings.aiven_service_url,
        autocommit=autocommit,
        row_factory=dict_row,
        sslmode="require",
    )

    try:
        yield connection
    finally:
        connection.close()
