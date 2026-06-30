"""Root API router."""

from fastapi import APIRouter

from .v1.chat import router as chat_router
from .v1.health import router as health_router
from .v1.profiles import router as profiles_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(chat_router)
api_router.include_router(health_router)
api_router.include_router(profiles_router)
