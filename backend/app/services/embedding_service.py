"""OpenRouter embedding helpers for CV chunk retrieval."""

from __future__ import annotations

from functools import lru_cache

from langchain_openai import OpenAIEmbeddings

from ..config import get_settings


@lru_cache(maxsize=1)
def get_embedding_client() -> OpenAIEmbeddings:
    """Create and cache the configured OpenRouter embedding client."""

    settings = get_settings()

    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured.")

    if not settings.embedding_model:
        raise RuntimeError("EMBEDDING_MODEL is not configured.")

    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
    )


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of chunk texts and validate the result shape."""

    if not texts:
        return []

    embeddings = get_embedding_client().embed_documents(texts)

    if len(embeddings) != len(texts):
        raise RuntimeError("Embedding provider returned a mismatched number of vectors.")

    return [list(vector) for vector in embeddings]


def embed_query_text(text: str) -> list[float]:
    """Embed a single user query for retrieval."""

    embedding = get_embedding_client().embed_query(text)
    return list(embedding)
