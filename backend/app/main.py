"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.router import api_router
from .config import get_settings
from .services.auth_service import ensure_auth_schema
from .services.payment_service import ensure_payment_schema
from .services.profile_service import ensure_schema


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    settings = get_settings()
    app = FastAPI(title="Chat Me AI Backend", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    @app.on_event("startup")
    def startup() -> None:
        ensure_auth_schema()
        ensure_schema()
        ensure_payment_schema()

    return app


app = create_app()
