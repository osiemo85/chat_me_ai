"""Root API router."""

from fastapi import APIRouter

from .v1.admin import router as admin_router
from .v1.auth import router as auth_router
from .v1.chat import router as chat_router
from .v1.health import router as health_router
from .v1.profiles import router as profiles_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(admin_router)
api_router.include_router(auth_router)
api_router.include_router(chat_router)
api_router.include_router(health_router)
api_router.include_router(profiles_router)
