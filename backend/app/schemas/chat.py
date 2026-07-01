"""Pydantic schemas for public twin chat."""

from typing import Literal

from pydantic import BaseModel, Field


class PublicChatMessage(BaseModel):
    """Single public chat turn included in the request history."""

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4_000)


class PublicChatRequest(BaseModel):
    """Inbound public twin chat request."""

    message: str = Field(min_length=1, max_length=4_000)
    history: list[PublicChatMessage] = Field(default_factory=list)


class PublicChatResponse(BaseModel):
    """Public twin chat response."""

    answer: str
    usedContext: bool
    sources: list[int]
