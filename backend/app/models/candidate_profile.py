"""Client-agnostic model draft for candidate profile intake.

This module intentionally avoids choosing an ORM or a PostgreSQL client.
It only defines the record shape expected by the current frontend upload flow.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class PersonaOption(StrEnum):
    """Supported persona values for the current dropdown."""

    PROFESSIONAL = "Professional"
    CONFIDENT = "Confident"
    FRIENDLY = "Friendly"
    TECHNICAL = "Technical"
    EXECUTIVE = "Executive"


@dataclass(slots=True)
class CandidateProfileDraft:
    """Table-shape draft for the candidate profile record.

    The actual CV file should live in Supabase storage once configured.
    The database row should only store storage metadata and identity fields.
    """

    id: UUID
    first_name: str
    second_name: str
    email: str
    persona: PersonaOption
    cv_original_filename: str
    cv_content_type: str = "application/pdf"
    linkedin_url: str | None = None
    github_url: str | None = None
    other_url: str | None = None
    cv_storage_bucket: str | None = None
    cv_storage_path: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
