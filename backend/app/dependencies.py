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
