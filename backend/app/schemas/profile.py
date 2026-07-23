"""Pydantic response schemas for profiles."""

from pydantic import BaseModel


class ProfileCreateResponse(BaseModel):
    """Response returned after profile creation or update is accepted."""

    is_update: bool
    public_link: str
    public_profile_id: str


class PublicProfileResponse(BaseModel):
    """Public profile response used by the frontend twin page."""

    firstName: str
    secondName: str
    contactEmail: str | None = None
    contactPhone: str | None = None
    githubUrl: str | None = None
    linkedinUrl: str | None = None
    otherUrl: str | None = None
    passportUrl: str | None = None
    persona: str
    publicProfileId: str
    uploadStatus: str
    cvProcessingStatus: str


class EditableProfileResponse(BaseModel):
    """Editable profile fields used to prepopulate the upload form."""

    firstName: str
    secondName: str
    email: str
    contactEmail: str | None = None
    contactPhone: str | None = None
    githubUrl: str | None = None
    linkedinUrl: str | None = None
    otherUrl: str | None = None
    persona: str
    publicProfileId: str
    publicLink: str | None = None
    cvFileName: str | None = None
    passportFileName: str | None = None
