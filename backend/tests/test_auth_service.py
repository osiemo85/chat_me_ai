from app.services import auth_service


def test_hash_password_roundtrip() -> None:
    password_hash = auth_service.hash_password("super-secret")

    assert auth_service.verify_password("super-secret", password_hash)
    assert not auth_service.verify_password("wrong-password", password_hash)


def test_verify_password_rejects_invalid_hash() -> None:
    assert not auth_service.verify_password("super-secret", "invalid-hash")


def test_authenticate_google_user_upgrades_manual_account(monkeypatch) -> None:
    executed: list[tuple[str, tuple[object, ...] | None]] = []

    class FakeCursor:
        def execute(self, query: str, params: tuple[object, ...] | None = None) -> None:
            executed.append((query, params))

        def fetchone(self) -> dict[str, object]:
            return {
                "id": "user-1",
                "first_name": "Ada",
                "last_name": "Manual",
                "email": "ada@example.com",
                "auth_provider": "manual",
            }

        def __enter__(self) -> "FakeCursor":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

    class FakeConnection:
        def cursor(self) -> FakeCursor:
            return FakeCursor()

        def commit(self) -> None:
            executed.append(("commit", None))

        def __enter__(self) -> "FakeConnection":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

    monkeypatch.setattr(auth_service, "ensure_auth_schema", lambda: None)
    monkeypatch.setattr(auth_service, "get_connection", lambda: FakeConnection())
    monkeypatch.setattr(auth_service, "_create_session", lambda connection, user: "session-token")

    session = auth_service.authenticate_google_user(
        email="ada@example.com",
        first_name="Ada",
        last_name="Lovelace",
    )

    assert session.session_token == "session-token"
    assert session.user.email == "ada@example.com"
    assert session.user.auth_provider == "google"
    assert any("update auth_users" in query.lower() for query, _ in executed)
