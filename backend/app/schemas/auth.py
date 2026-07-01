"""Pydantic schemas for authentication routes."""

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    """JSON body for user registration."""

    firstName: str = Field(min_length=1, max_length=100)
    lastName: str = Field(min_length=1, max_length=100)
    email: str
    password: str = Field(min_length=8, max_length=255)


class LoginRequest(BaseModel):
    """JSON body for user login."""

    email: str
    password: str = Field(min_length=8, max_length=255)


class GoogleExchangeRequest(BaseModel):
    """OAuth authorization code payload for Google sign-in."""

    code: str = Field(min_length=1)
    redirectUri: str = Field(min_length=1, max_length=2048)


class AuthUserResponse(BaseModel):
    """Authenticated user details returned to the frontend."""

    id: str
    firstName: str
    lastName: str
    email: str
    authProvider: str


class AuthSessionResponse(BaseModel):
    """Authenticated session response."""

    user: AuthUserResponse


class AuthStatusResponse(BaseModel):
    """Authentication status for session-aware but public frontend checks."""

    authenticated: bool
    user: AuthUserResponse | None = None
