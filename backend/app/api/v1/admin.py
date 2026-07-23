"""Admin dashboard routes."""

from fastapi import APIRouter, Depends, HTTPException, status

from ...dependencies import require_admin_user
from ...schemas.admin import (
    AdminDashboardResponse,
    ManualAccessGrantRequest,
    ManualAccessGrantResponse,
    ManualAccessRevokeResponse,
)
from ...services.admin_service import (
    get_admin_dashboard_data,
    grant_manual_access,
    revoke_manual_access,
)
from ...services.auth_service import AuthenticatedUser

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", response_model=AdminDashboardResponse)
def read_admin_dashboard(
    current_user: AuthenticatedUser = Depends(require_admin_user),
) -> AdminDashboardResponse:
    """Return the private dashboard payload for approved admins."""

    del current_user
    return AdminDashboardResponse(**get_admin_dashboard_data())


@router.post("/access-grants", response_model=ManualAccessGrantResponse)
def create_manual_access_grant(
    request: ManualAccessGrantRequest,
    current_user: AuthenticatedUser = Depends(require_admin_user),
) -> ManualAccessGrantResponse:
    """Grant or extend user access without requiring a subscription."""

    try:
        result = grant_manual_access(
            user_id=request.userId,
            duration=request.duration,
            custom_expires_at=request.customExpiresAt,
            granted_by_email=current_user.email,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return ManualAccessGrantResponse(**result)


@router.delete("/access-grants/{user_id}", response_model=ManualAccessRevokeResponse)
def delete_manual_access_grant(
    user_id: str,
    current_user: AuthenticatedUser = Depends(require_admin_user),
) -> ManualAccessRevokeResponse:
    """Revoke a user's manual access grant."""

    del current_user
    try:
        result = revoke_manual_access(user_id=user_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return ManualAccessRevokeResponse(**result)
