from app.services.retrieval_service import RetrievedChunk, rank_chunks, serialize_ranked_chunks


def test_serialize_ranked_chunks_returns_no_match_message() -> None:
    assert serialize_ranked_chunks([]) == "No CV context matched this question."


def test_rank_chunks_returns_top_matches(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.retrieval_service.embed_query_text",
        lambda _: [1.0, 0.0],
    )

    chunks = [
        RetrievedChunk(
            chunk_id="a",
            chunk_index=0,
            chunk_text="Python backend engineer",
            embedding=[1.0, 0.0],
        ),
        RetrievedChunk(
            chunk_id="b",
            chunk_index=1,
            chunk_text="Graphic designer",
            embedding=[0.0, 1.0],
        ),
    ]

    ranked = rank_chunks("What backend work has she done?", chunks)

    assert len(ranked) == 1
    assert ranked[0].chunk_id == "a"
    assert ranked[0].chunk_index == 0
