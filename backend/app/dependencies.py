"""Request-scoped dependencies."""

from fastapi import HTTPException, Request, status

from .config import get_settings
from .services.auth_service import AuthenticatedUser, get_authenticated_user


def require_authenticated_user(request: Request) -> AuthenticatedUser:
    """Return the current authenticated user from the session cookie."""

    settings = get_settings()
    session_token = request.cookies.get(settings.auth_session_cookie_name)

    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    user = get_authenticated_user(session_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    return user


def require_admin_user(request: Request) -> AuthenticatedUser:
    """Return the current authenticated user if they are an allowed admin."""

    user = require_authenticated_user(request)
    settings = get_settings()
    allowed_emails = {
        value.strip().lower()
        for value in settings.admin_emails.split(",")
        if value.strip()
    }

    if not allowed_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dashboard admin access is not configured.",
        )

    if user.email.strip().lower() not in allowed_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )

    return user
