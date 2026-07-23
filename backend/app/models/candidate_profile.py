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

    Uploaded files should live in Supabase storage once configured.
    The database row should only store identity fields plus pipeline status.
    """

    id: UUID
    first_name: str
    second_name: str
    email: str
    persona: PersonaOption
    contact_email: str | None = None
    contact_phone: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    other_url: str | None = None
    public_profile_id: str | None = None
    upload_status: str = "pending"
    cv_processing_status: str = "pending"
    last_error: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
