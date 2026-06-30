from app.services import chat_service


def test_is_general_message_detects_greetings() -> None:
    assert chat_service.is_general_message("Hello there")
    assert chat_service.is_general_message("thanks")
    assert not chat_service.is_general_message("What experience do you have with Python?")


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
