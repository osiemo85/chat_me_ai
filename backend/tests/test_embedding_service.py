from app.services import embedding_service


class FakeEmbeddingsClient:
    def __init__(self, *, vectors: list[list[float]]) -> None:
        self.vectors = vectors
        self.calls: list[list[str]] = []
        self.query_calls: list[str] = []

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(texts)
        return self.vectors

    def embed_query(self, text: str) -> list[float]:
        self.query_calls.append(text)
        return self.vectors[0]


def test_embed_texts_returns_vectors(monkeypatch) -> None:
    client = FakeEmbeddingsClient(vectors=[[0.1, 0.2], [0.3, 0.4]])

    monkeypatch.setattr(embedding_service, "get_embedding_client", lambda: client)

    vectors = embedding_service.embed_texts(["first chunk", "second chunk"])

    assert vectors == [[0.1, 0.2], [0.3, 0.4]]
    assert client.calls == [["first chunk", "second chunk"]]


def test_embed_texts_rejects_mismatched_vector_count(monkeypatch) -> None:
    client = FakeEmbeddingsClient(vectors=[[0.1, 0.2]])

    monkeypatch.setattr(embedding_service, "get_embedding_client", lambda: client)

    try:
        embedding_service.embed_texts(["first chunk", "second chunk"])
    except RuntimeError as exc:
        assert str(exc) == "Embedding provider returned a mismatched number of vectors."
    else:
        raise AssertionError("Expected mismatched embedding count to raise RuntimeError.")


def test_embed_query_text_returns_vector(monkeypatch) -> None:
    client = FakeEmbeddingsClient(vectors=[[0.5, 0.6]])

    monkeypatch.setattr(embedding_service, "get_embedding_client", lambda: client)

    vector = embedding_service.embed_query_text("candidate backend experience")

    assert vector == [0.5, 0.6]
    assert client.query_calls == ["candidate backend experience"]
