from types import SimpleNamespace

import pytest

from app import db


def test_supabase_transaction_pooler_uses_database_url_and_disables_prepared_statements(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeConnection:
        def close(self) -> None:
            captured["closed"] = True

    def fake_connect(url: str, **kwargs: object) -> FakeConnection:
        captured["url"] = url
        captured.update(kwargs)
        return FakeConnection()

    monkeypatch.setattr(db, "get_settings", lambda: SimpleNamespace(
        db_type="supabase",
        database_url="postgresql://postgres.example:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
        aiven_service_url=None,
    ))
    monkeypatch.setattr(db, "connect", fake_connect)

    with db.get_connection(autocommit=True):
        pass

    assert captured["url"].startswith("postgresql://postgres.example")
    assert captured["autocommit"] is True
    assert captured["sslmode"] == "require"
    assert captured["prepare_threshold"] is None
    assert captured["closed"] is True


def test_aiven_connections_remain_supported(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeConnection:
        def close(self) -> None:
            pass

    def fake_connect(url: str, **kwargs: object) -> FakeConnection:
        captured["url"] = url
        captured.update(kwargs)
        return FakeConnection()

    monkeypatch.setattr(db, "get_settings", lambda: SimpleNamespace(
        db_type="aiven",
        database_url=None,
        aiven_service_url="postgresql://aiven.example/postgres",
    ))
    monkeypatch.setattr(db, "connect", fake_connect)

    with db.get_connection():
        pass

    assert captured["url"] == "postgresql://aiven.example/postgres"
    assert "prepare_threshold" not in captured


def test_local_connections_use_database_url(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeConnection:
        def close(self) -> None:
            pass

    def fake_connect(url: str, **kwargs: object) -> FakeConnection:
        captured["url"] = url
        captured.update(kwargs)
        return FakeConnection()

    monkeypatch.setattr(db, "get_settings", lambda: SimpleNamespace(
        db_type="local",
        database_url="postgresql://postgres:postgres@localhost:5432/chat_me_ai",
        aiven_service_url=None,
    ))
    monkeypatch.setattr(db, "connect", fake_connect)

    with db.get_connection():
        pass

    assert captured["url"] == "postgresql://postgres:postgres@localhost:5432/chat_me_ai"
    assert captured["sslmode"] == "disable"
    assert "prepare_threshold" not in captured


def test_missing_supabase_database_url_fails_with_actionable_error(monkeypatch) -> None:
    monkeypatch.setattr(db, "get_settings", lambda: SimpleNamespace(
        db_type="supabase",
        database_url=None,
        aiven_service_url=None,
    ))

    with pytest.raises(RuntimeError, match="DATABASE_URL must be configured"):
        with db.get_connection():
            pass


def test_missing_local_database_url_fails_with_actionable_error(monkeypatch) -> None:
    monkeypatch.setattr(db, "get_settings", lambda: SimpleNamespace(
        db_type="local",
        database_url=None,
        aiven_service_url=None,
    ))

    with pytest.raises(RuntimeError, match="DATABASE_URL must be configured"):
        with db.get_connection():
            pass
