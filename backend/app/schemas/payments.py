"""Pydantic schemas for payment and billing routes."""

from datetime import datetime

from pydantic import BaseModel, Field


class BillingStatusResponse(BaseModel):
    """Owner billing status and remaining free public usage."""

    status: str
    freePublicChatsUsed: int
    freePublicChatsLimit: int
    accessStartsAt: datetime | None = None
    accessExpiresAt: datetime | None = None
    hostedPlanUrl: str
    paymentRequired: bool
    planLabel: str
    currency: str
    amountDisplay: str


class CheckoutLinkResponse(BaseModel):
    """Hosted checkout URL returned to the frontend."""

    hostedUrl: str
    callbackUrl: str


class VerifyPaystackRequest(BaseModel):
    """Paystack verification request payload."""

    reference: str = Field(min_length=1, max_length=255)


class VerifyPaystackResponse(BaseModel):
    """Verification result after backend entitlement update."""

    status: str
    accessStartsAt: datetime | None = None
    accessExpiresAt: datetime | None = None
    reference: str


class WebhookAckResponse(BaseModel):
    """Webhook acknowledgement payload."""

    received: bool = True
