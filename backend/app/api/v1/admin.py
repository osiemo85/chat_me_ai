"""Admin dashboard routes."""

from fastapi import APIRouter, Depends

from ...dependencies import require_admin_user
from ...schemas.admin import AdminDashboardResponse
from ...services.admin_service import get_admin_dashboard_data
from ...services.auth_service import AuthenticatedUser

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", response_model=AdminDashboardResponse)
def read_admin_dashboard(
    current_user: AuthenticatedUser = Depends(require_admin_user),
) -> AdminDashboardResponse:
    """Return the private dashboard payload for approved admins."""

    del current_user
    return AdminDashboardResponse(**get_admin_dashboard_data())
