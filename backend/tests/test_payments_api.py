from fastapi.testclient import TestClient

from app.dependencies import require_authenticated_user
from app.main import create_app


def _user():
    return type("User", (), {"id": "user-1", "email": "ada@example.com"})()


def test_read_billing_status_defaults_to_inactive(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.payments.get_billing_status_for_user",
        lambda user_id: {
            "status": "inactive",
            "freePublicChatsUsed": 0,
            "freePublicChatsLimit": 2,
            "accessStartsAt": None,
            "accessExpiresAt": None,
            "hostedPlanUrl": "https://paystack.shop/pay/pj14u6z8jv",
            "paymentRequired": True,
            "planLabel": "KES 5 yearly",
            "currency": "KES",
            "amountDisplay": "KES 5",
        },
    )

    app = create_app()
    app.dependency_overrides[require_authenticated_user] = _user
    client = TestClient(app)

    response = client.get("/api/v1/payments/me")

    assert response.status_code == 200
    assert response.json()["status"] == "inactive"
    assert response.json()["freePublicChatsUsed"] == 0
    assert response.json()["freePublicChatsLimit"] == 2


def test_verify_paystack_transaction_endpoint_returns_active_status(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.payments.verify_paystack_transaction",
        lambda reference, user_id: {
            "status": "active",
            "accessStartsAt": "2026-07-02T10:00:00+00:00",
            "accessExpiresAt": "2027-07-02T10:00:00+00:00",
            "reference": reference,
        },
    )

    app = create_app()
    app.dependency_overrides[require_authenticated_user] = _user
    client = TestClient(app)

    response = client.post(
        "/api/v1/payments/paystack/verify",
        json={"reference": "paystack-ref-123"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "active"
    assert payload["reference"] == "paystack-ref-123"


def test_paystack_webhook_rejects_invalid_signature(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.payments.process_paystack_webhook",
        lambda headers, body: (_ for _ in ()).throw(ValueError("Invalid Paystack signature.")),
    )

    app = create_app()
    client = TestClient(app)

    response = client.post(
        "/api/v1/payments/paystack/webhook",
        headers={"x-paystack-signature": "bad"},
        json={"event": "charge.success", "data": {}},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid Paystack signature."
