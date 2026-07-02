"""Retrieval helpers for public digital twin chat."""

from __future__ import annotations

from dataclasses import dataclass
from math import sqrt

from ..config import get_settings
from ..db import get_connection
from .embedding_service import embed_query_text


@dataclass(slots=True)
class CandidateContext:
    """Current public twin context available for retrieval."""

    candidate_profile_id: str
    full_name: str
    owner_email: str
    owner_user_id: str | None
    persona: str
    public_profile_id: str


@dataclass(slots=True)
class RetrievedChunk:
    """A current CV chunk with a completed embedding."""

    chunk_id: str
    chunk_index: int
    chunk_text: str
    embedding: list[float]


@dataclass(slots=True)
class RankedChunk:
    """A retrieved chunk and its similarity score."""

    chunk_id: str
    chunk_index: int
    chunk_text: str
    score: float


def get_candidate_context(public_profile_id: str) -> CandidateContext | None:
    """Load the public twin metadata used to scope retrieval and tone."""

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select id, user_id, email, first_name, second_name, persona, public_profile_id
                from candidate_profiles
                where public_profile_id = %s
                limit 1
                """,
                (public_profile_id,),
            )
            row = cursor.fetchone()

    if not row:
        return None

    return CandidateContext(
        candidate_profile_id=str(row["id"]),
        full_name=f"{row['first_name']} {row['second_name']}",
        owner_email=str(row["email"]),
        owner_user_id=str(row["user_id"]) if row["user_id"] else None,
        persona=str(row["persona"]),
        public_profile_id=str(row["public_profile_id"]),
    )


def get_current_chunks(candidate_profile_id: str) -> list[RetrievedChunk]:
    """Return current embedded chunks for a candidate."""

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select id, chunk_index, chunk_text, embedding
                from chunks
                where candidate_profile_id = %s
                  and is_current = true
                  and embedding_status = 'completed'
                  and embedding is not null
                order by chunk_index asc
                """,
                (candidate_profile_id,),
            )
            rows = cursor.fetchall()

    return [
        RetrievedChunk(
            chunk_id=str(row["id"]),
            chunk_index=int(row["chunk_index"]),
            chunk_text=str(row["chunk_text"]),
            embedding=[float(value) for value in row["embedding"]],
        )
        for row in rows
    ]


def rank_chunks(query: str, chunks: list[RetrievedChunk]) -> list[RankedChunk]:
    """Rank chunks by cosine similarity against the embedded query."""

    if not chunks:
        return []

    settings = get_settings()
    query_vector = embed_query_text(query)
    ranked: list[RankedChunk] = []

    for chunk in chunks:
        score = _cosine_similarity(query_vector, chunk.embedding)

        if score < settings.retrieval_min_score:
            continue

        ranked.append(
            RankedChunk(
                chunk_id=chunk.chunk_id,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.chunk_text,
                score=score,
            )
        )

    ranked.sort(key=lambda item: item.score, reverse=True)
    return ranked[: settings.retrieval_top_k]


def serialize_ranked_chunks(chunks: list[RankedChunk]) -> str:
    """Serialize retrieved chunks into compact tool output."""

    if not chunks:
        return "No CV context matched this question."

    return "\n\n".join(
        f"Chunk {chunk.chunk_index} (score={chunk.score:.3f})\n{chunk.chunk_text}"
        for chunk in chunks
    )


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right):
        raise RuntimeError("Embedding dimensions do not match.")

    left_norm = sqrt(sum(value * value for value in left))
    right_norm = sqrt(sum(value * value for value in right))

    if left_norm == 0 or right_norm == 0:
        return 0.0

    dot_product = sum(left_value * right_value for left_value, right_value in zip(left, right, strict=True))
    return dot_product / (left_norm * right_norm)
