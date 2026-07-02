"""Pydantic schemas for the admin dashboard."""

from datetime import datetime

from pydantic import BaseModel


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


class AdminDashboardResponse(BaseModel):
    """Full admin dashboard payload."""

    summary: DashboardSummaryResponse
    users: list[DashboardUserRowResponse]
    usage: list[DashboardUsageRowResponse]
