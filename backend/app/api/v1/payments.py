"""Owner billing and Paystack webhook routes."""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ...dependencies import require_authenticated_user
from ...schemas.payments import (
    BillingStatusResponse,
    CheckoutLinkResponse,
    VerifyPaystackRequest,
    VerifyPaystackResponse,
    WebhookAckResponse,
)
from ...services.auth_service import AuthenticatedUser
from ...services.payment_service import (
    build_hosted_checkout_link,
    get_billing_status_for_user,
    process_paystack_webhook,
    verify_paystack_transaction,
)

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/me", response_model=BillingStatusResponse)
def read_billing_status(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> BillingStatusResponse:
    """Return the current owner's billing state."""

    try:
        return BillingStatusResponse(**get_billing_status_for_user(current_user.id))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.post("/paystack/checkout-link", response_model=CheckoutLinkResponse)
def create_checkout_link(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> CheckoutLinkResponse:
    """Return the hosted Paystack subscription URL."""

    try:
        return CheckoutLinkResponse(**build_hosted_checkout_link(current_user.id))
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.post("/paystack/verify", response_model=VerifyPaystackResponse)
def verify_transaction(
    payload: VerifyPaystackRequest,
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> VerifyPaystackResponse:
    """Verify a Paystack payment reference for the current owner."""

    try:
        return VerifyPaystackResponse(
            **verify_paystack_transaction(payload.reference, current_user.id)
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.post("/paystack/webhook", response_model=WebhookAckResponse)
async def paystack_webhook(request: Request) -> WebhookAckResponse:
    """Receive signed Paystack webhook events."""

    body = await request.body()
    headers = {key.lower(): value for key, value in request.headers.items()}

    try:
        process_paystack_webhook(headers, body)
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return WebhookAckResponse()
