from fastapi.testclient import TestClient

from app.dependencies import require_admin_user
from app.main import create_app
from app.services import admin_service


def test_read_admin_dashboard_returns_payload(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.admin.get_admin_dashboard_data",
        lambda: {
            "summary": {
                "totalUsers": 2,
                "totalTwins": 1,
                "totalRequests": 9,
                "totalTokens": 1200,
                "totalCost": 0.75,
            },
            "users": [
                {
                    "userId": "user-1",
                    "firstName": "Ada",
                    "lastName": "Lovelace",
                    "email": "ada@example.com",
                    "authProvider": "manual",
                    "publicProfileId": "twin_123",
                    "publicTwinUrl": "http://localhost:3000/twin/ada-lovelace-twin_123",
                    "persona": "Professional",
                    "uploadStatus": "completed",
                    "cvProcessingStatus": "completed",
                    "totalRequests": 9,
                    "totalTokens": 1200,
                    "totalCost": 0.75,
                    "createdAt": "2026-07-02T10:00:00Z",
                    "lastActivityAt": "2026-07-02T11:00:00Z",
                }
            ],
            "usage": [
                {
                    "userId": "user-1",
                    "email": "ada@example.com",
                    "publicProfileId": "twin_123",
                    "publicTwinUrl": "http://localhost:3000/twin/ada-lovelace-twin_123",
                    "requestsSent": 9,
                    "promptTokens": 800,
                    "completionTokens": 400,
                    "totalTokens": 1200,
                    "totalCost": 0.75,
                    "lastRequestAt": "2026-07-02T11:00:00Z",
                }
            ],
            "subscriptions": [
                {
                    "userId": "user-1",
                    "email": "ada@example.com",
                    "publicProfileId": "twin_123",
                    "publicTwinUrl": "http://localhost:3000/twin/ada-lovelace-twin_123",
                    "status": "active",
                    "planLabel": "KES 5 yearly",
                    "freePublicChatsUsed": 1,
                    "freePublicChatsLimit": 2,
                    "accessStartsAt": "2026-07-01T10:00:00Z",
                    "accessExpiresAt": "2027-07-01T10:00:00Z",
                    "manualAccessGrantedByEmail": "admin@example.com",
                    "manualAccessGrantedAt": "2026-07-02T11:00:00Z",
                    "updatedAt": "2026-07-02T11:00:00Z",
                }
            ],
        },
    )
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    app = create_app()
    app.dependency_overrides[require_admin_user] = lambda: type("User", (), {"id": "user-1"})()
    client = TestClient(app)
    response = client.get("/api/v1/admin/dashboard")

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["totalTokens"] == 1200
    assert payload["users"][0]["email"] == "ada@example.com"
    assert payload["usage"][0]["publicProfileId"] == "twin_123"
    assert payload["subscriptions"][0]["planLabel"] == "KES 5 yearly"
    assert payload["subscriptions"][0]["manualAccessGrantedByEmail"] == "admin@example.com"


def test_create_manual_access_grant_uses_current_admin_email(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def grant_manual_access(**kwargs):
        captured.update(kwargs)
        return {
            "userId": "user-1",
            "email": "ada@example.com",
            "publicProfileId": "twin_123",
            "status": "active",
            "accessStartsAt": "2026-07-23T10:00:00Z",
            "accessExpiresAt": "2026-07-25T10:00:00Z",
            "manualAccessGrantedByEmail": "admin@example.com",
            "manualAccessGrantedAt": "2026-07-23T10:00:00Z",
        }

    monkeypatch.setattr("app.api.v1.admin.grant_manual_access", grant_manual_access)
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    app = create_app()
    app.dependency_overrides[require_admin_user] = lambda: type(
        "User",
        (),
        {"id": "admin-1", "email": "Admin@Example.com"},
    )()
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/access-grants",
        json={"userId": "user-1", "duration": "2_days"},
    )

    assert response.status_code == 200
    assert captured["user_id"] == "user-1"
    assert captured["duration"] == "2_days"
    assert captured["granted_by_email"] == "Admin@Example.com"
    assert response.json()["manualAccessGrantedByEmail"] == "admin@example.com"


def test_create_manual_access_grant_rejects_missing_custom_date(monkeypatch) -> None:
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    app = create_app()
    app.dependency_overrides[require_admin_user] = lambda: type(
        "User",
        (),
        {"id": "admin-1", "email": "admin@example.com"},
    )()
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/access-grants",
        json={"userId": "user-1", "duration": "custom"},
    )

    assert response.status_code == 422


def test_manual_access_duration_extends_existing_future_expiry() -> None:
    now = admin_service.datetime.fromisoformat("2026-07-23T10:00:00+00:00")
    current_expiry = admin_service.datetime.fromisoformat("2026-07-25T10:00:00+00:00")

    expires_at = admin_service._resolve_manual_access_expires_at(
        current_expires_at=current_expiry,
        duration="2_days",
        custom_expires_at=None,
        now=now,
    )

    assert expires_at.isoformat() == "2026-07-27T10:00:00+00:00"


def test_manual_custom_access_does_not_shorten_existing_future_expiry() -> None:
    now = admin_service.datetime.fromisoformat("2026-07-23T10:00:00+00:00")
    current_expiry = admin_service.datetime.fromisoformat("2026-08-23T10:00:00+00:00")
    custom_expiry = admin_service.datetime.fromisoformat("2026-07-30T10:00:00+00:00")

    expires_at = admin_service._resolve_manual_access_expires_at(
        current_expires_at=current_expiry,
        duration="custom",
        custom_expires_at=custom_expiry,
        now=now,
    )

    assert expires_at.isoformat() == "2026-08-23T10:00:00+00:00"
