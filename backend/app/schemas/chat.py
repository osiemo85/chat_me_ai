"""Pydantic schemas for public twin chat."""

from pydantic import BaseModel, Field


class PublicChatRequest(BaseModel):
    """Inbound public twin chat request."""

    message: str = Field(min_length=1, max_length=4_000)


class PublicChatResponse(BaseModel):
    """Public twin chat response."""

    answer: str
    usedContext: bool
    sources: list[int]
