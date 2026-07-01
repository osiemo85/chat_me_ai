from app.schemas.chat import PublicChatMessage
from app.services import chat_service


def test_is_general_message_detects_greetings() -> None:
    assert chat_service.is_general_message("Hello there")
    assert chat_service.is_general_message("thanks")
    assert not chat_service.is_general_message("What experience do you have with Python?")


def test_is_user_identity_question_detects_name_queries() -> None:
    assert chat_service.is_user_identity_question("Do you remember my name?")
    assert chat_service.is_user_identity_question("Who am I?")
    assert not chat_service.is_user_identity_question("What is your experience with Python?")


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

    result = chat_service.answer_public_question("twin_123", "What is her experience?")

    assert result["answer"] == "I do not have an answer from the CV context."
    assert result["usedContext"] is False


def test_answer_public_question_returns_deterministic_identity_reply(monkeypatch) -> None:
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

    result = chat_service.answer_public_question("twin_123", "Do you remember my name?")

    assert result == {
        "answer": (
            "I do not know your name unless you share it in this chat. "
            "If you would like, you can ask about Maina Osiemo's experience, skills, or background."
        ),
        "usedContext": False,
        "sources": [],
    }


def test_answer_public_question_remembers_user_name_from_history(monkeypatch) -> None:
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

    result = chat_service.answer_public_question(
        "twin_123",
        "Do you remember my name?",
        history=[
            PublicChatMessage(role="user", content="Hello, I am Alber."),
            PublicChatMessage(role="assistant", content="Nice to meet you."),
        ],
    )

    assert result == {
        "answer": "Yes. You told me your name is Alber. I'm representing Maina Osiemo in this chat.",
        "usedContext": False,
        "sources": [],
    }


def test_answer_public_question_passes_history_to_general_chat(monkeypatch) -> None:
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
        "_stream_chat",
        lambda messages: captured.setdefault("messages", messages) or "Hello there",
    )

    result = chat_service.answer_public_question(
        "twin_123",
        "Hello",
        history=[PublicChatMessage(role="user", content="I am Alber.")],
    )

    assert result["usedContext"] is False
    messages = captured["messages"]
    assert isinstance(messages, list)
    assert messages[1] == {"role": "user", "content": "I am Alber."}
    assert messages[2] == {"role": "user", "content": "Hello"}


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

    result = chat_service._answer_with_rag_agent(candidate, "What is your experience?", [], chunks)

    assert result == "Grounded answer"
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
    result = chat_service._answer_with_rag_agent(
        candidate,
        "What is your experience?",
        history,
        [],
    )

    assert result == "Grounded answer"
    assert captured["payload"] == {
        "messages": [
            {"role": "user", "content": "My name is Alber."},
            {"role": "user", "content": "What is your experience?"},
        ]
    }
