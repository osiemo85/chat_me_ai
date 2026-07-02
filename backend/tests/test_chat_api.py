from fastapi.testclient import TestClient

from app.main import create_app
from app.services.chat_service import ChatUsage


def test_chat_public_logs_usage(monkeypatch) -> None:
    logged: dict[str, object] = {}

    monkeypatch.setattr(
        "app.api.v1.chat.consume_free_public_chat_if_allowed",
        lambda public_profile_id: True,
    )
    monkeypatch.setattr(
        "app.api.v1.chat.release_consumed_free_public_chat",
        lambda public_profile_id: None,
    )
    monkeypatch.setattr(
        "app.api.v1.chat.answer_public_question_with_usage",
        lambda public_profile_id, message, history=None: (
            {"answer": "Grounded answer", "usedContext": True, "sources": [1, 2]},
            ChatUsage(prompt_tokens=10, completion_tokens=6, total_tokens=16),
        ),
    )
    monkeypatch.setattr(
        "app.api.v1.chat.get_candidate_context",
        lambda _: type(
            "Candidate",
            (),
            {
                "candidate_profile_id": "candidate-1",
                "owner_user_id": "user-1",
                "owner_email": "ada@example.com",
                "public_profile_id": "twin_123",
            },
        )(),
    )
    monkeypatch.setattr(
        "app.api.v1.chat.record_chat_usage_event",
        lambda **kwargs: logged.update(kwargs),
    )
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)

    client = TestClient(create_app())
    response = client.post(
        "/api/v1/chat/public/twin_123",
        json={"message": "What is your experience?", "history": []},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "Grounded answer"
    assert logged["used_context"] is True
    assert logged["source_count"] == 2
    usage = logged["usage"]
    assert isinstance(usage, ChatUsage)
    assert usage.total_tokens == 16


def test_first_two_unpaid_public_chats_succeed_and_third_requires_subscription(monkeypatch) -> None:
    consume_results = iter([True, True, False])

    monkeypatch.setattr(
        "app.api.v1.chat.consume_free_public_chat_if_allowed",
        lambda public_profile_id: next(consume_results),
    )
    monkeypatch.setattr(
        "app.api.v1.chat.release_consumed_free_public_chat",
        lambda public_profile_id: None,
    )
    monkeypatch.setattr(
        "app.api.v1.chat.answer_public_question_with_usage",
        lambda public_profile_id, message, history=None: (
            {"answer": "Grounded answer", "usedContext": True, "sources": [1]},
            None,
        ),
    )
    monkeypatch.setattr(
        "app.api.v1.chat.get_candidate_context",
        lambda _: type(
            "Candidate",
            (),
            {
                "candidate_profile_id": "candidate-1",
                "owner_user_id": "user-1",
                "owner_email": "ada@example.com",
                "public_profile_id": "twin_123",
            },
        )(),
    )
    monkeypatch.setattr("app.api.v1.chat.record_chat_usage_event", lambda **kwargs: None)

    client = TestClient(create_app())

    first = client.post("/api/v1/chat/public/twin_123", json={"message": "Q1", "history": []})
    second = client.post("/api/v1/chat/public/twin_123", json={"message": "Q2", "history": []})
    third = client.post("/api/v1/chat/public/twin_123", json={"message": "Q3", "history": []})

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 402
    assert third.json() == {
        "detail": "This digital twin has reached its access limit. It needs subscription for access to continue.",
        "code": "subscription_required",
    }


def test_active_billing_bypasses_paywall(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.chat.consume_free_public_chat_if_allowed",
        lambda public_profile_id: True,
    )
    monkeypatch.setattr(
        "app.api.v1.chat.release_consumed_free_public_chat",
        lambda public_profile_id: None,
    )
    monkeypatch.setattr(
        "app.api.v1.chat.answer_public_question_with_usage",
        lambda public_profile_id, message, history=None: (
            {"answer": "Subscription active", "usedContext": False, "sources": []},
            None,
        ),
    )
    monkeypatch.setattr("app.api.v1.chat.get_candidate_context", lambda _: None)

    client = TestClient(create_app())
    response = client.post(
        "/api/v1/chat/public/twin_123",
        json={"message": "What can you do?", "history": []},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "Subscription active"


def test_expired_or_canceled_billing_blocks_after_free_limit(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.chat.consume_free_public_chat_if_allowed",
        lambda public_profile_id: False,
    )

    client = TestClient(create_app())
    response = client.post(
        "/api/v1/chat/public/twin_123",
        json={"message": "What can you do?", "history": []},
    )

    assert response.status_code == 402
    assert response.json()["code"] == "subscription_required"
