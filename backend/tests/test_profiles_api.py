from fastapi.testclient import TestClient

from app.dependencies import require_authenticated_user
from app.main import create_app


def test_read_current_editable_profile(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.profiles.get_current_editable_profile_for_user",
        lambda user_id: {
            "firstName": "Ada",
            "secondName": "Lovelace",
            "email": "ada@example.com",
            "contactEmail": "hello@ada.dev",
            "contactPhone": "+254 700 000 000",
            "githubUrl": "https://github.com/ada",
            "linkedinUrl": "https://linkedin.com/in/ada",
            "otherUrl": None,
            "persona": "Professional",
            "publicProfileId": "twin_123",
            "cvFileName": "ada-cv.pdf",
            "passportFileName": "ada-passport.png",
        },
    )
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    app = create_app()
    app.dependency_overrides[require_authenticated_user] = lambda: type(
        "User", (), {"id": "user-1"}
    )()
    client = TestClient(app)
    response = client.get("/api/v1/profiles/edit/me")

    assert response.status_code == 200
    payload = response.json()
    assert payload["publicProfileId"] == "twin_123"
    assert payload["cvFileName"] == "ada-cv.pdf"
    assert payload["passportFileName"] == "ada-passport.png"
    assert payload["contactEmail"] == "hello@ada.dev"
    assert payload["contactPhone"] == "+254 700 000 000"


def test_read_public_profile_includes_public_contact_details(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.profiles.get_public_profile",
        lambda public_profile_id: {
            "firstName": "Ada",
            "secondName": "Lovelace",
            "contactEmail": "hello@ada.dev",
            "contactPhone": "+254 700 000 000",
            "githubUrl": None,
            "linkedinUrl": None,
            "otherUrl": None,
            "passportUrl": None,
            "persona": "Professional",
            "publicProfileId": public_profile_id,
            "uploadStatus": "completed",
            "cvProcessingStatus": "completed",
        },
    )
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    client = TestClient(create_app())
    response = client.get("/api/v1/profiles/public/twin_123")

    assert response.status_code == 200
    payload = response.json()
    assert payload["contactEmail"] == "hello@ada.dev"
    assert payload["contactPhone"] == "+254 700 000 000"


def test_read_current_editable_profile_returns_not_found(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.profiles.get_current_editable_profile_for_user",
        lambda user_id: None,
    )
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    app = create_app()
    app.dependency_overrides[require_authenticated_user] = lambda: type(
        "User", (), {"id": "user-1"}
    )()
    client = TestClient(app)
    response = client.get("/api/v1/profiles/edit/me")

    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found."
