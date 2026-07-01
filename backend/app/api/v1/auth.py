"""Authentication routes."""

from json import JSONDecodeError, loads
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request as UrlRequest
from urllib.request import urlopen

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from ...config import get_settings
from ...dependencies import require_authenticated_user
from ...schemas.auth import (
    AuthSessionResponse,
    AuthStatusResponse,
    AuthUserResponse,
    GoogleExchangeRequest,
    LoginRequest,
    RegisterRequest,
)
from ...services.auth_service import (
    AuthenticatedUser,
    DuplicateUserError,
    InvalidCredentialsError,
    authenticate_user,
    authenticate_google_user,
    delete_session,
    get_authenticated_user,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _auth_user_response(user: AuthenticatedUser) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        firstName=user.first_name,
        lastName=user.last_name,
        email=user.email,
        authProvider=user.auth_provider,
    )


def _set_session_cookie(response: Response, session_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_session_cookie_name,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.auth_session_days * 24 * 60 * 60,
    )


def _google_settings() -> tuple[str, str]:
    settings = get_settings()
    client_id = (settings.google_client_id or "").strip()
    client_secret = (settings.google_client_secret or "").strip()

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured.",
        )

    return client_id, client_secret


def _validate_google_redirect_uri(redirect_uri: str) -> str:
    settings = get_settings()
    frontend_origin = settings.frontend_origin.rstrip("/")
    parsed = urlparse(redirect_uri)
    allowed = urlparse(frontend_origin)

    if (
        parsed.scheme != allowed.scheme
        or parsed.netloc != allowed.netloc
        or redirect_uri.rstrip("/") != f"{frontend_origin}/auth/google/callback"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google redirect URI.",
        )

    return redirect_uri


def _read_json_response(request: UrlRequest) -> dict[str, object]:
    try:
        with urlopen(request, timeout=10) as response:
            return loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = "Unable to complete Google sign-in."
        try:
            payload = loads(exc.read().decode("utf-8"))
            if isinstance(payload, dict) and isinstance(payload.get("error_description"), str):
                detail = payload["error_description"]
        except (OSError, JSONDecodeError):
            pass
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except (URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google sign-in is temporarily unavailable.",
        ) from exc


def _exchange_google_code(code: str, redirect_uri: str) -> dict[str, object]:
    client_id, client_secret = _google_settings()
    body = urlencode(
        {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }
    ).encode("utf-8")

    request = UrlRequest(
        GOOGLE_TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    return _read_json_response(request)


def _fetch_google_userinfo(access_token: str) -> dict[str, object]:
    request = UrlRequest(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        method="GET",
    )
    return _read_json_response(request)


def _resolve_google_name(profile: dict[str, object], key: str) -> str:
    value = profile.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()

    display_name = profile.get("name")
    if not isinstance(display_name, str) or not display_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return a usable profile name.",
        )

    parts = display_name.strip().split()
    if key == "given_name":
        return parts[0]
    if len(parts) > 1:
        return " ".join(parts[1:])
    return parts[0]


@router.post("/register", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response) -> AuthSessionResponse:
    """Create a user account and start a session."""

    try:
        session = register_user(
            first_name=payload.firstName,
            last_name=payload.lastName,
            email=payload.email,
            password=payload.password,
        )
    except DuplicateUserError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    _set_session_cookie(response, session.session_token)
    return AuthSessionResponse(user=_auth_user_response(session.user))


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, response: Response) -> AuthSessionResponse:
    """Authenticate a user and start a session."""

    try:
        session = authenticate_user(email=payload.email, password=payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    _set_session_cookie(response, session.session_token)
    return AuthSessionResponse(user=_auth_user_response(session.user))


@router.post("/google/exchange", response_model=AuthSessionResponse)
def google_exchange(
    payload: GoogleExchangeRequest,
    response: Response,
) -> AuthSessionResponse:
    """Exchange a Google authorization code and start an application session."""

    redirect_uri = _validate_google_redirect_uri(payload.redirectUri)
    token_payload = _exchange_google_code(payload.code, redirect_uri)
    access_token = token_payload.get("access_token")

    if not isinstance(access_token, str) or not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return an access token.",
        )

    profile = _fetch_google_userinfo(access_token)
    email = profile.get("email")
    email_verified = profile.get("email_verified")

    if not isinstance(email, str) or not email.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return an email address.",
        )

    if email_verified is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email must be verified.",
        )

    try:
        session = authenticate_google_user(
            email=email,
            first_name=_resolve_google_name(profile, "given_name"),
            last_name=_resolve_google_name(profile, "family_name"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    _set_session_cookie(response, session.session_token)
    return AuthSessionResponse(user=_auth_user_response(session.user))


@router.get("/me", response_model=AuthSessionResponse)
def read_current_user(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> AuthSessionResponse:
    """Return the current authenticated user."""

    return AuthSessionResponse(user=_auth_user_response(current_user))


@router.get("/status", response_model=AuthStatusResponse)
def read_auth_status(request: Request) -> AuthStatusResponse:
    """Return whether the current request has a valid authenticated session."""

    settings = get_settings()
    session_token = request.cookies.get(settings.auth_session_cookie_name)

    if not session_token:
        return AuthStatusResponse(authenticated=False)

    user = get_authenticated_user(session_token)
    if not user:
        return AuthStatusResponse(authenticated=False)

    return AuthStatusResponse(authenticated=True, user=_auth_user_response(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> Response:
    """Clear the current session."""

    settings = get_settings()
    session_token = request.cookies.get(settings.auth_session_cookie_name)
    if session_token:
        delete_session(session_token)

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(settings.auth_session_cookie_name, samesite="lax")
    return response
