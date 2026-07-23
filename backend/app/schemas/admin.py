"""Pydantic schemas for the admin dashboard."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class DashboardSummaryResponse(BaseModel):
    """Top-level metrics for the admin dashboard."""

    totalUsers: int
    totalTwins: int
    totalRequests: int
    totalTokens: int
    totalCost: float


class DashboardUserRowResponse(BaseModel):
    """User and twin details shown in the dashboard."""

    userId: str
    firstName: str
    lastName: str
    email: str
    authProvider: str
    publicProfileId: str | None = None
    publicTwinUrl: str | None = None
    persona: str | None = None
    uploadStatus: str | None = None
    cvProcessingStatus: str | None = None
    totalRequests: int
    totalTokens: int
    totalCost: float
    createdAt: datetime
    lastActivityAt: datetime | None = None


class DashboardUsageRowResponse(BaseModel):
    """Aggregated usage metrics per managed public twin."""

    userId: str
    email: str
    publicProfileId: str
    publicTwinUrl: str
    requestsSent: int
    promptTokens: int
    completionTokens: int
    totalTokens: int
    totalCost: float
    lastRequestAt: datetime | None = None


class DashboardSubscriptionRowResponse(BaseModel):
    """Subscription and billing details per managed user."""

    userId: str
    email: str
    publicProfileId: str | None = None
    publicTwinUrl: str | None = None
    status: str
    planLabel: str
    freePublicChatsUsed: int
    freePublicChatsLimit: int
    accessStartsAt: datetime | None = None
    accessExpiresAt: datetime | None = None
    manualAccessGrantedByEmail: str | None = None
    manualAccessGrantedAt: datetime | None = None
    updatedAt: datetime | None = None


class AdminDashboardResponse(BaseModel):
    """Full admin dashboard payload."""

    summary: DashboardSummaryResponse
    users: list[DashboardUserRowResponse]
    usage: list[DashboardUsageRowResponse]
    subscriptions: list[DashboardSubscriptionRowResponse]


class ManualAccessGrantRequest(BaseModel):
    """Admin request to grant or extend access without a payment."""

    userId: str = Field(min_length=1)
    duration: Literal["2_days", "1_week", "1_month", "custom"]
    customExpiresAt: datetime | None = None

    @model_validator(mode="after")
    def validate_custom_expires_at(self) -> "ManualAccessGrantRequest":
        if self.duration == "custom" and self.customExpiresAt is None:
            raise ValueError("customExpiresAt is required for custom duration.")
        if self.duration != "custom" and self.customExpiresAt is not None:
            raise ValueError("customExpiresAt is only supported for custom duration.")
        return self


class ManualAccessGrantResponse(BaseModel):
    """Manual access grant result."""

    userId: str
    email: str
    publicProfileId: str | None = None
    status: str
    accessStartsAt: datetime | None = None
    accessExpiresAt: datetime
    manualAccessGrantedByEmail: str
    manualAccessGrantedAt: datetime


class ManualAccessRevokeResponse(BaseModel):
    """Manual access revoke result."""

    userId: str
    email: str
    publicProfileId: str | None = None
    status: str
    accessStartsAt: datetime | None = None
    accessExpiresAt: datetime | None = None
    manualAccessGrantedByEmail: str | None = None
    manualAccessGrantedAt: datetime | None = None
