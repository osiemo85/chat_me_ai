from app.schemas.chat import PublicChatMessage
from app.services import chat_service


def test_answer_public_question_returns_no_answer_without_chunks(monkeypatch) -> None:
    monkeypatch.setattr(
        chat_service,
        "get_candidate_context",
        lambda _: type(
            "Candidate",
            (),
            {
                "candidate_profile_id": "candidate-1",
                "full_name": "Maina Osiemo",
                "persona": "Professional",
                "public_profile_id": "twin_123",
            },
        )(),
    )
    monkeypatch.setattr(chat_service, "get_current_chunks", lambda _: [])
    monkeypatch.setattr(
        chat_service,
        "_answer_with_rag_agent",
        lambda *args: ("No matching context.", None),
    )

    result = chat_service.answer_public_question("twin_123", "What is her experience?")

    assert result["answer"] == "No matching context."
    assert result["usedContext"] is False


def test_answer_public_question_uses_one_agent_for_greetings(monkeypatch) -> None:
    candidate = type(
        "Candidate",
        (),
        {
            "candidate_profile_id": "candidate-1",
            "full_name": "Maina Osiemo",
            "persona": "Professional",
            "public_profile_id": "twin_123",
        },
    )()
    captured: dict[str, object] = {}

    monkeypatch.setattr(chat_service, "get_candidate_context", lambda _: candidate)
    monkeypatch.setattr(
        chat_service,
        "get_current_chunks",
        lambda _: [],
    )
    monkeypatch.setattr(
        chat_service,
        "_answer_with_rag_agent",
        lambda candidate, message, history, chunks: captured.update(
            {"message": message, "history": history, "chunks": chunks}
        ) or ("Hello there", None),
    )

    result = chat_service.answer_public_question(
        "twin_123",
        "Hello",
        history=[PublicChatMessage(role="user", content="I am Alber.")],
    )

    assert result["usedContext"] is False
    assert captured["message"] == "Hello"
    assert captured["chunks"] == []


def test_answer_with_rag_agent_passes_string_system_prompt(monkeypatch) -> None:
    candidate = type(
        "Candidate",
        (),
        {
            "candidate_profile_id": "candidate-1",
            "full_name": "Maina Osiemo",
            "persona": "Professional",
            "public_profile_id": "twin_123",
        },
    )()
    chunks = []

    monkeypatch.setattr(chat_service, "get_chat_client", lambda: object())

    captured: dict[str, object] = {}

    class FakeAgent:
        def invoke(self, payload: dict[str, object]) -> dict[str, object]:
            captured["payload"] = payload
            return {"messages": [type("Message", (), {"content": "Grounded answer"})()]}

    def fake_create_agent(*, model: object, tools: list[object], system_prompt: str) -> FakeAgent:
        captured["model"] = model
        captured["tools"] = tools
        captured["system_prompt"] = system_prompt
        return FakeAgent()

    monkeypatch.setattr(chat_service, "create_agent", fake_create_agent)

    result, usage = chat_service._answer_with_rag_agent(
        candidate,
        "What is your experience?",
        [],
        chunks,
    )

    assert result == "Grounded answer"
    assert usage is None
    assert isinstance(captured["system_prompt"], str)


def test_answer_with_rag_agent_passes_history_messages(monkeypatch) -> None:
    candidate = type(
        "Candidate",
        (),
        {
            "candidate_profile_id": "candidate-1",
            "full_name": "Maina Osiemo",
            "persona": "Professional",
            "public_profile_id": "twin_123",
        },
    )()
    monkeypatch.setattr(chat_service, "get_chat_client", lambda: object())

    captured: dict[str, object] = {}

    class FakeAgent:
        def invoke(self, payload: dict[str, object]) -> dict[str, object]:
            captured["payload"] = payload
            return {"messages": [type("Message", (), {"content": "Grounded answer"})()]}

    monkeypatch.setattr(
        chat_service,
        "create_agent",
        lambda **kwargs: FakeAgent(),
    )

    history = [PublicChatMessage(role="user", content="My name is Alber.")]
    result, usage = chat_service._answer_with_rag_agent(
        candidate,
        "What is your experience?",
        history,
        [],
    )

    assert result == "Grounded answer"
    assert usage is None
    assert captured["payload"] == {
        "messages": [
            {"role": "user", "content": "My name is Alber."},
            {"role": "user", "content": "What is your experience?"},
        ]
    }


def test_answer_public_question_with_usage_returns_usage_from_one_agent(monkeypatch) -> None:
    candidate = type(
        "Candidate",
        (),
        {
            "candidate_profile_id": "candidate-1",
            "full_name": "Maina Osiemo",
            "persona": "Professional",
            "public_profile_id": "twin_123",
        },
    )()

    monkeypatch.setattr(chat_service, "get_candidate_context", lambda _: candidate)
    monkeypatch.setattr(chat_service, "get_current_chunks", lambda _: [])
    monkeypatch.setattr(
        chat_service,
        "_answer_with_rag_agent",
        lambda *args: ("Hello there", chat_service.ChatUsage(total_tokens=42)),
    )

    result, usage = chat_service.answer_public_question_with_usage("twin_123", "Hello")

    assert result == {"answer": "Hello there", "usedContext": False, "sources": []}
    assert usage is not None
    assert usage.total_tokens == 42
