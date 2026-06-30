from app.services.chunking_service import chunk_text


def test_chunk_text_returns_overlap_chunks() -> None:
    text = "A" * 1500

    chunks = chunk_text(text, chunk_size=1000, overlap=100)

    assert len(chunks) == 2
    assert len(chunks[0]) == 1000
    assert chunks[0][-100:] == chunks[1][:100]


def test_chunk_text_drops_blank_lines() -> None:
    text = "First line\n\nSecond line\n   \nThird line"

    chunks = chunk_text(text, chunk_size=1000, overlap=50)

    assert chunks == ["First line\nSecond line\nThird line"]
