from contextlib import contextmanager
import hashlib
import hmac
from json import dumps

from app.services import payment_service


class DummyConnection:
    def commit(self) -> None:
        return None


@contextmanager
def _dummy_connection():
    yield DummyConnection()


def test_get_billing_status_for_new_owner_defaults_to_inactive(monkeypatch) -> None:
    monkeypatch.setattr(payment_service, "ensure_payment_schema", lambda: None)
    monkeypatch.setattr(payment_service, "get_connection", _dummy_connection)
    monkeypatch.setattr(payment_service, "_candidate_for_user", lambda connection, user_id: None)
    monkeypatch.setattr(
        payment_service,
        "get_settings",
        lambda: type("Settings", (), {"free_public_chat_limit": 2, "paystack_hosted_plan_url": "https://paystack.shop/pay/pj14u6z8jv"})(),
    )

    status = payment_service.get_billing_status_for_user("user-1")

    assert status["status"] == "inactive"
    assert status["freePublicChatsUsed"] == 0
    assert status["freePublicChatsLimit"] == 2
    assert status["paymentRequired"] is True


def test_free_public_chat_limit_uses_configured_value(monkeypatch) -> None:
    monkeypatch.setattr(
        payment_service,
        "get_settings",
        lambda: type("Settings", (), {"free_public_chat_limit": 5})(),
    )

    assert payment_service._free_public_chat_limit() == 5


def test_verify_paystack_transaction_updates_billing_on_success(monkeypatch) -> None:
    monkeypatch.setattr(payment_service, "ensure_payment_schema", lambda: None)
    monkeypatch.setattr(payment_service, "get_connection", _dummy_connection)
    monkeypatch.setattr(
        payment_service,
        "_paystack_api_request",
        lambda url: {
            "status": True,
            "data": {
                "status": "success",
                "paid_at": "2026-07-02T10:00:00Z",
                "next_payment_date": "2027-07-02T10:00:00Z",
                "customer": {"email": "ada@example.com", "customer_code": "CUS_123"},
                "subscription": {
                    "subscription_code": "SUB_123",
                    "email_token": "email_token_123",
                },
                "reference": "paystack-ref-123",
            },
        },
    )
    monkeypatch.setattr(payment_service, "_get_user_email", lambda connection, user_id: "ada@example.com")
    monkeypatch.setattr(
        payment_service,
        "_candidate_for_user",
        lambda connection, user_id: {"id": "candidate-1"},
    )
    monkeypatch.setattr(
        payment_service,
        "_activate_from_payload",
        lambda connection, event_type, data, owner_user_id, candidate_profile_id: {
            "status": "active",
            "access_starts_at": payment_service._parse_datetime(data["paid_at"]),
            "access_expires_at": payment_service._parse_datetime(data["next_payment_date"]),
        },
    )

    result = payment_service.verify_paystack_transaction("paystack-ref-123", "user-1")

    assert result["status"] == "active"
    assert result["reference"] == "paystack-ref-123"
    assert result["accessStartsAt"].isoformat() == "2026-07-02T10:00:00+00:00"


def test_process_paystack_webhook_is_idempotent_for_duplicate_deliveries(monkeypatch) -> None:
    stored_references: dict[str, dict[str, object]] = {}
    payload = {
        "event": "charge.success",
        "data": {
            "reference": "paystack-ref-123",
            "status": "success",
            "paid_at": "2026-07-02T10:00:00Z",
            "customer": {"email": "ada@example.com", "customer_code": "CUS_123"},
            "subscription": {"subscription_code": "SUB_123"},
        },
    }
    body = dumps(payload).encode("utf-8")
    secret = "sk_test_paystack"
    signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha512).hexdigest()

    monkeypatch.setattr(payment_service, "ensure_payment_schema", lambda: None)
    monkeypatch.setattr(payment_service, "get_connection", _dummy_connection)
    monkeypatch.setattr(
        payment_service,
        "_paystack_secret_key",
        lambda: secret,
    )
    monkeypatch.setattr(
        payment_service,
        "_candidate_from_paystack_customer",
        lambda connection, data: ("user-1", "candidate-1", "ada@example.com"),
    )

    def store_transaction(
        connection,
        *,
        owner_user_id,
        candidate_profile_id,
        reference,
        event_type,
        status,
        amount,
        currency,
        customer_code,
        subscription_code,
        paid_at,
        raw_payload,
    ) -> None:
        stored_references[reference] = {
            "owner_user_id": owner_user_id,
            "candidate_profile_id": candidate_profile_id,
            "event_type": event_type,
            "status": status,
        }

    monkeypatch.setattr(payment_service, "_store_transaction", store_transaction)
    monkeypatch.setattr(
        payment_service,
        "_update_billing_access",
        lambda connection, **kwargs: {
            "status": "active",
            "access_starts_at": payment_service._now(),
            "access_expires_at": payment_service._now(),
        },
    )

    payment_service.process_paystack_webhook({"x-paystack-signature": signature}, body)
    payment_service.process_paystack_webhook({"x-paystack-signature": signature}, body)

    assert list(stored_references) == ["paystack-ref-123"]


def test_process_paystack_webhook_rejects_invalid_signature(monkeypatch) -> None:
    monkeypatch.setattr(payment_service, "ensure_payment_schema", lambda: None)
    monkeypatch.setattr(payment_service, "_paystack_secret_key", lambda: "sk_test_paystack")

    try:
        payment_service.process_paystack_webhook(
            {"x-paystack-signature": "invalid"},
            dumps({"event": "charge.success", "data": {}}).encode("utf-8"),
        )
    except ValueError as exc:
        assert str(exc) == "Invalid Paystack signature."
    else:
        raise AssertionError("Expected invalid signature to be rejected.")
