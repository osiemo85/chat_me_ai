"""NVIDIA embedding helpers for CV chunk retrieval."""

from __future__ import annotations

from functools import lru_cache

from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings

from ..config import get_settings


@lru_cache(maxsize=1)
def get_embedding_client() -> NVIDIAEmbeddings:
    """Create and cache the configured NVIDIA embedding client."""

    settings = get_settings()

    if not settings.nvidia_api_key:
        raise RuntimeError("NVIDIA_API_KEY is not configured.")

    if not settings.model_name:
        raise RuntimeError("MODEL_NAME is not configured.")

    return NVIDIAEmbeddings(
        model=settings.model_name,
        api_key=settings.nvidia_api_key,
        truncate=settings.nvidia_truncate,
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
