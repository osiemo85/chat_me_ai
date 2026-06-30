"""Utilities for splitting extracted CV text into retrieval chunks."""


def chunk_text(text: str, *, chunk_size: int, overlap: int) -> list[str]:
    """Split normalized text into overlapping chunks."""

    cleaned = "\n".join(line.strip() for line in text.splitlines() if line.strip())

    if not cleaned:
        return []

    chunks: list[str] = []
    start = 0
    total_length = len(cleaned)

    while start < total_length:
        end = min(start + chunk_size, total_length)
        chunk = cleaned[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= total_length:
            break

        start = max(end - overlap, start + 1)

    return chunks
