from fastapi.testclient import TestClient

from app.dependencies import require_admin_user
from app.main import create_app


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
