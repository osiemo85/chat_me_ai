"""Client-agnostic drafts for assets and extracted CV chunks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class ProcessingStatus(StrEnum):
    """Lifecycle state for file handling and CV processing."""

    PENDING = "pending"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    EXTRACTING = "extracting"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(slots=True)
class ProfileAssetDraft:
    """Draft row for candidate-owned uploaded assets."""

    id: UUID
    candidate_profile_id: UUID
    asset_type: str
    original_filename: str
    content_type: str
    storage_bucket: str | None = None
    storage_path: str | None = None
    upload_status: ProcessingStatus = ProcessingStatus.PENDING
    is_current: bool = True
    version: int = 1
    replaced_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass(slots=True)
class ChunkDraft:
    """Draft row for extracted CV chunks and embedding metadata."""

    id: UUID
    candidate_profile_id: UUID
    profile_asset_id: UUID
    chunk_index: int
    chunk_text: str
    embedding_model: str | None = None
    embedding_status: ProcessingStatus = ProcessingStatus.PENDING
    embedding: list[float] | None = None
    is_current: bool = True
    created_at: datetime | None = None
