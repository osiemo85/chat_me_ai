from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.auth import AuthSessionResponse
from app.services.auth_service import (
    AuthSession,
    AuthenticatedUser,
    InvalidCredentialsError,
)


def _session() -> AuthSession:
    return AuthSession(
        session_token="session-token",
        user=AuthenticatedUser(
            id="user-1",
            first_name="Ada",
            last_name="Lovelace",
            email="ada@example.com",
            auth_provider="manual",
        ),
    )


def test_register_sets_cookie(monkeypatch) -> None:
    monkeypatch.setattr("app.api.v1.auth.register_user", lambda **_: _session())
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    client = TestClient(create_app())
    response = client.post(
        "/api/v1/auth/register",
        json={
            "firstName": "Ada",
            "lastName": "Lovelace",
            "email": "ada@example.com",
            "password": "super-secret",
        },
    )

    assert response.status_code == 201
    payload = AuthSessionResponse.model_validate(response.json())
    assert payload.user.email == "ada@example.com"
    assert payload.user.authProvider == "manual"
    assert "chat_me_ai_session=" in response.headers["set-cookie"]


def test_login_returns_unauthorized_for_bad_credentials(monkeypatch) -> None:
    def raise_invalid(**_: str) -> AuthSession:
        raise InvalidCredentialsError("Invalid email or password.")

    monkeypatch.setattr("app.api.v1.auth.authenticate_user", raise_invalid)
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    client = TestClient(create_app())
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "bad-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_google_exchange_sets_cookie(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.auth._exchange_google_code",
        lambda code, redirect_uri: {"access_token": "google-token"},
    )
    monkeypatch.setattr(
        "app.api.v1.auth._fetch_google_userinfo",
        lambda access_token: {
            "email": "ada@example.com",
            "email_verified": True,
            "given_name": "Ada",
            "family_name": "Lovelace",
        },
    )
    monkeypatch.setattr("app.api.v1.auth.authenticate_google_user", lambda **_: _session())
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    client = TestClient(create_app())
    response = client.post(
        "/api/v1/auth/google/exchange",
        json={
            "code": "google-auth-code",
            "redirectUri": "http://localhost:3000/auth/google/callback",
        },
    )

    assert response.status_code == 200
    payload = AuthSessionResponse.model_validate(response.json())
    assert payload.user.email == "ada@example.com"
    assert "chat_me_ai_session=" in response.headers["set-cookie"]


def test_auth_status_returns_false_without_session(monkeypatch) -> None:
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    client = TestClient(create_app())
    response = client.get("/api/v1/auth/status")

    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "user": None}


def test_auth_status_returns_user_with_valid_session(monkeypatch) -> None:
    monkeypatch.setattr("app.api.v1.auth.get_authenticated_user", lambda token: _session().user)
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    client = TestClient(create_app())
    client.cookies.set("chat_me_ai_session", "session-token")
    response = client.get("/api/v1/auth/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["authenticated"] is True
    assert payload["user"]["email"] == "ada@example.com"
